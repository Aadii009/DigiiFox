"use strict";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const pdfInput = document.getElementById("pdfInput");
const dropArea = document.getElementById("dropArea");
const fileDetails = document.getElementById("fileDetails");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFile = document.getElementById("removeFile");

const signatureSection = document.getElementById("signatureSection");
const signatureCanvas = document.getElementById("signatureCanvas");
const signaturePlaceholder = document.getElementById("signaturePlaceholder");
const clearSignatureButton = document.getElementById("clearSignature");
const signatureColor = document.getElementById("signatureColor");
const placeSignatureButton = document.getElementById("placeSignature");

const previewSection = document.getElementById("previewSection");
const pdfPreview = document.getElementById("pdfPreview");
const pdfCanvas = document.getElementById("pdfCanvas");
const signatureOverlay = document.getElementById("signatureOverlay");
const pageSelect = document.getElementById("pageSelect");
const signatureSize = document.getElementById("signatureSize");
const signatureSizeLabel = document.getElementById("signatureSizeLabel");
const downloadButton = document.getElementById("downloadButton");

const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const message = document.getElementById("message");

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PAGES = 300;

let selectedFile = null;
let pdfDocument = null;
let signatureCreated = false;
let signaturePlaced = false;
let isDrawing = false;
let isDragging = false;
let isProcessing = false;

let signatureDataUrl = null;
let signaturePosition = { left: 65, top: 80 };
let dragOffset = { x: 0, y: 0 };

let outputUrl = null;
let operationId = 0;
let renderTask = null;
let renderId = 0;

const signatureContext = signatureCanvas.getContext("2d");

document.getElementById("currentYear").textContent =
    new Date().getFullYear();

/* -------------------------------------------------------
   GENERAL HELPERS
------------------------------------------------------- */

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
}

function hideMessage() {
    message.hidden = true;
    message.textContent = "";
    message.className = "message";
}

function updateProgress(percent, text) {
    progressArea.hidden = false;
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressText.textContent = text;
}

function clearOutput() {
    if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
        outputUrl = null;
    }

    downloadButton.removeAttribute("href");
    downloadButton.removeAttribute("download");
}

function setProcessing(value) {
    isProcessing = value;

    pdfInput.disabled = value;
    removeFile.disabled = value;
    clearSignatureButton.disabled = value;
    signatureColor.disabled = value;
    signatureSize.disabled = value;
    pageSelect.disabled = value;
    placeSignatureButton.disabled = value || !signatureCreated;
    downloadButton.disabled = value || !signaturePlaced;

    downloadButton.style.opacity = downloadButton.disabled ? "0.5" : "1";
    downloadButton.style.pointerEvents = downloadButton.disabled ? "none" : "auto";
}

/* -------------------------------------------------------
   SIGNATURE CANVAS
------------------------------------------------------- */

function configureSignatureCanvas() {
    const rect = signatureCanvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const ratio = Math.max(1, window.devicePixelRatio || 1);

    signatureCanvas.width = Math.round(rect.width * ratio);
    signatureCanvas.height = Math.round(rect.height * ratio);

    signatureContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    signatureContext.lineCap = "round";
    signatureContext.lineJoin = "round";
    signatureContext.lineWidth = 2.5;
    signatureContext.strokeStyle = signatureColor.value;
}

