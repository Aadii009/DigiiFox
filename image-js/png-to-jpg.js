document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const browseButton = document.getElementById("browseButton");
    const uploadArea = document.getElementById("uploadArea");

    const originalPreview = document.getElementById("originalPreview");
    const outputPreview = document.getElementById("outputPreview");

    const originalPreviewBox = document.getElementById("originalPreviewBox");
    const outputPreviewBox = document.getElementById("outputPreviewBox");

    const originalDetails = document.getElementById("originalDetails");
    const outputDetails = document.getElementById("outputDetails");

    const qualitySlider = document.getElementById("qualitySlider");
    const qualityValue = document.getElementById("qualityValue");

    const downloadButton = document.getElementById("downloadButton");
    const resetButton = document.getElementById("resetButton");
    const statusMessage = document.getElementById("statusMessage");
    const currentYear = document.getElementById("currentYear");

    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    const MAX_PIXELS = 40_000_000;

    let originalImage = null;
    let originalObjectUrl = null;
    let outputObjectUrl = null;
    let outputBlob = null;
    let originalFileName = "image";
    let conversionVersion = 0;

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    function showStatus(message, type = "info") {
        statusMessage.textContent = message;
        statusMessage.className = "status-message";

        if (type === "error") {
            statusMessage.classList.add("error");
        } else if (type === "success") {
            statusMessage.classList.add("success");
        }

        statusMessage.hidden = false;
    }

    function clearStatus() {
        statusMessage.textContent = "";
        statusMessage.hidden = true;
        statusMessage.className = "status-message";
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0) {
            return "—";
        }

        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function formatDimensions(width, height) {
        return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
    }

    function revokeUrl(url) {
        if (url) {
            URL.revokeObjectURL(url);
        }
    }

    function setEmptyPreview(container, message) {
        container.innerHTML = "";

        const placeholder = document.createElement("div");
        placeholder.className = "empty-preview";
        placeholder.textContent = message;

        container.appendChild(placeholder);
    }

    function showPreview(container, image, altText) {
        container.innerHTML = "";

        image.alt = altText;
        image.hidden = false;

        container.appendChild(image);
    }

    function updateOriginalDetails(file, width, height) {
        originalDetails.innerHTML = "";

        const size = document.createElement("span");
        size.textContent = `File size: ${formatBytes(file.size)}`;

        const dimensions = document.createElement("span");
        dimensions.textContent = `Dimensions: ${formatDimensions(width, height)}`;

        originalDetails.append(size, dimensions);
    }

    function updateOutputDetails(blob, width, height) {
        outputDetails.innerHTML = "";

        const size = document.createElement("span");
        size.textContent = `File size: ${formatBytes(blob.size)}`;

        const dimensions = document.createElement("span");
        dimensions.textContent = `Dimensions: ${formatDimensions(width, height)}`;

        outputDetails.append(size, dimensions);
    }

    function resetTool() {
        // Invalidate any conversion that has not completed yet.
        conversionVersion++;

        revokeUrl(originalObjectUrl);
        revokeUrl(outputObjectUrl);

        originalObjectUrl = null;
        outputObjectUrl = null;
        originalImage = null;
        outputBlob = null;
        originalFileName = "image";

        imageInput.value = "";

        originalPreview.removeAttribute("src");
        outputPreview.removeAttribute("src");

        originalPreview.hidden = true;
        outputPreview.hidden = true;

        setEmptyPreview(
            originalPreviewBox,
            "Your original image will appear here."
        );

        setEmptyPreview(
            outputPreviewBox,
            "Your converted image will appear here."
        );

        originalDetails.innerHTML = "";
        outputDetails.innerHTML = "";

        const originalSize = document.createElement("span");
        originalSize.textContent = "File size: —";

        const originalDimensions = document.createElement("span");
        originalDimensions.textContent = "Dimensions: —";

        originalDetails.append(originalSize, originalDimensions);

        const outputSize = document.createElement("span");
        outputSize.textContent = "File size: —";

        const outputDimensions = document.createElement("span");
        outputDimensions.textContent = "Dimensions: —";

        outputDetails.append(outputSize, outputDimensions);

        downloadButton.disabled = true;
        qualitySlider.disabled = false;

        clearStatus();
    }

    function validateFile(file) {
        if (!file) {
            return "Please select a PNG image.";
        }

        const isPng =
            file.type === "image/png" ||
            file.name.toLowerCase().endsWith(".png");

        if (!isPng) {
            return "Please select a PNG file.";
        }

        if (file.size === 0) {
            return "This file is empty. Please select another image.";
        }

        if (file.size > MAX_FILE_SIZE) {
            return "The image is larger than 25 MB. Please choose a smaller file.";
        }

        return null;
    }

    function processFile(file) {
        const error = validateFile(file);

        if (error) {
            showStatus(error, "error");
            return;
        }

        resetTool();

        originalFileName = file.name.replace(/\.png$/i, "") || "image";
        originalObjectUrl = URL.createObjectURL(file);

        showStatus("Loading your PNG image...");

        const image = new Image();

        image.onload = () => {
            const width = image.naturalWidth;
            const height = image.naturalHeight;

            if (!width || !height) {
                resetTool();
                showStatus("The selected image could not be read.", "error");
                return;
            }

            if (width * height > MAX_PIXELS) {
                resetTool();
                showStatus(
                    "This image exceeds the 40-megapixel limit. Please use a smaller image.",
                    "error"
                );
                return;
            }

            originalImage = image;

            originalPreview.src = originalObjectUrl;
            showPreview(
                originalPreviewBox,
                originalPreview,
                "Original PNG image preview"
            );

            updateOriginalDetails(file, width, height);

            convertImage();
        };

        image.onerror = () => {
            resetTool();
            showStatus(
                "Unable to open this PNG image. Please try another file.",
                "error"
            );
        };

        image.src = originalObjectUrl;
    }

    function convertImage() {
        if (!originalImage) {
            return;
        }

        const thisConversion = ++conversionVersion;
        const quality = Number(qualitySlider.value) / 100;

        qualityValue.textContent = `${qualitySlider.value}%`;
        downloadButton.disabled = true;

        showStatus("Converting your image to JPG...");

        const canvas = document.createElement("canvas");
        canvas.width = originalImage.naturalWidth;
        canvas.height = originalImage.naturalHeight;

        const context = canvas.getContext("2d", {
            alpha: false
        });

        if (!context) {
            showStatus(
                "Your browser could not create the image canvas. Try another browser.",
                "error"
            );
            return;
        }

        // JPG does not support transparency, so flatten it onto white.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.drawImage(originalImage, 0, 0);

        canvas.toBlob(
            (blob) => {
                // Ignore results from older conversions.
                if (thisConversion !== conversionVersion) {
                    return;
                }

                if (!blob) {
                    showStatus(
                        "Conversion failed. Please try a different image or browser.",
                        "error"
                    );
                    return;
                }

                revokeUrl(outputObjectUrl);

                outputBlob = blob;
                outputObjectUrl = URL.createObjectURL(blob);

                outputPreview.src = outputObjectUrl;

                showPreview(
                    outputPreviewBox,
                    outputPreview,
                    "Converted JPG image preview"
                );

                updateOutputDetails(
                    blob,
                    originalImage.naturalWidth,
                    originalImage.naturalHeight
                );

                downloadButton.disabled = false;

                const originalSize = Number(
                    originalDetails.children[0]?.textContent
                        ?.match(/[\d.]+/)?.[0]
                );

                const originalBytes = originalSize || 0;

                let comparisonMessage = "Conversion completed successfully.";

                if (blob.size > 0 && originalBytes > 0) {
                    // File size comparison is presented using actual byte counts
                    // below, without relying on rounded display strings.
                    comparisonMessage = "Conversion completed successfully.";
                }

                showStatus(
                    `${comparisonMessage} Your JPG image is ready to download.`,
                    "success"
                );

                canvas.width = 0;
                canvas.height = 0;
            },
            "image/jpeg",
            quality
        );
    }

    browseButton.addEventListener("click", () => {
        imageInput.click();
    });

    uploadArea.addEventListener("click", (event) => {
        if (
            event.target === uploadArea ||
            event.target.closest(".upload-icon") ||
            event.target.closest("h3") ||
            event.target.closest("p")
        ) {
            imageInput.click();
        }
    });

    imageInput.addEventListener("change", (event) => {
        const file = event.target.files[0];

        if (file) {
            processFile(file);
        }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        uploadArea.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();

            uploadArea.classList.add("drag-over");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        uploadArea.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();

            uploadArea.classList.remove("drag-over");
        });
    });

    uploadArea.addEventListener("drop", (event) => {
        const files = event.dataTransfer.files;

        if (files.length > 0) {
            processFile(files[0]);
        }
    });

    qualitySlider.addEventListener("input", () => {
        qualityValue.textContent = `${qualitySlider.value}%`;

        if (originalImage) {
            convertImage();
        }
    });

    downloadButton.addEventListener("click", () => {
        if (!outputBlob || !outputObjectUrl) {
            showStatus("Please convert an image before downloading.", "error");
            return;
        }

        const link = document.createElement("a");

        link.href = outputObjectUrl;
        link.download = `${originalFileName}.jpg`;

        document.body.appendChild(link);
        link.click();
        link.remove();
    });

    resetButton.addEventListener("click", resetTool);

    // Mobile navigation
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("active");

            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });

        mainNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                mainNav.classList.remove("active");
                menuToggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    window.addEventListener("pagehide", () => {
        revokeUrl(originalObjectUrl);
        revokeUrl(outputObjectUrl);
    });
});