"use strict";

const pdfInput = document.getElementById("pdfInput");
const dropArea = document.getElementById("dropArea");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFileButton = document.getElementById("removeFile");

const editor = document.getElementById("editor");
const pageGrid = document.getElementById("pageGrid");
const pageCount = document.getElementById("pageCount");
const selectedCount = document.getElementById("selectedCount");
const selectionSummary = document.getElementById("selectionSummary");

const selectAllButton = document.getElementById("selectAllButton");
const clearSelectionButton = document.getElementById("clearSelectionButton");
const extractButton = document.getElementById("extractButton");

const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const message = document.getElementById("message");

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PREVIEW_DIMENSION = 350;

let selectedFile = null;
let originalPdfBytes = null;
let pdfDocument = null;
let totalPages = 0;
let isBusy = false;
let previewGeneration = 0;

const selectedPages = new Set();

// Configure PDF.js.
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// Display the current year.
document.getElementById("currentYear").textContent =
    new Date().getFullYear();

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
}

function clearMessage() {
    message.textContent = "";
    message.className = "message hidden";
}

function updateProgress(percent, text) {
    progressArea.classList.remove("hidden");
    progressBar.style.width =
        `${Math.max(0, Math.min(100, percent))}%`;
    statusText.textContent = text;
}

function resetProgress() {
    progressArea.classList.add("hidden");
    progressBar.style.width = "0%";
    statusText.textContent = "";
}

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setBusyState(busy) {
    isBusy = busy;

    pdfInput.disabled = busy;
    removeFileButton.disabled = busy;

    selectAllButton.disabled = busy || totalPages === 0;
    clearSelectionButton.disabled = busy || selectedPages.size === 0;

    pageGrid.querySelectorAll(".page-checkbox").forEach(checkbox => {
        checkbox.disabled = busy;
    });

    extractButton.disabled =
        busy ||
        !selectedFile ||
        selectedPages.size === 0;
}

function updateSelectionDisplay() {
    const count = selectedPages.size;

    selectedCount.textContent =
        `${count} page${count === 1 ? "" : "s"} selected`;

    if (count === 0) {
        selectionSummary.textContent =
            "No pages selected. Select the pages you want to extract.";
    } else {
        selectionSummary.textContent =
            `${count} page${count === 1 ? "" : "s"} selected for extraction.`;
    }

    pageGrid.querySelectorAll(".page-card").forEach(card => {
        const pageNumber = Number(card.dataset.page);

        card.classList.toggle(
            "selected",
            selectedPages.has(pageNumber)
        );

        const checkbox = card.querySelector(".page-checkbox");

        if (checkbox) {
            checkbox.checked = selectedPages.has(pageNumber);
        }
    });

    setBusyState(isBusy);
}

function clearPagePreviews() {
    previewGeneration++;

    pageGrid.replaceChildren();
    selectedPages.clear();

    editor.classList.add("hidden");

    totalPages = 0;
    pageCount.textContent = "0 pages";
    selectedCount.textContent = "0 pages selected";
    selectionSummary.textContent = "";
}

async function releasePdfDocument() {
    const oldDocument = pdfDocument;
    pdfDocument = null;

    if (oldDocument && typeof oldDocument.destroy === "function") {
        try {
            await oldDocument.destroy();
        } catch (error) {
            console.warn("PDF cleanup warning:", error);
        }
    }
}

async function resetCurrentFile() {
    clearPagePreviews();

    selectedFile = null;
    originalPdfBytes = null;
    pdfInput.value = "";

    fileInfo.classList.add("hidden");

    await releasePdfDocument();

    updateSelectionDisplay();
}