function getSignaturePoint(event) {
    const rect = signatureCanvas.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function startDrawing(event) {
    if (isProcessing || signatureSection.hidden) return;

    event.preventDefault();

    isDrawing = true;
    signatureCreated = true;
    clearOutput();
    hideMessage();

    signaturePlaceholder.hidden = true;

    const point = getSignaturePoint(event);

    signatureContext.beginPath();
    signatureContext.moveTo(point.x, point.y);

    signatureCanvas.setPointerCapture(event.pointerId);

    placeSignatureButton.disabled = false;
    placeSignatureButton.textContent = signaturePlaced
        ? "Update Signature on PDF"
        : "Place Signature on PDF";
}

function drawSignature(event) {
    if (!isDrawing) return;

    event.preventDefault();

    const point = getSignaturePoint(event);

    signatureContext.lineTo(point.x, point.y);
    signatureContext.stroke();
}

function stopDrawing() {
    if (!isDrawing) return;

    isDrawing = false;

    signatureDataUrl = signatureCanvas.toDataURL("image/png");

    placeSignatureButton.disabled = false;
    placeSignatureButton.textContent = signaturePlaced
        ? "Update Signature on PDF"
        : "Place Signature on PDF";
}

signatureCanvas.addEventListener("pointerdown", startDrawing);
signatureCanvas.addEventListener("pointermove", drawSignature);
signatureCanvas.addEventListener("pointerup", stopDrawing);
signatureCanvas.addEventListener("pointercancel", stopDrawing);
signatureCanvas.addEventListener("lostpointercapture", stopDrawing);

signatureColor.addEventListener("input", () => {
    signatureContext.strokeStyle = signatureColor.value;
});

clearSignatureButton.addEventListener("click", () => {
    if (isProcessing) return;

    signatureContext.clearRect(
        0,
        0,
        signatureCanvas.width,
        signatureCanvas.height
    );

    signatureCreated = false;
    signatureDataUrl = null;

    signaturePlaceholder.hidden = false;
    placeSignatureButton.disabled = true;
    placeSignatureButton.textContent = "Place Signature on PDF";

    hideMessage();
});

/* -------------------------------------------------------
   SIGNATURE POSITION AND SIZE
------------------------------------------------------- */

function getOverlaySize() {
    const previewWidth = pdfPreview.clientWidth;
    const previewHeight = pdfPreview.clientHeight;

    const widthPercent = Number(signatureSize.value);
    const width = previewWidth * widthPercent / 100;

    const ratio = signatureOverlay.naturalHeight /
        signatureOverlay.naturalWidth;

    const height = width * ratio;

    return { width, height, previewWidth, previewHeight };
}

function clampSignaturePosition(left, top) {
    const { width, height, previewWidth, previewHeight } = getOverlaySize();

    const maxLeft = Math.max(0, previewWidth - width);
    const maxTop = Math.max(0, previewHeight - height);

    signaturePosition.left = Math.min(
        100,
        Math.max(0, left / previewWidth * 100)
    );

    signaturePosition.top = Math.min(
        100,
        Math.max(0, top / previewHeight * 100)
    );

    const leftPx = Math.min(maxLeft, Math.max(0, left));
    const topPx = Math.min(maxTop, Math.max(0, top));

    signaturePosition.left = leftPx / previewWidth * 100;
    signaturePosition.top = topPx / previewHeight * 100;
}

function applySignaturePosition() {
    if (!signaturePlaced || signatureOverlay.hidden) return;

    const previewWidth = pdfPreview.clientWidth;
    const previewHeight = pdfPreview.clientHeight;

    if (!previewWidth || !previewHeight) return;

    const { width, height } = getOverlaySize();

    const left = Math.min(
        previewWidth - width,
        Math.max(0, previewWidth * signaturePosition.left / 100)
    );

    const top = Math.min(
        previewHeight - height,
        Math.max(0, previewHeight * signaturePosition.top / 100)
    );

    signatureOverlay.style.width = `${signatureSize.value}%`;
    signatureOverlay.style.left = `${left}px`;
    signatureOverlay.style.top = `${top}px`;
}

function placeSignature() {
    if (!signatureCreated || !signatureDataUrl || isProcessing) {
        showMessage("Please draw your signature first.");
        return;
    }

    clearOutput();
    hideMessage();

    signatureOverlay.src = signatureDataUrl;
    signatureOverlay.hidden = false;

    signaturePlaced = true;

    signaturePosition = { left: 65, top: 80 };

    signatureOverlay.onload = () => {
        applySignaturePosition();

        downloadButton.disabled = false;
        downloadButton.style.opacity = "1";
        downloadButton.style.pointerEvents = "auto";
    };

    // Handle a cached image whose load event has already fired.
    if (signatureOverlay.complete && signatureOverlay.naturalWidth) {
        applySignaturePosition();
        downloadButton.disabled = false;
        downloadButton.style.opacity = "1";
        downloadButton.style.pointerEvents = "auto";
    }

    placeSignatureButton.textContent = "Update Signature on PDF";
}

placeSignatureButton.addEventListener("click", placeSignature);

signatureSize.addEventListener("input", () => {
    signatureSizeLabel.textContent = `${signatureSize.value}%`;

    if (signaturePlaced) {
        applySignaturePosition();
        clearOutput();
    }
});

/* Drag the signature around the PDF preview. */

signatureOverlay.addEventListener("pointerdown", (event) => {
    if (!signaturePlaced || isProcessing) return;

    event.preventDefault();

    isDragging = true;

    const overlayRect = signatureOverlay.getBoundingClientRect();

    dragOffset.x = event.clientX - overlayRect.left;
    dragOffset.y = event.clientY - overlayRect.top;

    signatureOverlay.setPointerCapture(event.pointerId);
});

signatureOverlay.addEventListener("pointermove", (event) => {
    if (!isDragging) return;

    event.preventDefault();

    const previewRect = pdfPreview.getBoundingClientRect();

    const left = event.clientX - previewRect.left - dragOffset.x;
    const top = event.clientY - previewRect.top - dragOffset.y;

    clampSignaturePosition(left, top);
    applySignaturePosition();
    clearOutput();
});

function stopDragging() {
    isDragging = false;
}

signatureOverlay.addEventListener("pointerup", stopDragging);
signatureOverlay.addEventListener("pointercancel", stopDragging);
signatureOverlay.addEventListener("lostpointercapture", stopDragging);

/* -------------------------------------------------------
   PDF PREVIEW
------------------------------------------------------- */

async function renderSelectedPage() {
    if (!pdfDocument || isProcessing) return;

    const currentRender = ++renderId;
    const pageNumber = Number(pageSelect.value);

    if (renderTask) {
        try {
            renderTask.cancel();
        } catch (_) {
            // The previous render may already have completed.
        }

        renderTask = null;
    }

    hideMessage();

    try {
        const page = await pdfDocument.getPage(pageNumber);

        if (currentRender !== renderId) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const context = pdfCanvas.getContext("2d");

        pdfCanvas.width = Math.ceil(viewport.width);
        pdfCanvas.height = Math.ceil(viewport.height);

        const availableWidth = Math.max(
            250,
            Math.min(700, document.querySelector(".pdf-preview-outer").clientWidth - 24)
        );

        pdfPreview.style.width = `${Math.min(viewport.width, availableWidth)}px`;

        const task = page.render({
            canvasContext: context,
            viewport
        });

        renderTask = task;

        await task.promise;

        if (currentRender !== renderId) return;

        renderTask = null;

        page.cleanup();

        signatureOverlay.hidden = !signaturePlaced;

        if (signaturePlaced) {
            signaturePosition = { left: 65, top: 80 };
            applySignaturePosition();
        }

        downloadButton.disabled = !signaturePlaced;

        if (signaturePlaced) {
            downloadButton.style.opacity = "1";
            downloadButton.style.pointerEvents = "auto";
        }

    } catch (error) {
        if (error.name === "RenderingCancelledException") return;

        console.error("PDF preview error:", error);
        showMessage("Could not preview this page. Please try another page or PDF.");
    }
}

pageSelect.addEventListener("change", renderSelectedPage);

/* -------------------------------------------------------
   FILE SELECTION
------------------------------------------------------- */

async function destroyCurrentDocument() {
    renderId++;

    if (renderTask) {
        try {
            renderTask.cancel();
        } catch (_) {}

        renderTask = null;
    }

    if (pdfDocument) {
        try {
            await pdfDocument.destroy();
        } catch (_) {}

        pdfDocument = null;
    }
}

async function resetForm() {
    operationId++;

    await destroyCurrentDocument();

    selectedFile = null;
    signatureCreated = false;
    signaturePlaced = false;
    signatureDataUrl = null;
    isDrawing = false;
    isDragging = false;

    clearOutput();
    hideMessage();

    pdfInput.value = "";

    fileDetails.hidden = true;
    signatureSection.hidden = true;
    previewSection.hidden = true;
    progressArea.hidden = true;

    signatureOverlay.hidden = true;
    signatureOverlay.removeAttribute("src");

    signatureContext.clearRect(
        0,
        0,
        signatureCanvas.width,
        signatureCanvas.height
    );

    signaturePlaceholder.hidden = false;

    pageSelect.innerHTML = "";
    pdfCanvas.width = 0;
    pdfCanvas.height = 0;

    placeSignatureButton.disabled = true;
    placeSignatureButton.textContent = "Place Signature on PDF";

    downloadButton.disabled = true;
    downloadButton.style.opacity = "0.5";
    downloadButton.style.pointerEvents = "none";

    signatureSize.value = 25;
    signatureSizeLabel.textContent = "25%";

    pdfInput.disabled = false;
    removeFile.disabled = false;
    clearSignatureButton.disabled = false;
    signatureColor.disabled = false;
    signatureSize.disabled = false;
    pageSelect.disabled = false;
}

async function selectFile(file) {
    if (isProcessing) return;

    await resetForm();

    if (!file) return;

    if (file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")) {
        showMessage("Please select a PDF file.");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showMessage("The PDF exceeds the 50 MB limit. Please choose a smaller file.");
        return;
    }

    if (file.size === 0) {
        showMessage("The selected file is empty.");
        return;
    }

    selectedFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);

    fileDetails.hidden = false;
    signatureSection.hidden = false;

    requestAnimationFrame(configureSignatureCanvas);

    const currentOperation = operationId;

    progressArea.hidden = false;
    updateProgress(5, "Opening your PDF...");

    try {
        const bytes = new Uint8Array(await file.arrayBuffer());

        if (currentOperation !== operationId) return;

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        pdfDocument = await loadingTask.promise;

        if (currentOperation !== operationId) {
            await destroyCurrentDocument();
            return;
        }

        if (!pdfDocument.numPages || pdfDocument.numPages > MAX_PAGES) {
            await destroyCurrentDocument();
            selectedFile = null;
            fileDetails.hidden = true;
            signatureSection.hidden = true;
            progressArea.hidden = true;

            showMessage("This tool supports PDFs with up to 300 pages.");
            return;
        }

        pageSelect.innerHTML = "";

        for (let page = 1; page <= pdfDocument.numPages; page++) {
            const option = document.createElement("option");
            option.value = String(page);
            option.textContent = `Page ${page} of ${pdfDocument.numPages}`;
            pageSelect.appendChild(option);
        }

        previewSection.hidden = false;
        updateProgress(35, "Preparing page preview...");

        await renderSelectedPage();

        if (currentOperation !== operationId) return;

        progressArea.hidden = true;
        showMessage("PDF loaded. Draw your signature to get started.", "success");

    } catch (error) {
        console.error("PDF loading error:", error);

        await destroyCurrentDocument();

        if (currentOperation !== operationId) return;

        selectedFile = null;
        fileDetails.hidden = true;
        signatureSection.hidden = true;
        previewSection.hidden = true;
        progressArea.hidden = true;

        showMessage(
            "Could not open this PDF. It may be damaged, password-protected, or unsupported. Please try another PDF."
        );
    }
}

