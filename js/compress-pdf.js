const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const changeFileBtn = document.getElementById("changeFileBtn");
const dropArea = document.getElementById("dropArea");

const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileMeta = document.getElementById("fileMeta");

const compressionOptions = document.getElementById("compressionOptions");
const compressBtn = document.getElementById("compressBtn");

const originalSize = document.getElementById("originalSize");
const newSize = document.getElementById("newSize");
const sizeDifference = document.getElementById("sizeDifference");

const statusMessage = document.getElementById("statusMessage");
const downloadArea = document.getElementById("downloadArea");

document.getElementById("year").textContent = new Date().getFullYear();

let selectedFile = null;
let loadedPdf = null;
let isProcessing = false;
let downloadUrl = null;

/* Format bytes */

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/* Display status */

function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

/* Validate the selected file */

function isPdfFile(file) {
    return (
        file.name.toLowerCase().endsWith(".pdf") &&
        (
            file.type === "application/pdf" ||
            file.type === "" ||
            file.type === "application/x-pdf"
        )
    );
}

/* Clean up old download */

function clearPreviousDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
    }

    downloadArea.replaceChildren();
    downloadArea.hidden = true;

    newSize.textContent = "—";
    sizeDifference.textContent = "—";
}

/* Open file picker */

browseBtn.addEventListener("click", () => {
    if (!isProcessing) {
        fileInput.click();
    }
});

changeFileBtn.addEventListener("click", () => {
    if (!isProcessing) {
        fileInput.click();
    }
});

dropArea.addEventListener("click", (event) => {
    if (
        !isProcessing &&
        !event.target.closest("button")
    ) {
        fileInput.click();
    }
});

dropArea.addEventListener("keydown", (event) => {
    if (
        !isProcessing &&
        (event.key === "Enter" || event.key === " ")
    ) {
        event.preventDefault();
        fileInput.click();
    }
});

/* File selection */

fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (file) {
        loadPdf(file);
    }

    fileInput.value = "";
});

/* Drag and drop */

["dragenter", "dragover"].forEach((eventName) => {
    dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!isProcessing) {
            dropArea.classList.add("drag-over");
        }
    });
});

["dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();

        dropArea.classList.remove("drag-over");
    });
});

dropArea.addEventListener("drop", (event) => {
    if (isProcessing) {
        return;
    }

    const file = event.dataTransfer.files[0];

    if (file) {
        loadPdf(file);
    }
});

/* Load PDF */

async function loadPdf(file) {
    if (isProcessing) {
        return;
    }

    clearPreviousDownload();

    selectedFile = null;
    loadedPdf = null;

    fileInfo.hidden = true;
    compressionOptions.hidden = true;

    if (!isPdfFile(file)) {
        showStatus("Please select a valid PDF file.", "error");
        return;
    }

    if (!window.PDFLib) {
        showStatus(
            "PDF processing library unavailable. Check your internet connection and reload the page.",
            "error"
        );

        return;
    }

    showStatus("Reading your PDF...", "info");

    try {
        const buffer = await file.arrayBuffer();

        const pdf = await PDFLib.PDFDocument.load(buffer);

        selectedFile = file;
        loadedPdf = pdf;

        fileName.textContent = file.name;

        fileMeta.textContent =
            `${pdf.getPageCount()} page(s) · ${formatFileSize(file.size)}`;

        originalSize.textContent = formatFileSize(file.size);

        fileInfo.hidden = false;
        compressionOptions.hidden = false;

        showStatus(
            "PDF loaded successfully. Choose an optimization mode.",
            "success"
        );

    } catch (error) {
        console.error("PDF loading error:", error);

        showStatus(
            "Could not open this PDF. It may be damaged, encrypted, or unsupported.",
            "error"
        );
    }
}

/* Safe output filename */

function safeBaseName(filename) {
    return filename
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .replace(/[. ]+$/g, "")
        .slice(0, 100) || "document";
}

/* Disable buttons while processing */

function setProcessingState(processing) {
    isProcessing = processing;

    compressBtn.disabled = processing;
    browseBtn.disabled = processing;
    changeFileBtn.disabled = processing;

    compressBtn.textContent = processing
        ? "Optimizing PDF..."
        : "Optimize PDF";
}

/* Optimize PDF */

compressBtn.addEventListener("click", optimizePdf);

async function optimizePdf() {
    if (isProcessing || !selectedFile || !loadedPdf) {
        return;
    }

    if (!window.PDFLib) {
        showStatus("The PDF library is unavailable.", "error");
        return;
    }

    clearPreviousDownload();
    setProcessingState(true);

    try {
        const mode = document.querySelector(
            'input[name="compressionMode"]:checked'
        ).value;

        showStatus(
            "Optimizing your PDF in the browser...",
            "info"
        );

        let saveOptions = {};

        if (mode === "balanced") {
            saveOptions = {
                useObjectStreams: true
            };
        }

        else if (mode === "quality") {
            saveOptions = {
                useObjectStreams: false
            };
        }

        else if (mode === "compact") {
            saveOptions = {
                useObjectStreams: true,
                addDefaultPage: false
            };
        }

        /*
         * This rewrites the PDF using PDF-Lib.
         * It does not recompress embedded images.
         */

        const optimizedBytes = await loadedPdf.save(saveOptions);

        const optimizedBlob = new Blob(
            [optimizedBytes],
            { type: "application/pdf" }
        );

        const originalBytes = selectedFile.size;
        const optimizedBytesLength = optimizedBlob.size;

        originalSize.textContent = formatFileSize(originalBytes);
        newSize.textContent = formatFileSize(optimizedBytesLength);

        const difference = originalBytes - optimizedBytesLength;

        if (difference > 0) {
            const percentage = (
                difference / originalBytes
            ) * 100;

            sizeDifference.textContent =
                `${formatFileSize(difference)} smaller (${percentage.toFixed(1)}%)`;

            showStatus(
                "Optimization complete. Your resulting PDF is smaller.",
                "success"
            );

        } else if (difference < 0) {
            const increase = Math.abs(difference);

            const percentage = (
                increase / originalBytes
            ) * 100;

            sizeDifference.textContent =
                `${formatFileSize(increase)} larger (${percentage.toFixed(1)}%)`;

            showStatus(
                "The new PDF is larger than the original. Try another mode or keep your original file.",
                "info"
            );

        } else {
            sizeDifference.textContent = "No size change";

            showStatus(
                "The PDF size did not change. This document may already be optimized.",
                "info"
            );
        }

        downloadUrl = URL.createObjectURL(optimizedBlob);

        const downloadLink = document.createElement("a");

        downloadLink.href = downloadUrl;
        downloadLink.download =
            `${safeBaseName(selectedFile.name)}-optimized.pdf`;

        downloadLink.className = "download-link";
        downloadLink.textContent = "Download optimized PDF";

        downloadArea.appendChild(downloadLink);
        downloadArea.hidden = false;

    } catch (error) {
        console.error("PDF optimization error:", error);

        showStatus(
            "Could not process this PDF. It may be damaged, encrypted, or unsupported.",
            "error"
        );

    } finally {
        setProcessingState(false);
    }
}

/* Remove the old result when selecting another file */

fileInput.addEventListener("click", clearPreviousDownload);