"use strict";

const pdfInput = document.getElementById("pdfInput");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const uploadCard = document.getElementById("uploadCard");
const statusMessage = document.getElementById("statusMessage");

const editorWorkspace = document.getElementById("editorWorkspace");
const canvas = document.getElementById("pdfCanvas");
const canvasContainer = document.getElementById("canvasContainer");
const textPreview = document.getElementById("textPreview");

const overlayText = document.getElementById("overlayText");
const fontSizeInput = document.getElementById("fontSize");
const textColorInput = document.getElementById("textColor");
const pageMode = document.getElementById("pageMode");

const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageIndicator = document.getElementById("pageIndicator");
const positionMessage = document.getElementById("positionMessage");
const resetPositionBtn = document.getElementById("resetPositionBtn");
const downloadBtn = document.getElementById("downloadBtn");

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

let originalPdfBytes = null;
let pdfDocument = null;
let currentPage = 1;
let totalPages = 0;
let selectedPosition = null;
let isRendering = false;
let isDownloading = false;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

function validateLibraries() {
    if (!window.pdfjsLib || !window.PDFLib) {
        setStatus(
            "The PDF libraries could not load. Check your internet connection and refresh the page.",
            "error"
        );
        return false;
    }

    return true;
}

chooseFileBtn.addEventListener("click", () => {
    pdfInput.click();
});

pdfInput.addEventListener("change", async () => {
    const file = pdfInput.files && pdfInput.files[0];

    if (file) {
        await loadPdfFile(file);
    }

    // Allow the same file to be selected again.
    pdfInput.value = "";
});

uploadCard.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadCard.classList.add("dragging");
});

uploadCard.addEventListener("dragleave", (event) => {
    if (!uploadCard.contains(event.relatedTarget)) {
        uploadCard.classList.remove("dragging");
    }
});

uploadCard.addEventListener("drop", async (event) => {
    event.preventDefault();
    uploadCard.classList.remove("dragging");

    const file = event.dataTransfer.files[0];

    if (file) {
        await loadPdfFile(file);
    }
});

async function loadPdfFile(file) {
    if (!validateLibraries()) {
        return;
    }

    if (file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")) {
        setStatus("Please select a PDF file.", "error");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        setStatus("The file is larger than the 50 MB limit.", "error");
        return;
    }

    if (file.size === 0) {
        setStatus("The selected file is empty.", "error");
        return;
    }

    setStatus("Loading your PDF...");

    try {
        const fileBuffer = await file.arrayBuffer();
        const pdfBytes = new Uint8Array(fileBuffer);

        // Load PDF.js and PDF-Lib independently so the file can be
        // previewed and edited without sending it to a server.
        const pdfJsDocument = await pdfjsLib.getDocument({
            data: pdfBytes.slice()
        }).promise;

        const pdfLibDocument = await PDFLib.PDFDocument.load(
            pdfBytes.slice(),
            { updateMetadata: false }
        );

        if (pdfJsDocument.numPages !== pdfLibDocument.getPageCount()) {
            throw new Error("The PDF libraries returned different page counts.");
        }

        pdfDocument = pdfJsDocument;
        originalPdfBytes = pdfBytes;
        totalPages = pdfDocument.numPages;
        currentPage = 1;
        selectedPosition = null;

        editorWorkspace.hidden = false;
        updatePositionPreview();

        await renderPage(currentPage);

        setStatus(
            `PDF loaded successfully: ${totalPages} page(s).`,
            "success"
        );

        editorWorkspace.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        console.error(error);

        pdfDocument = null;
        originalPdfBytes = null;
        totalPages = 0;

        editorWorkspace.hidden = true;

        setStatus(
            "Could not open this PDF. It may be damaged, password-protected, or unsupported.",
            "error"
        );
    }
}

