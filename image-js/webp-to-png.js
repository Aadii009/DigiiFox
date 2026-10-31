"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const uploadBox = document.getElementById("uploadBox");
    const chooseImageButton = document.getElementById("chooseImageButton");
    const editor = document.getElementById("editor");
    const originalPreview = document.getElementById("originalPreview");
    const convertedPreview = document.getElementById("convertedPreview");
    const previewPlaceholder = document.getElementById("previewPlaceholder");
    const originalSize = document.getElementById("originalSize");
    const originalDimensions = document.getElementById("originalDimensions");
    const convertedSize = document.getElementById("convertedSize");
    const convertedDimensions = document.getElementById("convertedDimensions");
    const convertedFormat = document.getElementById("convertedFormat");
    const conversionSummary = document.getElementById("conversionSummary");
    const summaryTitle = document.getElementById("summaryTitle");
    const summaryText = document.getElementById("summaryText");
    const convertButton = document.getElementById("convertButton");
    const changeImageButton = document.getElementById("changeImageButton");
    const resetButton = document.getElementById("resetButton");
    const downloadButton = document.getElementById("downloadButton");
    const statusMessage = document.getElementById("statusMessage");
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const currentYear = document.getElementById("currentYear");

    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    const MAX_PIXELS = 40_000_000;
    const MAX_DIMENSION = 12000;

    let selectedFile = null;
    let originalUrl = null;
    let convertedUrl = null;
    let isConverting = false;

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    function showStatus(message, type = "error") {
        statusMessage.textContent = message;
        statusMessage.className = "wp-status" + (type === "success" ? " success" : "");
    }

    function clearStatus() {
        statusMessage.textContent = "";
        statusMessage.className = "wp-status";
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0) return "—";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function formatDimensions(width, height) {
        return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
    }

    function revokeUrl(url) {
        if (url) URL.revokeObjectURL(url);
    }

    function clearConvertedImage() {
        revokeUrl(convertedUrl);
        convertedUrl = null;

        convertedPreview.removeAttribute("src");
        convertedPreview.hidden = true;
        previewPlaceholder.hidden = false;

        convertedSize.textContent = "—";
        convertedDimensions.textContent = "—";
        convertedFormat.textContent = "PNG";

        downloadButton.removeAttribute("href");
        downloadButton.hidden = true;

        summaryTitle.textContent = "Ready to convert";
        summaryText.textContent = "Your PNG image will appear here after conversion.";
    }

    function resetTool() {
        selectedFile = null;
        isConverting = false;

        revokeUrl(originalUrl);
        originalUrl = null;

        clearConvertedImage();

        imageInput.value = "";
        originalPreview.removeAttribute("src");
        originalSize.textContent = "—";
        originalDimensions.textContent = "—";

        editor.hidden = true;
        uploadBox.hidden = false;
        convertButton.disabled = false;
        convertButton.textContent = "Convert to PNG";
        clearStatus();
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("The image could not be opened. Please try another WebP file."));
            image.src = url;
        });
    }

    async function handleFile(file) {
        clearStatus();

        if (!file) return;

        if (isConverting) {
            showStatus("Please wait for the current conversion to finish.");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showStatus("This file is larger than 25 MB. Please choose a smaller WebP image.");
            return;
        }

        const isWebP =
            file.type === "image/webp" ||
            /\.webp$/i.test(file.name);

        if (!isWebP) {
            showStatus("Please select a WebP image (.webp).");
            return;
        }

        let temporaryUrl = URL.createObjectURL(file);

        try {
            const image = await loadImage(temporaryUrl);
            const pixels = image.naturalWidth * image.naturalHeight;

            if (!image.naturalWidth || !image.naturalHeight) {
                throw new Error("The image has invalid dimensions.");
            }

            if (
                image.naturalWidth > MAX_DIMENSION ||
                image.naturalHeight > MAX_DIMENSION ||
                pixels > MAX_PIXELS
            ) {
                throw new Error(
                    "This image is too large to process safely. Maximum dimensions are 12,000 px per side and 40 megapixels overall."
                );
            }

            resetTool();

            selectedFile = file;
            originalUrl = temporaryUrl;
            temporaryUrl = null;

            originalPreview.src = originalUrl;
            originalSize.textContent = formatBytes(file.size);
            originalDimensions.textContent = formatDimensions(
                image.naturalWidth,
                image.naturalHeight
            );

            editor.hidden = false;
            uploadBox.hidden = true;

            showStatus("Image loaded successfully. You can now convert it to PNG.", "success");
        } catch (error) {
            showStatus(error.message || "Unable to load this image.");
        } finally {
            revokeUrl(temporaryUrl);
        }
    }

    function canvasToPng(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("PNG conversion failed. Your browser may not have enough memory."));
                    return;
                }

                resolve(blob);
            }, "image/png");
        });
    }

    async function convertImage() {
        if (!selectedFile || isConverting) return;

        isConverting = true;
        convertButton.disabled = true;
        convertButton.textContent = "Converting...";
        clearStatus();

        try {
            const image = await loadImage(originalUrl);
            const canvas = document.createElement("canvas");

            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            const context = canvas.getContext("2d");

            if (!context) {
                throw new Error("Your browser could not start the image converter.");
            }

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0);

            const pngBlob = await canvasToPng(canvas);
            canvas.width = 0;
            canvas.height = 0;

            revokeUrl(convertedUrl);
            convertedUrl = URL.createObjectURL(pngBlob);

            convertedPreview.onload = () => {
                previewPlaceholder.hidden = true;
                convertedPreview.hidden = false;
            };

            convertedPreview.src = convertedUrl;

            convertedSize.textContent = formatBytes(pngBlob.size);
            convertedDimensions.textContent = formatDimensions(
                image.naturalWidth,
                image.naturalHeight
            );
            convertedFormat.textContent = "PNG";

            downloadButton.href = convertedUrl;
            downloadButton.download = "digifox-converted.png";
            downloadButton.hidden = false;

            const difference = pngBlob.size - selectedFile.size;

            summaryTitle.textContent = "Conversion complete!";

            if (difference < 0) {
                summaryText.textContent =
                    `The PNG is ${formatBytes(Math.abs(difference))} smaller than the original WebP. File size can vary by image.`;
            } else if (difference > 0) {
                summaryText.textContent =
                    `The PNG is ${formatBytes(difference)} larger than the original WebP. This is normal for many PNG conversions.`;
            } else {
                summaryText.textContent = "The converted PNG and original WebP have the same file size.";
            }

            showStatus("Your PNG image is ready to download.", "success");
        } catch (error) {
            showStatus(error.message || "Something went wrong during conversion.");
        } finally {
            isConverting = false;
            convertButton.disabled = false;
            convertButton.textContent = "Convert to PNG";
        }
    }

    chooseImageButton.addEventListener("click", (event) => {
        event.stopPropagation();
        imageInput.click();
    });

    uploadBox.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        imageInput.click();
    });

    uploadBox.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            imageInput.click();
        }
    });

    imageInput.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) handleFile(file);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        uploadBox.addEventListener(eventName, (event) => {
            event.preventDefault();
            uploadBox.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        uploadBox.addEventListener(eventName, (event) => {
            event.preventDefault();
            uploadBox.classList.remove("dragover");
        });
    });

    uploadBox.addEventListener("drop", (event) => {
        const file = event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    convertButton.addEventListener("click", convertImage);
    changeImageButton.addEventListener("click", () => {
        if (!isConverting) imageInput.click();
    });
    resetButton.addEventListener("click", resetTool);

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });
    }

    window.addEventListener("beforeunload", () => {
        revokeUrl(originalUrl);
        revokeUrl(convertedUrl);
    });
});