pdfInput.addEventListener("change", (event) => {
    selectFile(event.target.files[0]);
});

removeFile.addEventListener("click", () => {
    if (!isProcessing) resetForm();
});

dropArea.addEventListener("dragover", (event) => {
    event.preventDefault();

    if (!isProcessing) {
        dropArea.classList.add("drag-over");
    }
});

dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("drag-over");
});

dropArea.addEventListener("drop", (event) => {
    event.preventDefault();
    dropArea.classList.remove("drag-over");

    if (isProcessing) return;

    const file = event.dataTransfer.files[0];

    if (file) {
        selectFile(file);
    }
});

/* -------------------------------------------------------
   ADD SIGNATURE TO PDF AND DOWNLOAD
------------------------------------------------------- */

downloadButton.addEventListener("click", async () => {
    if (!selectedFile || !signaturePlaced || !signatureDataUrl || isProcessing) {
        showMessage("Upload a PDF, draw your signature, and place it on the page first.");
        return;
    }

    const currentOperation = ++operationId;
    const file = selectedFile;
    const selectedPageNumber = Number(pageSelect.value);

    clearOutput();
    hideMessage();
    setProcessing(true);
    updateProgress(5, "Preparing your signed PDF...");

    try {
        const { PDFDocument } = PDFLib;

        const fileBytes = await file.arrayBuffer();

        if (currentOperation !== operationId) return;

        const pdfLibDocument = await PDFDocument.load(fileBytes, {
            updateMetadata: false
        });

        if (currentOperation !== operationId) return;

        const pages = pdfLibDocument.getPages();
        const page = pages[selectedPageNumber - 1];

        if (!page) {
            throw new Error("The selected PDF page could not be found.");
        }

        updateProgress(30, "Adding your signature...");

        const signatureBytes = await fetch(signatureDataUrl).then(response => {
            if (!response.ok) {
                throw new Error("Could not read the signature image.");
            }

            return response.arrayBuffer();
        });

        const embeddedSignature = await pdfLibDocument.embedPng(signatureBytes);

        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const canvasWidth = pdfCanvas.clientWidth;
        const canvasHeight = pdfCanvas.clientHeight;

        if (!canvasWidth || !canvasHeight) {
            throw new Error("The PDF page preview is not ready. Please try again.");
        }

        const { width: overlayWidth, height: overlayHeight } = getOverlaySize();

        const leftPx = Math.min(
            canvasWidth - overlayWidth,
            Math.max(0, canvasWidth * signaturePosition.left / 100)
        );

        const topPx = Math.min(
            canvasHeight - overlayHeight,
            Math.max(0, canvasHeight * signaturePosition.top / 100)
        );

        // Convert preview coordinates to PDF page coordinates.
        // PDF coordinates start at the bottom-left corner.
        const x = (leftPx / canvasWidth) * pageWidth;
        const y = pageHeight - ((topPx + overlayHeight) / canvasHeight) * pageHeight;

        const width = (overlayWidth / canvasWidth) * pageWidth;
        const height = (overlayHeight / canvasHeight) * pageHeight;

        page.drawImage(embeddedSignature, {
            x,
            y,
            width,
            height
        });

        updateProgress(65, "Finalizing the signed document...");

        if (currentOperation !== operationId) return;

        const signedBytes = await pdfLibDocument.save();

        if (currentOperation !== operationId) return;

        const blob = new Blob([signedBytes], {
            type: "application/pdf"
        });

        if (!blob.size) {
            throw new Error("The signed PDF could not be created.");
        }

        outputUrl = URL.createObjectURL(blob);

        const baseName = file.name.replace(/\.pdf$/i, "") || "document";

        downloadButton.href = outputUrl;
        downloadButton.download = `${baseName}-signed.pdf`;

        updateProgress(100, "Your signed PDF is ready.");
        showMessage(
            `Success! Your signature has been added to page ${selectedPageNumber}. Click the download button to save your PDF.`,
            "success"
        );

    } catch (error) {
        console.error("Sign PDF error:", error);

        if (currentOperation !== operationId) return;

        let errorText = error.message || "Something went wrong while signing your PDF.";

        if (/encrypted|password/i.test(errorText)) {
            errorText = "This PDF may be password-protected. Please use an unlocked PDF and try again.";
        } else if (/memory|allocation/i.test(errorText)) {
            errorText = "Your browser ran out of memory. Try a smaller PDF.";
        } else if (/fetch|network/i.test(errorText)) {
            errorText = "A required library could not be loaded. Check your internet connection and reload the page.";
        }

        showMessage(errorText);
        progressArea.hidden = true;

    } finally {
        if (currentOperation === operationId) {
            setProcessing(false);
        }
    }
});

/* Keep the signature canvas correctly sized when the window changes. */

window.addEventListener("resize", () => {
    if (!signatureSection.hidden && !isProcessing) {
        const oldData = signatureCreated ? signatureCanvas.toDataURL("image/png") : null;

        configureSignatureCanvas();

        if (oldData) {
            const image = new Image();

            image.onload = () => {
                signatureContext.drawImage(
                    image,
                    0,
                    0,
                    signatureCanvas.clientWidth,
                    signatureCanvas.clientHeight
                );

                signatureDataUrl = signatureCanvas.toDataURL("image/png");
            };

            image.src = oldData;
        }
    }

    if (signaturePlaced) {
        applySignaturePosition();
    }
});