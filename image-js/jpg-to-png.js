document.addEventListener("DOMContentLoaded", () => {
    const uploadZone = document.getElementById("uploadZone");
    const imageInput = document.getElementById("imageInput");
    const chooseImageButton = document.getElementById("chooseImageButton");

    const statusMessage = document.getElementById("statusMessage");
    const previewArea = document.getElementById("previewArea");

    const originalPreview = document.getElementById("originalPreview");
    const convertedPreview = document.getElementById("convertedPreview");
    const resultPlaceholder = document.getElementById("resultPlaceholder");

    const originalFileName = document.getElementById("originalFileName");
    const originalFileDetails = document.getElementById("originalFileDetails");
    const convertedFileName = document.getElementById("convertedFileName");
    const convertedFileDetails = document.getElementById("convertedFileDetails");

    const conversionSummary = document.getElementById("conversionSummary");
    const summaryText = document.getElementById("summaryText");

    const downloadButton = document.getElementById("downloadButton");
    const resetButton = document.getElementById("resetButton");
    const convertAnotherButton = document.getElementById("convertAnotherButton");

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const currentYear = document.getElementById("currentYear");

    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    const MAX_IMAGE_PIXELS = 40000000;

    let originalObjectUrl = null;
    let convertedObjectUrl = null;
    let currentDownloadUrl = null;
    let currentDownloadName = "";

    // Set the footer year.
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    // Human-readable file sizes.
    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    // Display a status message.
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
        statusMessage.className = "status-message";
        statusMessage.hidden = true;
    }

    // Release temporary browser URLs.
    function releaseObjectUrls() {
        if (originalObjectUrl) {
            URL.revokeObjectURL(originalObjectUrl);
            originalObjectUrl = null;
        }

        if (convertedObjectUrl) {
            URL.revokeObjectURL(convertedObjectUrl);
            convertedObjectUrl = null;
        }

        currentDownloadUrl = null;
        currentDownloadName = "";
    }

    // Reset the interface and prepare for another image.
    function resetTool() {
        releaseObjectUrls();

        imageInput.value = "";

        originalPreview.removeAttribute("src");
        convertedPreview.removeAttribute("src");

        originalFileName.textContent = "original.jpg";
        originalFileDetails.textContent = "—";

        convertedFileName.textContent = "Your image.png";
        convertedFileDetails.textContent = "Waiting for conversion";

        convertedPreview.hidden = true;
        resultPlaceholder.hidden = false;

        previewArea.hidden = true;
        conversionSummary.hidden = true;
        downloadButton.disabled = true;

        clearStatus();
    }

    // Accept only JPG/JPEG files.
    function isJpegFile(file) {
        const nameIsJpeg = /\.(jpe?g)$/i.test(file.name);
        const typeIsJpeg = file.type === "image/jpeg";

        return nameIsJpeg && typeIsJpeg;
    }

    // Open the system file picker.
    function openFilePicker() {
        imageInput.click();
    }

    chooseImageButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openFilePicker();
    });

    uploadZone.addEventListener("click", (event) => {
        // Avoid opening the picker twice when the button is clicked.
        if (event.target.closest("button")) {
            return;
        }

        openFilePicker();
    });

    // Keyboard accessibility for the upload area.
    uploadZone.addEventListener("keydown", (event) => {
        if (event.target !== uploadZone) {
            return;
        }

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
        }
    });

    // File picker selection.
    imageInput.addEventListener("change", () => {
        const file = imageInput.files?.[0];

        if (file) {
            processFile(file);
        }
    });

    // Drag and drop.
    ["dragenter", "dragover"].forEach((eventName) => {
        uploadZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();

            uploadZone.classList.add("drag-over");
        });
    });

    ["dragleave", "dragend"].forEach((eventName) => {
        uploadZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();

            uploadZone.classList.remove("drag-over");
        });
    });

    uploadZone.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();

        uploadZone.classList.remove("drag-over");

        const file = event.dataTransfer?.files?.[0];

        if (file) {
            // Clear the previous input selection.
            imageInput.value = "";
            processFile(file);
        }
    });

    // Validate and process the selected image.
    function processFile(file) {
        clearStatus();

        if (!isJpegFile(file)) {
            showStatus(
                "Please select a valid JPG or JPEG image. Other image formats are not supported by this tool.",
                "error"
            );
            return;
        }

        if (file.size === 0) {
            showStatus("This file is empty. Please choose another image.", "error");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showStatus(
                "This image exceeds the 25 MB limit. Please choose a smaller JPG file.",
                "error"
            );
            return;
        }

        resetTool();
        clearStatus();

        originalObjectUrl = URL.createObjectURL(file);

        const image = new Image();

        image.onload = () => {
            const width = image.naturalWidth;
            const height = image.naturalHeight;
            const totalPixels = width * height;

            if (!width || !height) {
                showStatus("The selected image has invalid dimensions.", "error");
                return;
            }

            if (totalPixels > MAX_IMAGE_PIXELS) {
                showStatus(
                    "This image has very large dimensions. For browser stability, please choose an image with 40 megapixels or fewer.",
                    "error"
                );
                return;
            }

            originalPreview.src = originalObjectUrl;
            originalPreview.alt = `Preview of ${file.name}`;

            originalFileName.textContent = file.name;
            originalFileDetails.textContent =
                `${width.toLocaleString()} × ${height.toLocaleString()} px · ${formatFileSize(file.size)}`;

            previewArea.hidden = false;

            showStatus("Image loaded. Converting it to PNG…");

            convertToPng(image, file, width, height);
        };

        image.onerror = () => {
            showStatus(
                "The image could not be opened. Please try another valid JPG file.",
                "error"
            );
        };

        image.src = originalObjectUrl;
    }

    // Convert the loaded image using the browser canvas API.
    function convertToPng(image, file, width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
            showStatus(
                "Your browser could not create an image canvas. Try a modern browser.",
                "error"
            );
            canvas.width = 0;
            canvas.height = 0;
            return;
        }

        try {
            context.drawImage(image, 0, 0, width, height);
        } catch (error) {
            canvas.width = 0;
            canvas.height = 0;

            showStatus(
                "The image could not be processed. Please try a different file.",
                "error"
            );
            return;
        }

        canvas.toBlob((blob) => {
            // Release canvas memory after encoding.
            canvas.width = 0;
            canvas.height = 0;

            if (!blob) {
                showStatus(
                    "PNG conversion failed. Please try another image or browser.",
                    "error"
                );
                return;
            }

            convertedObjectUrl = URL.createObjectURL(blob);
            currentDownloadUrl = convertedObjectUrl;

            const baseName = file.name.replace(/\.jpe?g$/i, "");
            currentDownloadName = `${baseName || "converted-image"}.png`;

            convertedPreview.src = convertedObjectUrl;
            convertedPreview.alt = `Converted PNG preview of ${file.name}`;
            convertedPreview.hidden = false;
            resultPlaceholder.hidden = true;

            convertedFileName.textContent = currentDownloadName;
            convertedFileDetails.textContent =
                `${width.toLocaleString()} × ${height.toLocaleString()} px · ${formatFileSize(blob.size)}`;

            const difference = blob.size - file.size;
            let sizeMessage;

            if (difference < 0) {
                const reduction = ((Math.abs(difference) / file.size) * 100).toFixed(1);
                sizeMessage = `The PNG is ${reduction}% smaller than the original JPG.`;
            } else if (difference > 0) {
                const increase = ((difference / file.size) * 100).toFixed(1);
                sizeMessage = `The PNG is ${increase}% larger than the original JPG.`;
            } else {
                sizeMessage = "The original and converted files have the same file size.";
            }

            summaryText.textContent =
                `${formatFileSize(file.size)} → ${formatFileSize(blob.size)}. ${sizeMessage}`;

            conversionSummary.hidden = false;
            downloadButton.disabled = false;

            showStatus("Your image has been converted successfully.", "success");

        }, "image/png");
    }

    // Download the converted image.
    downloadButton.addEventListener("click", () => {
        if (!currentDownloadUrl || !currentDownloadName) {
            showStatus("Convert an image before downloading.", "error");
            return;
        }

        const link = document.createElement("a");
        link.href = currentDownloadUrl;
        link.download = currentDownloadName;

        document.body.appendChild(link);
        link.click();
        link.remove();
    });

    // Reset buttons.
    resetButton.addEventListener("click", resetTool);
    convertAnotherButton.addEventListener("click", () => {
        resetTool();
        openFilePicker();
    });

    // Mobile navigation.
    menuToggle.addEventListener("click", () => {
        const isOpen = mainNav.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation" : "Open navigation"
        );
    });

    mainNav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            mainNav.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            mainNav.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
        }
    });

    // Release temporary URLs when leaving the page.
    window.addEventListener("pagehide", releaseObjectUrls);
});