function createPageCard(pageNumber) {
    const card = document.createElement("article");
    card.className = "page-card";
    card.dataset.page = String(pageNumber);

    const preview = document.createElement("div");
    preview.className = "page-preview";

    const placeholder = document.createElement("p");
    placeholder.className = "page-placeholder";
    placeholder.textContent = "Loading preview...";

    preview.appendChild(placeholder);

    const footer = document.createElement("div");
    footer.className = "page-footer";

    const number = document.createElement("span");
    number.className = "page-number";
    number.textContent = `Page ${pageNumber + 1}`;

    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "page-checkbox-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "page-checkbox";
    checkbox.setAttribute(
        "aria-label",
        `Select page ${pageNumber + 1} for extraction`
    );

    checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
            selectedPages.add(pageNumber);
        } else {
            selectedPages.delete(pageNumber);
        }

        updateSelectionDisplay();
    });

    const labelText = document.createElement("span");
    labelText.textContent = "Include";
    labelText.style.fontSize = "11px";

    checkboxLabel.append(checkbox, labelText);
    footer.append(number, checkboxLabel);
    card.append(preview, footer);

    pageGrid.appendChild(card);

    return { card, preview };
}

async function renderPagePreview(pageNumber, cardInfo, generation) {
    const page = await pdfDocument.getPage(pageNumber + 1);

    if (generation !== previewGeneration) {
        page.cleanup();
        return;
    }

    const initialViewport = page.getViewport({ scale: 1 });

    const scale = Math.min(
        0.5,
        MAX_PREVIEW_DIMENSION /
            Math.max(initialViewport.width, initialViewport.height)
    );

    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
        throw new Error("Your browser could not render a page preview.");
    }

    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
        canvasContext: context,
        viewport,
        background: "#ffffff"
    }).promise;

    page.cleanup();

    if (generation !== previewGeneration) {
        canvas.width = 1;
        canvas.height = 1;
        return;
    }

    cardInfo.preview.replaceChildren();
    cardInfo.preview.appendChild(canvas);
}

async function selectFile(file) {
    if (isBusy || !file) {
        return;
    }

    clearMessage();
    resetProgress();

    const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
        showMessage("Please select a PDF file.");
        return;
    }

    if (file.size === 0) {
        showMessage("The selected file is empty.");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showMessage(
            "The PDF exceeds the 50 MB limit. Please select a smaller file."
        );
        return;
    }

    await resetCurrentFile();

    selectedFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove("hidden");

    if (!window.pdfjsLib || !window.PDFLib) {
        selectedFile = null;
        fileInfo.classList.add("hidden");

        showMessage(
            "The PDF libraries could not load. Check your internet connection and refresh the page."
        );

        return;
    }

    const generation = previewGeneration + 1;
    previewGeneration = generation;

    setBusyState(true);

    try {
        updateProgress(5, "Reading PDF file...");

        const buffer = await file.arrayBuffer();

        // Preserve a separate copy for PDF-Lib.
        originalPdfBytes = new Uint8Array(buffer.slice(0));

        // PDF.js receives its own buffer.
        const pdfJsBytes = new Uint8Array(buffer.slice(0));

        const loadingTask = pdfjsLib.getDocument({
            data: pdfJsBytes
        });

        pdfDocument = await loadingTask.promise;

        if (generation !== previewGeneration) {
            await releasePdfDocument();
            return;
        }

        totalPages = pdfDocument.numPages;

        if (totalPages < 1) {
            throw new Error("No pages were found in this PDF.");
        }

        pageCount.textContent =
            `${totalPages} page${totalPages === 1 ? "" : "s"}`;

        editor.classList.remove("hidden");

        const cards = [];

        for (let i = 0; i < totalPages; i++) {
            cards.push(createPageCard(i));
        }

        // Render one page at a time to limit memory usage.
        for (let i = 0; i < cards.length; i++) {
            if (generation !== previewGeneration) {
                return;
            }

            updateProgress(
                10 + ((i + 1) / totalPages) * 85,
                `Loading preview ${i + 1} of ${totalPages}...`
            );

            try {
                await renderPagePreview(i, cards[i], generation);
            } catch (error) {
                if (generation !== previewGeneration) {
                    return;
                }

                console.warn(`Preview failed for page ${i + 1}:`, error);

                cards[i].preview.replaceChildren();

                const errorText = document.createElement("p");
                errorText.className = "page-placeholder";
                errorText.textContent = "Preview unavailable";

                cards[i].preview.appendChild(errorText);
            }
        }

        if (generation === previewGeneration) {
            updateProgress(100, "PDF ready.");
            updateSelectionDisplay();
        }

    } catch (error) {
        console.error("PDF loading error:", error);

        if (generation === previewGeneration) {
            await resetCurrentFile();

            showMessage(
                "Unable to open this PDF. It may be damaged, password-protected, or unsupported."
            );
        }

    } finally {
        // Always restore the controls when the current operation finishes.
        if (generation === previewGeneration) {
            resetProgress();
            setBusyState(false);
            updateSelectionDisplay();
        } else {
            setBusyState(false);
        }
    }
}