async function renderPage(pageNumber) {
    if (!pdfDocument || isRendering) {
        return;
    }

    isRendering = true;
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;

    try {
        const page = await pdfDocument.getPage(pageNumber);

        // Limit the preview scale to keep large pages manageable.
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(
            220,
            Math.min(canvasContainer.clientWidth - 32, 850)
        );

        const scale = Math.min(
            availableWidth / baseViewport.width,
            1.5
        );

        const viewport = page.getViewport({ scale });

        const context = canvas.getContext("2d");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        await page.render({
            canvasContext: context,
            viewport
        }).promise;

        pageIndicator.textContent = `Page ${pageNumber} of ${totalPages}`;

        updatePositionPreview();

        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    } catch (error) {
        console.error(error);
        setStatus("Could not render this PDF page.", "error");
    } finally {
        isRendering = false;

        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
}

prevPageBtn.addEventListener("click", async () => {
    if (currentPage > 1 && !isRendering) {
        currentPage--;
        await renderPage(currentPage);
    }
});

nextPageBtn.addEventListener("click", async () => {
    if (currentPage < totalPages && !isRendering) {
        currentPage++;
        await renderPage(currentPage);
    }
});

canvas.addEventListener("click", (event) => {
    if (!pdfDocument || !canvas.width || !canvas.height) {
        return;
    }

    const rect = canvas.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    selectedPosition = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y))
    };

    updatePositionPreview();
});

function updatePositionPreview() {
    if (!selectedPosition || !pdfDocument) {
        textPreview.hidden = true;
        positionMessage.textContent = "Click anywhere on the PDF preview.";
        return;
    }

    textPreview.hidden = false;
    textPreview.textContent = overlayText.value || "Your text";

    textPreview.style.left = `${selectedPosition.x * 100}%`;
    textPreview.style.top = `${selectedPosition.y * 100}%`;
    textPreview.style.fontSize = `${Number(fontSizeInput.value) || 18}px`;
    textPreview.style.color = textColorInput.value;

    positionMessage.textContent =
        `Position selected: ${Math.round(selectedPosition.x * 100)}% from left, ` +
        `${Math.round(selectedPosition.y * 100)}% from top.`;
}

overlayText.addEventListener("input", updatePositionPreview);
fontSizeInput.addEventListener("input", updatePositionPreview);
textColorInput.addEventListener("input", updatePositionPreview);

resetPositionBtn.addEventListener("click", () => {
    selectedPosition = null;
    updatePositionPreview();
});

downloadBtn.addEventListener("click", async () => {
    if (!originalPdfBytes || !pdfDocument) {
        setStatus("Please upload a PDF first.", "error");
        return;
    }

    if (isDownloading) {
        return;
    }

    const text = overlayText.value.trim();
    const fontSize = Number(fontSizeInput.value);

    if (!text) {
        setStatus("Enter the text you want to add.", "error");
        overlayText.focus();
        return;
    }

    if (!selectedPosition) {
        setStatus("Click on the PDF preview to select a text position.", "error");
        return;
    }

    if (!Number.isFinite(fontSize) || fontSize < 6 || fontSize > 72) {
        setStatus("Choose a font size between 6 and 72.", "error");
        fontSizeInput.focus();
        return;
    }

    isDownloading = true;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Preparing PDF...";

    try {
        const editedPdf = await PDFLib.PDFDocument.load(
            originalPdfBytes.slice()
        );

        const font = await editedPdf.embedFont(PDFLib.StandardFonts.Helvetica);

        const colorHex = textColorInput.value.replace("#", "");

        const red = parseInt(colorHex.slice(0, 2), 16) / 255;
        const green = parseInt(colorHex.slice(2, 4), 16) / 255;
        const blue = parseInt(colorHex.slice(4, 6), 16) / 255;

        const color = PDFLib.rgb(red, green, blue);
        const pages = editedPdf.getPages();

        const targetPages = pageMode.value === "all"
            ? pages
            : [pages[currentPage - 1]];

        // Use the same relative position on each target page.
        // PDF coordinates start at the bottom-left; preview coordinates
        // start at the top-left.
        for (const page of targetPages) {
            const pageWidth = page.getWidth();
            const pageHeight = page.getHeight();

            const x = selectedPosition.x * pageWidth;
            const y = pageHeight - selectedPosition.y * pageHeight;

            const lines = text.split(/\r?\n/);
            const lineHeight = fontSize * 1.25;

            lines.forEach((line, index) => {
                page.drawText(line, {
                    x,
                    y: y - index * lineHeight,
                    size: fontSize,
                    font,
                    color
                });
            });
        }

        const outputBytes = await editedPdf.save();

        const blob = new Blob([outputBytes], {
            type: "application/pdf"
        });

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download = "digiiFox-edited.pdf";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

        setStatus("Your edited PDF has been downloaded.", "success");
    } catch (error) {
        console.error(error);

        setStatus(
            "Could not edit this PDF. It may contain unsupported features or encryption.",
            "error"
        );
    } finally {
        isDownloading = false;
        downloadBtn.disabled = false;
        downloadBtn.textContent = "Download Edited PDF";
    }
});