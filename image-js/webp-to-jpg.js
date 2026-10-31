document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const uploadBox = document.getElementById("uploadBox");
    const editor = document.getElementById("editor");

    const originalPreview = document.getElementById("originalPreview");
    const convertedPreview = document.getElementById("convertedPreview");
    const previewPlaceholder = document.getElementById("previewPlaceholder");

    const qualityInput = document.getElementById("quality");
    const qualityValue = document.getElementById("qualityValue");
    const convertButton = document.getElementById("convertButton");
    const changeImageButton = document.getElementById("changeImageButton");

    const originalSize = document.getElementById("originalSize");
    const originalDimensions = document.getElementById("originalDimensions");

    const convertedSize = document.getElementById("convertedSize");
    const convertedDimensions = document.getElementById("convertedDimensions");

    const conversionSummary = document.getElementById("conversionSummary");
    const summaryTitle = document.getElementById("summaryTitle");
    const summaryText = document.getElementById("summaryText");
    const savingsBadge = document.getElementById("savingsBadge");

    const downloadButton = document.getElementById("downloadButton");
    const statusMessage = document.getElementById("statusMessage");

    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    const MAX_PIXELS = 40_000_000;
    const MAX_DIMENSION = 12000;

    let currentFile = null;
    let sourceObjectUrl = null;
    let convertedObjectUrl = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let isProcessing = false;
    let conversionVersion = 0;

    // Mobile navigation
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("wj-nav-open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });
    }

    // Footer year
    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    function setStatus(message, type = "") {
        statusMessage.textContent = message;
        statusMessage.className = "wj-status";

        if (type === "error") {
            statusMessage.classList.add("wj-error");
        } else if (type === "success") {
            statusMessage.classList.add("wj-success");
        }
    }

    function formatBytes(bytes) {
        if (bytes === 0) return "0 Bytes";

        const units = ["Bytes", "KB", "MB", "GB"];
        const index = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        );

        return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
    }

    function clearConvertedResult() {
        conversionVersion++;

        if (convertedObjectUrl) {
            URL.revokeObjectURL(convertedObjectUrl);
            convertedObjectUrl = null;
        }

        convertedPreview.removeAttribute("src");
        convertedPreview.hidden = true;
        previewPlaceholder.hidden = false;

        convertedSize.textContent = "—";
        convertedDimensions.textContent = "—";

        conversionSummary.hidden = true;
        downloadButton.hidden = true;
        downloadButton.removeAttribute("href");
    }

    function setProcessing(processing) {
        isProcessing = processing;
        convertButton.disabled = processing;
        convertButton.textContent = processing ? "Converting..." : "Convert to JPG";
    }

    function updateQualityLabel() {
        qualityValue.textContent = `${qualityInput.value}%`;
    }

    function invalidateConversion() {
        if (!currentFile) return;

        clearConvertedResult();
        setStatus("Quality changed. Convert again to apply the new setting.");
    }

    function loadImage(file) {
        if (!file) return;

        if (file.type !== "image/webp") {
            setStatus("Please select a WebP image file.", "error");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setStatus("The image exceeds the 25 MB file-size limit.", "error");
            return;
        }

        clearConvertedResult();

        if (sourceObjectUrl) {
            URL.revokeObjectURL(sourceObjectUrl);
            sourceObjectUrl = null;
        }

        currentFile = null;
        originalWidth = 0;
        originalHeight = 0;

        sourceObjectUrl = URL.createObjectURL(file);

        const temporaryImage = new Image();

        temporaryImage.onload = () => {
            const width = temporaryImage.naturalWidth;
            const height = temporaryImage.naturalHeight;

            if (!width || !height) {
                URL.revokeObjectURL(sourceObjectUrl);
                sourceObjectUrl = null;

                setStatus("The selected image could not be read.", "error");
                return;
            }

            if (width * height > MAX_PIXELS) {
                URL.revokeObjectURL(sourceObjectUrl);
                sourceObjectUrl = null;

                setStatus(
                    "This image exceeds the 40-megapixel limit. Please select a smaller image.",
                    "error"
                );
                return;
            }

            currentFile = file;
            originalWidth = width;
            originalHeight = height;

            originalPreview.src = sourceObjectUrl;
            originalSize.textContent = formatBytes(file.size);
            originalDimensions.textContent = `${width} × ${height} px`;

            editor.hidden = false;
            uploadBox.hidden = true;

            qualityInput.value = "92";
            updateQualityLabel();

            setStatus("WebP image loaded. Choose a quality setting and convert to JPG.");

            editor.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        };

        temporaryImage.onerror = () => {
            if (sourceObjectUrl) {
                URL.revokeObjectURL(sourceObjectUrl);
                sourceObjectUrl = null;
            }

            currentFile = null;
            setStatus("Unable to open this WebP image. Please try another file.", "error");
        };

        temporaryImage.src = sourceObjectUrl;
        imageInput.value = "";
    }

    // File picker
    imageInput.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        loadImage(file);
    });

    // Drag and drop
    uploadBox.addEventListener("dragover", (event) => {
        event.preventDefault();
        uploadBox.classList.add("wj-dragover");
    });

    uploadBox.addEventListener("dragleave", (event) => {
        if (!uploadBox.contains(event.relatedTarget)) {
            uploadBox.classList.remove("wj-dragover");
        }
    });

    uploadBox.addEventListener("drop", (event) => {
        event.preventDefault();
        uploadBox.classList.remove("wj-dragover");

        const file = event.dataTransfer.files[0];
        if (file) loadImage(file);
    });

    // Change image
    changeImageButton.addEventListener("click", () => {
        imageInput.click();
    });

    // Quality slider
    qualityInput.addEventListener("input", () => {
        updateQualityLabel();
        invalidateConversion();
    });

    // Convert WebP to JPG
    convertButton.addEventListener("click", async () => {
        if (isProcessing) return;

        if (!currentFile || !sourceObjectUrl) {
            setStatus("Please upload a WebP image first.", "error");
            return;
        }

        setProcessing(true);
        clearConvertedResult();

        const thisConversion = conversionVersion;
        setStatus("Converting your image to JPG...");

        let canvas = null;

        try {
            const image = new Image();
            image.src = sourceObjectUrl;

            await image.decode();

            if (thisConversion !== conversionVersion) return;

            if (
                image.naturalWidth !== originalWidth ||
                image.naturalHeight !== originalHeight
            ) {
                throw new Error("The image dimensions changed unexpectedly. Please upload it again.");
            }

            if (
                originalWidth > MAX_DIMENSION ||
                originalHeight > MAX_DIMENSION
            ) {
                throw new Error("The image exceeds the maximum dimension of 12,000 pixels per side.");
            }

            canvas = document.createElement("canvas");
            canvas.width = originalWidth;
            canvas.height = originalHeight;

            const context = canvas.getContext("2d");

            if (!context) {
                throw new Error("Your browser could not prepare the image for conversion.");
            }

            // JPG does not support transparency, so fill the canvas white first.
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);

            context.drawImage(image, 0, 0);

            const quality = Number(qualityInput.value) / 100;

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    (result) => {
                        if (!result) {
                            reject(new Error("The browser failed to create the JPG image."));
                            return;
                        }

                        resolve(result);
                    },
                    "image/jpeg",
                    quality
                );
            });

            if (thisConversion !== conversionVersion) return;

            if (blob.type !== "image/jpeg") {
                throw new Error(
                    "Your browser could not export a JPG image. Please try an updated browser."
                );
            }

            convertedObjectUrl = URL.createObjectURL(blob);

            convertedPreview.src = convertedObjectUrl;
            convertedPreview.hidden = false;
            previewPlaceholder.hidden = true;

            convertedSize.textContent = formatBytes(blob.size);
            convertedDimensions.textContent = `${originalWidth} × ${originalHeight} px`;

            downloadButton.href = convertedObjectUrl;
            downloadButton.download = "digifox-converted.jpg";
            downloadButton.hidden = false;

            const difference = currentFile.size - blob.size;
            const percentage = (difference / currentFile.size) * 100;

            if (difference > 0) {
                summaryTitle.textContent = "Image size reduced!";
                summaryText.textContent =
                    `The JPG image is ${formatBytes(difference)} smaller than the original WebP.`;
                savingsBadge.textContent = `${percentage.toFixed(1)}% smaller`;
            } else if (difference < 0) {
                summaryTitle.textContent = "Conversion complete";
                summaryText.textContent =
                    `The JPG image is ${formatBytes(Math.abs(difference))} larger than the original WebP.`;
                savingsBadge.textContent = `${Math.abs(percentage).toFixed(1)}% larger`;
            } else {
                summaryTitle.textContent = "Conversion complete";
                summaryText.textContent =
                    "The converted image is approximately the same size as the original.";
                savingsBadge.textContent = "Same size";
            }

            conversionSummary.hidden = false;
            setStatus("Your JPG image is ready to download.", "success");

            convertedPreview.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

        } catch (error) {
            if (thisConversion === conversionVersion) {
                clearConvertedResult();

                setStatus(
                    error.message || "Something went wrong during conversion.",
                    "error"
                );
            }
        } finally {
            if (canvas) {
                canvas.width = 1;
                canvas.height = 1;
            }

            setProcessing(false);
        }
    });

    // Release temporary browser resources.
    window.addEventListener("beforeunload", () => {
        if (sourceObjectUrl) {
            URL.revokeObjectURL(sourceObjectUrl);
        }

        if (convertedObjectUrl) {
            URL.revokeObjectURL(convertedObjectUrl);
        }
    });

    updateQualityLabel();
});