pdfInput.addEventListener("change", event => {
    selectFile(event.target.files[0]);
});

removeFileButton.addEventListener("click", async () => {
    if (isBusy) {
        return;
    }

    clearMessage();
    resetProgress();

    await resetCurrentFile();
});

dropArea.addEventListener("dragover", event => {
    event.preventDefault();
    dropArea.classList.add("drag-over");
});

dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("drag-over");
});

dropArea.addEventListener("drop", event => {
    event.preventDefault();
    dropArea.classList.remove("drag-over");

    selectFile(event.dataTransfer.files[0]);
});

selectAllButton.addEventListener("click", () => {
    if (isBusy || totalPages === 0) {
        return;
    }

    for (let i = 0; i < totalPages; i++) {
        selectedPages.add(i);
    }

    updateSelectionDisplay();
});

clearSelectionButton.addEventListener("click", () => {
    if (isBusy) {
        return;
    }

    selectedPages.clear();
    updateSelectionDisplay();
});

function cleanOutputFileName(name) {
    return name
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/[. ]+$/g, "")
        .trim() || "extracted-pages";
}

extractButton.addEventListener("click", async () => {
    if (isBusy || !selectedFile || !originalPdfBytes) {
        return;
    }

    clearMessage();

    if (selectedPages.size === 0) {
        showMessage("Please select at least one page to extract.");
        return;
    }

    setBusyState(true);

    try {
        updateProgress(10, "Opening the original PDF...");

        const { PDFDocument } = PDFLib;

        const sourcePdf = await PDFDocument.load(originalPdfBytes);
        const outputPdf = await PDFDocument.create();

        // Sort page indexes to preserve their original order.
        const pageIndexes = [...selectedPages].sort((a, b) => a - b);

        updateProgress(30, "Extracting selected pages...");

        const copiedPages = await outputPdf.copyPages(
            sourcePdf,
            pageIndexes
        );

        for (let i = 0; i < copiedPages.length; i++) {
            outputPdf.addPage(copiedPages[i]);

            updateProgress(
                30 + ((i + 1) / copiedPages.length) * 55,
                `Adding page ${i + 1} of ${copiedPages.length}...`
            );
        }

        updateProgress(90, "Preparing your PDF download...");

        const outputBytes = await outputPdf.save();

        const blob = new Blob(
            [outputBytes],
            { type: "application/pdf" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download =
            `${cleanOutputFileName(selectedFile.name)}-extracted.pdf`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        // Allow the browser time to begin the download.
        setTimeout(() => URL.revokeObjectURL(url), 60000);

        updateProgress(100, "Extraction complete.");

        showMessage(
            `Success! Extracted ${pageIndexes.length} page(s) into a new PDF. The original document has not been changed.`,
            "success"
        );

    } catch (error) {
        console.error("Extract PDF pages error:", error);

        showMessage(
            "Could not create the extracted PDF. The document may be damaged, encrypted, or too large for available browser memory."
        );

        statusText.textContent = "Extraction failed.";

    } finally {
        setBusyState(false);
        updateSelectionDisplay();
    }
});