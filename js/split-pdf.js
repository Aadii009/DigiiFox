const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const dropArea = document.getElementById("dropArea");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileMeta = document.getElementById("fileMeta");
const changeFileBtn = document.getElementById("changeFileBtn");

const splitOptions = document.getElementById("splitOptions");
const extractControls = document.getElementById("extractControls");
const rangeControls = document.getElementById("rangeControls");
const individualControls = document.getElementById("individualControls");

const pageInput = document.getElementById("pageInput");
const rangeInput = document.getElementById("rangeInput");

const splitBtn = document.getElementById("splitBtn");
const statusMessage = document.getElementById("statusMessage");
const downloadArea = document.getElementById("downloadArea");

const yearElement = document.getElementById("year");

yearElement.textContent = new Date().getFullYear();

let selectedFile = null;
let loadedPdf = null;
let pageCount = 0;
let isProcessing = false;
let activeDownloadUrls = [];

/* Status messages */

function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

/* File size formatting */

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/* Clean up previous download URLs */

function clearDownloads() {
    activeDownloadUrls.forEach((url) => {
        URL.revokeObjectURL(url);
    });

    activeDownloadUrls = [];
    downloadArea.replaceChildren();
    downloadArea.hidden = true;
}

/* Check file type */

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

/* Open the file selector */

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
        loadSelectedFile(file);
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
        loadSelectedFile(file);
    }
});

/* Load the selected PDF */

async function loadSelectedFile(file) {
    if (isProcessing) {
        return;
    }

    clearDownloads();

    selectedFile = null;
    loadedPdf = null;
    pageCount = 0;

    splitOptions.hidden = true;
    fileInfo.hidden = true;

    if (!isPdfFile(file)) {
        showStatus("Please select a PDF file.", "error");
        return;
    }

    if (!window.PDFLib) {
        showStatus(
            "The PDF library failed to load. Check your internet connection and reload the page.",
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
        pageCount = pdf.getPageCount();

        fileName.textContent = file.name;

        fileMeta.textContent =
            `${pageCount} page${pageCount === 1 ? "" : "s"} · ${formatFileSize(file.size)}`;

        fileInfo.hidden = false;
        splitOptions.hidden = false;

        pageInput.value = "";
        rangeInput.value = "";

        showStatus(
            `PDF loaded successfully. It contains ${pageCount} page(s).`,
            "success"
        );

        updateMode();

    } catch (error) {
        console.error("PDF loading error:", error);

        showStatus(
            "This PDF could not be opened. It may be damaged, encrypted, or unsupported.",
            "error"
        );
    }
}

/* Change splitting mode */

document.querySelectorAll('input[name="splitMode"]').forEach((radio) => {
    radio.addEventListener("change", updateMode);
});

function getSelectedMode() {
    return document.querySelector('input[name="splitMode"]:checked').value;
}

function updateMode() {
    const mode = getSelectedMode();

    extractControls.hidden = mode !== "extract";
    rangeControls.hidden = mode !== "ranges";
    individualControls.hidden = mode !== "individual";
}

/* Parse page numbers and ranges.
   Examples: 1,3,5-8 or 2-4 */

function parsePageSelection(input, totalPages) {
    const value = input.trim();

    if (!value) {
        throw new Error("Enter the pages you want to process.");
    }

    const tokens = value.split(",").map((token) => token.trim());

    if (tokens.some((token) => token === "")) {
        throw new Error("Please check your commas and page ranges.");
    }

    const pages = [];

    for (const token of tokens) {
        const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);

        if (!match) {
            throw new Error(
                `Invalid page selection: "${token}". Use numbers and ranges such as 1, 3-5.`
            );
        }

        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : start;

        if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start < 1 ||
            end < 1 ||
            start > totalPages ||
            end > totalPages
        ) {
            throw new Error(
                `Page numbers must be between 1 and ${totalPages}.`
            );
        }

        if (start > end) {
            throw new Error(
                `The range "${token}" is reversed. Use the smaller page number first.`
            );
        }

        for (let page = start; page <= end; page++) {
            pages.push(page);
        }
    }

    return pages;
}

/* Convert page numbers to zero-based PDF indices */

function toPageIndices(pageNumbers) {
    return pageNumbers.map((page) => page - 1);
}

/* Create a PDF containing selected pages */

async function createPdfFromPages(pageNumbers) {
    const outputPdf = await PDFLib.PDFDocument.create();

    const copiedPages = await outputPdf.copyPages(
        loadedPdf,
        toPageIndices(pageNumbers)
    );

    copiedPages.forEach((page) => {
        outputPdf.addPage(page);
    });

    const bytes = await outputPdf.save();

    return new Blob([bytes], {
        type: "application/pdf"
    });
}

/* Add a downloadable file link */

function addDownload(blob, filename, label) {
    const url = URL.createObjectURL(blob);

    activeDownloadUrls.push(url);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.className = "download-link";
    link.textContent = label;

    downloadArea.appendChild(link);
    downloadArea.hidden = false;

    return link;
}

