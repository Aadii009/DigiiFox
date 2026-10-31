"use strict";

(() => {
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    const MAX_INPUT_PIXELS = 40_000_000;
    const MAX_OUTPUT_PIXELS = 40_000_000;
    const MAX_DIMENSION = 12_000;

    const $ = (id) => document.getElementById(id);

    const imageInput = $("imageInput");
    const uploadBox = $("uploadBox");
    const editor = $("editor");
    const chooseImageButton = $("chooseImageButton");
    const changeImageButton = $("changeImageButton");
    const originalPreview = $("originalPreview");
    const originalDimensions = $("originalDimensions");
    const originalSize = $("originalSize");
    const originalFormat = $("originalFormat");
    const resolutionPreset = $("resolutionPreset");
    const widthInput = $("widthInput");
    const heightInput = $("heightInput");
    const aspectRatioLock = $("aspectRatioLock");
    const ratioNote = $("ratioNote");
    const outputFormat = $("outputFormat");
    const qualityGroup = $("qualityGroup");
    const qualitySlider = $("qualitySlider");
    const qualityValue = $("qualityValue");
    const resizeButton = $("resizeButton");
    const statusMessage = $("statusMessage");
    const resultPanel = $("resultPanel");
    const resizedPreview = $("resizedPreview");
    const resizedDimensions = $("resizedDimensions");
    const resizedSize = $("resizedSize");
    const resizedFormat = $("resizedFormat");
    const resultSummary = $("resultSummary");
    const downloadButton = $("downloadButton");
    const resetButton = $("resetButton");
    const menuToggle = $("menuToggle");
    const mainNav = $("mainNav");

    let currentFile = null;
    let loadedImage = null;
    let originalObjectUrl = null;
    let resultObjectUrl = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let lastEditedDimension = "width";
    let isLoading = false;
    let isResizing = false;
    let operationNumber = 0;

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0) return "—";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function formatPixels(width, height) {
        return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
    }

    function getFormatLabel(mimeType) {
        const labels = {
            "image/jpeg": "JPG",
            "image/png": "PNG",
            "image/webp": "WebP"
        };
        return labels[mimeType] || "Image";
    }

    function setStatus(message, type = "") {
        statusMessage.textContent = message;
        statusMessage.className = "rc-status";
        if (type) statusMessage.classList.add(`rc-${type}`);
    }

    function revokeResultUrl() {
        if (resultObjectUrl) {
            URL.revokeObjectURL(resultObjectUrl);
            resultObjectUrl = null;
        }
    }

    function clearResult() {
        revokeResultUrl();
        resultPanel.hidden = true;
        resizedPreview.removeAttribute("src");
        downloadButton.removeAttribute("href");
    }

    function clearLoadedImage() {
        operationNumber++;
        currentFile = null;
        loadedImage = null;
        originalWidth = 0;
        originalHeight = 0;
        isLoading = false;
        isResizing = false;

        if (originalObjectUrl) {
            URL.revokeObjectURL(originalObjectUrl);
            originalObjectUrl = null;
        }

        originalPreview.removeAttribute("src");
        imageInput.value = "";
        clearResult();
        setStatus("");
        resizeButton.disabled = false;
        chooseImageButton.disabled = false;
        changeImageButton.disabled = false;
    }

    function showUploadArea() {
        clearLoadedImage();
        editor.hidden = true;
        uploadBox.hidden = false;
        imageInput.value = "";
    }

    function updateQualityVisibility() {
        const usesQuality = outputFormat.value !== "image/png";
        qualityGroup.hidden = !usesQuality;
    }

    function updateRatioNote() {
        if (aspectRatioLock.checked) {
            ratioNote.textContent =
                "Aspect ratio is locked. Changing one dimension updates the other.";
        } else {
            ratioNote.textContent =
                "Aspect ratio is unlocked. Width and height can be changed independently.";
        }
    }

    function validateDimensions(width, height) {
        if (!Number.isInteger(width) || !Number.isInteger(height)) {
            return "Enter whole numbers for the width and height.";
        }

        if (width < 1 || height < 1) {
            return "Width and height must each be at least 1 pixel.";
        }

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            return `Each dimension must be ${MAX_DIMENSION.toLocaleString()} pixels or less.`;
        }

        if (width * height > MAX_OUTPUT_PIXELS) {
            return "The requested output exceeds 40 megapixels. Choose smaller dimensions.";
        }

        return "";
    }

    function calculateHeight(width) {
        return Math.max(1, Math.round(width * originalHeight / originalWidth));
    }

    function calculateWidth(height) {
        return Math.max(1, Math.round(height * originalWidth / originalHeight));
    }

    function updateDimensionsFromWidth() {
        if (!loadedImage) return;

        const width = Number.parseInt(widthInput.value, 10);
        if (!Number.isFinite(width) || width < 1 || width > MAX_DIMENSION) return;

        if (aspectRatioLock.checked) {
            heightInput.value = calculateHeight(width);
        }

        resolutionPreset.value = "custom";
        clearResult();
        setStatus("");
    }

    function updateDimensionsFromHeight() {
        if (!loadedImage) return;

        const height = Number.parseInt(heightInput.value, 10);
        if (!Number.isFinite(height) || height < 1 || height > MAX_DIMENSION) return;

        if (aspectRatioLock.checked) {
            widthInput.value = calculateWidth(height);
        }

        resolutionPreset.value = "custom";
        clearResult();
        setStatus("");
    }

    function applyPreset() {
        if (!loadedImage) return;

        const value = resolutionPreset.value;

        if (value === "custom") {
            setStatus("Enter your preferred width and height.");
            return;
        }

        const parts = value.split("x").map(Number);
        const width = parts[0];
        const height = parts[1];

        const error = validateDimensions(width, height);
        if (error) {
            resolutionPreset.value = "custom";
            setStatus(error, "error");
            return;
        }

        widthInput.value = width;
        heightInput.value = height;
        clearResult();
        setStatus(`Preset selected: ${formatPixels(width, height)}.`, "ok");
    }

    function readImage(file) {
        if (!file) return;

        const validTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!validTypes.includes(file.type)) {
            setStatus("Please select a JPG, PNG or WebP image.", "error");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setStatus("This image exceeds the 25 MB file size limit.", "error");
            return;
        }

        const requestId = ++operationNumber;

        clearLoadedImage();
        const activeRequest = ++operationNumber;

        isLoading = true;
        chooseImageButton.disabled = true;
        changeImageButton.disabled = true;
        setStatus("Loading image…");

        const objectUrl = URL.createObjectURL(file);

        const image = new Image();

        image.onload = () => {
            if (activeRequest !== operationNumber) {
                URL.revokeObjectURL(objectUrl);
                return;
            }

            const width = image.naturalWidth;
            const height = image.naturalHeight;

            if (!width || !height) {
                URL.revokeObjectURL(objectUrl);
                isLoading = false;
                chooseImageButton.disabled = false;
                changeImageButton.disabled = false;
                setStatus("This image could not be read. Try another file.", "error");
                return;
            }

            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                URL.revokeObjectURL(objectUrl);
                isLoading = false;
                chooseImageButton.disabled = false;
                changeImageButton.disabled = false;
                setStatus("The original image exceeds the 12,000-pixel dimension limit.", "error");
                return;
            }

            if (width * height > MAX_INPUT_PIXELS) {
                URL.revokeObjectURL(objectUrl);
                isLoading = false;
                chooseImageButton.disabled = false;
                changeImageButton.disabled = false;
                setStatus("The original image exceeds the 40-megapixel input limit.", "error");
                return;
            }

            currentFile = file;
            loadedImage = image;
            originalObjectUrl = objectUrl;
            originalWidth = width;
            originalHeight = height;
            isLoading = false;

            originalPreview.src = objectUrl;
            originalDimensions.textContent = formatPixels(width, height);
            originalSize.textContent = formatBytes(file.size);
            originalFormat.textContent = getFormatLabel(file.type);

            widthInput.value = width;
            heightInput.value = height;
            resolutionPreset.value = "custom";
            aspectRatioLock.checked = true;
            lastEditedDimension = "width";

            uploadBox.hidden = true;
            editor.hidden = false;

            chooseImageButton.disabled = false;
            changeImageButton.disabled = false;

            updateRatioNote();
            updateQualityVisibility();
            clearResult();
            setStatus("Image loaded. Choose your new resolution.", "ok");
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);

            if (activeRequest !== operationNumber) return;

            isLoading = false;
            chooseImageButton.disabled = false;
            changeImageButton.disabled = false;
            setStatus("The image could not be opened. Please try another file.", "error");
        };

        image.src = objectUrl;
    }

    function createCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    function canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Your browser could not create the resized image."));
                            return;
                        }

                        resolve(blob);
                    },
                    mimeType,
                    quality
                );
            } catch {
                reject(new Error("Image export failed. Try smaller dimensions."));
            }
        });
    }

    async function resizeImage() {
        if (!loadedImage || !currentFile || isResizing || isLoading) {
            if (!loadedImage) {
                setStatus("Please upload an image first.", "error");
            }
            return;
        }

        const width = Number(widthInput.value);
        const height = Number(heightInput.value);

        const dimensionsError = validateDimensions(width, height);
        if (dimensionsError) {
            setStatus(dimensionsError, "error");
            return;
        }

        if (aspectRatioLock.checked) {
            const actualRatio = width / height;
            const originalRatio = originalWidth / originalHeight;

            if (Math.abs(actualRatio - originalRatio) > 0.002) {
                setStatus(
                    "These dimensions do not preserve the original aspect ratio. Adjust the width or height, or unlock the aspect ratio.",
                    "error"
                );
                return;
            }
        }

        const thisOperation = operationNumber;

        isResizing = true;
        resizeButton.disabled = true;
        changeImageButton.disabled = true;
        setStatus("Resizing image… Please wait.");
        clearResult();

        let canvas = null;

        try {
            canvas = createCanvas(width, height);

            const context = canvas.getContext("2d", { alpha: true });

            if (!context) {
                throw new Error("Your browser could not start image processing.");
            }

            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";

            if (outputFormat.value === "image/jpeg") {
                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, width, height);
            }

            context.drawImage(loadedImage, 0, 0, width, height);

            const mimeType = outputFormat.value;
            const quality = Number(qualitySlider.value) / 100;
            const blob = await canvasToBlob(
                canvas,
                mimeType,
                mimeType === "image/png" ? undefined : quality
            );

            if (thisOperation !== operationNumber) return;

            if (blob.type !== mimeType) {
                throw new Error("Your browser does not support this output format.");
            }

            revokeResultUrl();
            resultObjectUrl = URL.createObjectURL(blob);

            resizedPreview.src = resultObjectUrl;
            resizedDimensions.textContent = formatPixels(width, height);
            resizedSize.textContent = formatBytes(blob.size);
            resizedFormat.textContent = getFormatLabel(blob.type);

            const extension = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp"
            }[blob.type];

            downloadButton.href = resultObjectUrl;
            downloadButton.download = `digifox-resized-image.${extension}`;

            const dimensionChange =
                width === originalWidth && height === originalHeight
                    ? "The pixel dimensions are unchanged."
                    : `Dimensions changed from ${formatPixels(originalWidth, originalHeight)} to ${formatPixels(width, height)}.`;

            const sizeDifference = blob.size - currentFile.size;
            let sizeMessage;

            if (sizeDifference < 0) {
                const percentage = Math.round((Math.abs(sizeDifference) / currentFile.size) * 100);
                sizeMessage = `The output file is ${percentage}% smaller.`;
            } else if (sizeDifference > 0) {
                const percentage = Math.round((sizeDifference / currentFile.size) * 100);
                sizeMessage = `The output file is ${percentage}% larger.`;
            } else {
                sizeMessage = "The output file is approximately the same size.";
            }

            resultSummary.textContent = `${dimensionChange} ${sizeMessage} Results vary with format, dimensions and image content.`;
            resultPanel.hidden = false;

            setStatus("Your image has been resized successfully.", "ok");
            resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (error) {
            if (thisOperation === operationNumber) {
                setStatus(
                    error instanceof Error
                        ? error.message
                        : "Could not resize this image. Try smaller dimensions.",
                    "error"
                );
            }
        } finally {
            if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
            }

            if (thisOperation === operationNumber) {
                isResizing = false;
                resizeButton.disabled = false;
                changeImageButton.disabled = false;
            }
        }
    }

    function handleFileSelection(event) {
        const file = event.target.files && event.target.files[0];
        if (file) readImage(file);
    }

    chooseImageButton.addEventListener("click", () => {
        if (!isLoading && !isResizing) imageInput.click();
    });

    changeImageButton.addEventListener("click", () => {
        if (!isLoading && !isResizing) imageInput.click();
    });

    imageInput.addEventListener("change", handleFileSelection);

    widthInput.addEventListener("input", () => {
        lastEditedDimension = "width";
        updateDimensionsFromWidth();
    });

    heightInput.addEventListener("input", () => {
        lastEditedDimension = "height";
        updateDimensionsFromHeight();
    });

    aspectRatioLock.addEventListener("change", () => {
        updateRatioNote();

        if (aspectRatioLock.checked && loadedImage) {
            if (lastEditedDimension === "height") {
                updateDimensionsFromHeight();
            } else {
                updateDimensionsFromWidth();
            }
        }

        clearResult();
    });

    resolutionPreset.addEventListener("change", applyPreset);

    outputFormat.addEventListener("change", () => {
        updateQualityVisibility();
        clearResult();
        setStatus("");
    });

    qualitySlider.addEventListener("input", () => {
        qualityValue.textContent = `${qualitySlider.value}%`;
        clearResult();
    });

    resizeButton.addEventListener("click", resizeImage);

    resetButton.addEventListener("click", showUploadArea);

    uploadBox.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        if (!isLoading && !isResizing) imageInput.click();
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        uploadBox.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            uploadBox.classList.add("rc-dragging");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        uploadBox.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            uploadBox.classList.remove("rc-dragging");
        });
    });

    uploadBox.addEventListener("drop", (event) => {
        if (isLoading || isResizing) return;

        const file = event.dataTransfer?.files?.[0];
        if (file) readImage(file);
    });

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("rc-nav-open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });
    }

    $("currentYear").textContent = new Date().getFullYear();

    updateQualityVisibility();
    updateRatioNote();
})();