/* Remove unsafe characters from generated filenames */

function safeBaseName(filename) {
    return filename
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .replace(/[. ]+$/g, "")
        .slice(0, 100) || "document";
}

/* Disable controls while processing */

function setProcessingState(processing) {
    isProcessing = processing;

    splitBtn.disabled = processing;
    browseBtn.disabled = processing;
    changeFileBtn.disabled = processing;

    splitBtn.textContent = processing
        ? "Processing PDF..."
        : "Split PDF";
}

/* Main split operation */

splitBtn.addEventListener("click", splitPdf);

async function splitPdf() {
    if (isProcessing || !selectedFile || !loadedPdf) {
        return;
    }

    if (!window.PDFLib) {
        showStatus("The PDF processing library is unavailable.", "error");
        return;
    }

    const mode = getSelectedMode();

    clearDownloads();
    setProcessingState(true);

    try {
        const baseName = safeBaseName(selectedFile.name);

        if (mode === "extract") {
            const pageNumbers = parsePageSelection(
                pageInput.value,
                pageCount
            );

            showStatus("Extracting the selected pages...", "info");

            const blob = await createPdfFromPages(pageNumbers);

            addDownload(
                blob,
                `${baseName}-extracted.pdf`,
                "Download extracted PDF"
            );

            showStatus(
                `Done! ${pageNumbers.length} page(s) extracted.`,
                "success"
            );
        }

        else if (mode === "ranges") {
            const rangeText = rangeInput.value.trim();

            if (!rangeText) {
                throw new Error(
                    "Enter page ranges such as 1-3, 4-6."
                );
            }

            const rangeTokens = rangeText
                .split(",")
                .map((token) => token.trim());

            if (rangeTokens.some((token) => token === "")) {
                throw new Error("Please check your range separators.");
            }

            if (rangeTokens.length > 100) {
                throw new Error(
                    "Please create no more than 100 output ranges at a time."
                );
            }

            const ranges = rangeTokens.map((range) => {
                const pages = parsePageSelection(range, pageCount);

                if (pages.length === 0) {
                    throw new Error("One of the ranges is empty.");
                }

                return {
                    original: range,
                    pages
                };
            });

            const usedPages = new Set();

            for (const range of ranges) {
                for (const page of range.pages) {
                    if (usedPages.has(page)) {
                        throw new Error(
                            `Page ${page} appears in more than one range. Please use non-overlapping ranges.`
                        );
                    }

                    usedPages.add(page);
                }
            }

            if (ranges.length === 1) {
                showStatus("Creating the PDF range...", "info");

                const blob = await createPdfFromPages(ranges[0].pages);

                addDownload(
                    blob,
                    `${baseName}-range-1.pdf`,
                    "Download range 1"
                );
            } else {
                if (!window.JSZip) {
                    throw new Error(
                        "The ZIP library could not load. Reload the page and try again."
                    );
                }

                const zip = new JSZip();

                for (let index = 0; index < ranges.length; index++) {
                    const range = ranges[index];

                    showStatus(
                        `Creating PDF ${index + 1} of ${ranges.length}...`,
                        "info"
                    );

                    const blob = await createPdfFromPages(range.pages);

                    zip.file(
                        `${baseName}-range-${index + 1}.pdf`,
                        blob
                    );
                }

                showStatus("Preparing your ZIP file...", "info");

                const zipBlob = await zip.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: {
                        level: 3
                    }
                });

                addDownload(
                    zipBlob,
                    `${baseName}-split-ranges.zip`,
                    "Download all split PDFs (ZIP)"
                );
            }

            showStatus(
                `Done! ${ranges.length} PDF range(s) created.`,
                "success"
            );
        }

        else if (mode === "individual") {
            if (!window.JSZip) {
                throw new Error(
                    "The ZIP library could not load. Reload the page and try again."
                );
            }

            if (pageCount > 500) {
                throw new Error(
                    "This document contains more than 500 pages. For performance, split a smaller document at a time."
                );
            }

            const zip = new JSZip();

            for (let page = 1; page <= pageCount; page++) {
                showStatus(
                    `Creating page ${page} of ${pageCount}...`,
                    "info"
                );

                const blob = await createPdfFromPages([page]);

                zip.file(
                    `${baseName}-page-${String(page).padStart(3, "0")}.pdf`,
                    blob
                );
            }

            showStatus("Preparing the ZIP download...", "info");

            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 3
                }
            });

            addDownload(
                zipBlob,
                `${baseName}-individual-pages.zip`,
                "Download individual pages (ZIP)"
            );

            showStatus(
                `Done! Created ${pageCount} individual PDF files.`,
                "success"
            );
        }

    } catch (error) {
        console.error("PDF splitting error:", error);

        showStatus(
            error.message ||
            "Something went wrong while splitting the PDF.",
            "error"
        );

    } finally {
        setProcessingState(false);
    }
}

/* Clear previous downloads when changing the selected file */

fileInput.addEventListener("click", clearDownloads);