"use strict";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const pdfInput = document.getElementById("pdfInput");
const dropArea = document.getElementById("dropArea");
const fileDetails = document.getElementById("fileDetails");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFile = document.getElementById("removeFile");

const passwordArea = document.getElementById("passwordArea");
const pdfPassword = document.getElementById("pdfPassword");
const togglePassword = document.getElementById("togglePassword");
const confirmPermission = document.getElementById("confirmPermission");

const unlockButton = document.getElementById("unlockButton");
const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const message = document.getElementById("message");
const downloadButton = document.getElementById("downloadButton");

const MAX_FILE_SIZE = 50 * 1024 * 1024;

let selectedFile = null;
let isProcessing = false;
let outputUrl = null;
let operationId = 0;

document.getElementById("currentYear").textContent =
    new Date().getFullYear();

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function clearOutput() {
    if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
        outputUrl = null;
    }

    downloadButton.removeAttribute("href");
    downloadButton.removeAttribute("download");
    downloadButton.hidden = true;
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
}

function hideMessage() {
    message.hidden = true;
    message.textContent = "";
    message.className = "message";
}

function updateButton() {
    unlockButton.disabled =
        !selectedFile ||
        !pdfPassword.value ||
        !confirmPermission.checked ||
        isProcessing;
}

function updateProgress(percent, text) {
    progressArea.hidden = false;
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressText.textContent = text;
}

function setProcessing(value) {
    isProcessing = value;

    pdfInput.disabled = value;
    removeFile.disabled = value;
    pdfPassword.disabled = value;
    confirmPermission.disabled = value;
    togglePassword.disabled = value;

    unlockButton.textContent = value ? "Processing PDF..." : "Unlock PDF";

    updateButton();
}

function resetForm() {
    operationId++;

    selectedFile = null;
    isProcessing = false;

    clearOutput();
    hideMessage();

    pdfInput.value = "";
    pdfPassword.value = "";
    confirmPermission.checked = false;

    fileDetails.hidden = true;
    passwordArea.hidden = true;
    progressArea.hidden = true;

    progressBar.style.width = "0%";
    progressText.textContent = "";

    pdfInput.disabled = false;
    removeFile.disabled = false;
    pdfPassword.disabled = false;
    confirmPermission.disabled = false;
    togglePassword.disabled = false;

    unlockButton.textContent = "Unlock PDF";
    unlockButton.disabled = true;
    togglePassword.textContent = "Show";
    pdfPassword.type = "password";
}

function selectFile(file) {
    if (isProcessing) return;

    resetForm();

    if (!file) return;

    if (file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")) {
        showMessage("Please select a PDF file.", "error");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showMessage("The PDF is larger than 50 MB. Please select a smaller file.", "error");
        return;
    }

    if (file.size === 0) {
        showMessage("The selected file is empty.", "error");
        return;
    }

    selectedFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);

    fileDetails.hidden = false;
    passwordArea.hidden = false;

    pdfPassword.focus();
    updateButton();
}

pdfInput.addEventListener("change", () => {
    selectFile(pdfInput.files[0]);
});

removeFile.addEventListener("click", resetForm);

pdfPassword.addEventListener("input", () => {
    clearOutput();
    hideMessage();
    updateButton();
});

confirmPermission.addEventListener("change", updateButton);

togglePassword.addEventListener("click", () => {
    const currentlyHidden = pdfPassword.type === "password";

    pdfPassword.type = currentlyHidden ? "text" : "password";
    togglePassword.textContent = currentlyHidden ? "Hide" : "Show";
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

async function renderPageToCanvas(page, scale = 1.5) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
        throw new Error("Your browser could not prepare the PDF page for rendering.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
        canvasContext: context,
        viewport,
        background: "rgb(255,255,255)"
    }).promise;

    return {
        canvas,
        width: viewport.width,
        height: viewport.height
    };
}

function getPasswordError(error) {
    if (error instanceof pdfjsLib.PasswordException) {
        if (error.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD) {
            return "The password is incorrect. Please check it and try again.";
        }

        if (error.code === pdfjsLib.PasswordResponses.NEED_PASSWORD) {
            return "This PDF requires a password. Please enter it and try again.";
        }
    }

    return null;
}

unlockButton.addEventListener("click", async () => {
    if (!selectedFile || !pdfPassword.value || !confirmPermission.checked || isProcessing) {
        return;
    }

    const currentOperation = ++operationId;
    const file = selectedFile;
    const password = pdfPassword.value;

    clearOutput();
    hideMessage();
    setProcessing(true);
    updateProgress(3, "Reading your PDF...");

    let loadingTask = null;

    try {
        const fileBytes = new Uint8Array(await file.arrayBuffer());

        if (currentOperation !== operationId) return;

        loadingTask = pdfjsLib.getDocument({
            data: fileBytes,
            password
        });

        updateProgress(8, "Checking the password...");

        let pdfDocument;

        try {
            pdfDocument = await loadingTask.promise;
        } catch (error) {
            const passwordMessage = getPasswordError(error);

            if (passwordMessage) {
                throw new Error(passwordMessage);
            }

            throw error;
        }

        if (currentOperation !== operationId) {
            await pdfDocument.destroy();
            return;
        }

        const totalPages = pdfDocument.numPages;

        if (!totalPages || totalPages > 500) {
            await pdfDocument.destroy();
            throw new Error("This tool supports PDFs with up to 500 pages.");
        }

        const { jsPDF } = window.jspdf;
        let outputPdf = null;

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
            if (currentOperation !== operationId) {
                await pdfDocument.destroy();
                return;
            }

            const page = await pdfDocument.getPage(pageNumber);

            // Render the page into an image to create a new PDF
            // without the original password protection.
            const rendered = await renderPageToCanvas(page, 1.5);
            const imageData = rendered.canvas.toDataURL("image/jpeg", 0.92);

            const pageWidth = rendered.width;
            const pageHeight = rendered.height;

            if (!outputPdf) {
                outputPdf = new jsPDF({
                    orientation: pageWidth >= pageHeight ? "landscape" : "portrait",
                    unit: "pt",
                    format: [pageWidth, pageHeight],
                    compress: true
                });
            } else {
                outputPdf.addPage(
                    [pageWidth, pageHeight],
                    pageWidth >= pageHeight ? "landscape" : "portrait"
                );
            }

            outputPdf.addImage(
                imageData,
                "JPEG",
                0,
                0,
                pageWidth,
                pageHeight,
                undefined,
                "FAST"
            );

            rendered.canvas.width = 1;
            rendered.canvas.height = 1;

            page.cleanup();

            const percent = 10 + Math.round((pageNumber / totalPages) * 85);

            updateProgress(
                percent,
                `Processing page ${pageNumber} of ${totalPages}...`
            );
        }

        await pdfDocument.destroy();
        loadingTask = null;

        if (currentOperation !== operationId) return;

        if (!outputPdf) {
            throw new Error("No pages were found in this PDF.");
        }

        updateProgress(98, "Preparing your download...");

        const outputBlob = outputPdf.output("blob");

        if (!outputBlob || outputBlob.size === 0) {
            throw new Error("The new PDF could not be created.");
        }

        outputUrl = URL.createObjectURL(outputBlob);

        const baseName = file.name.replace(/\.pdf$/i, "") || "document";

        downloadButton.href = outputUrl;
        downloadButton.download = `${baseName}-unlocked.pdf`;
        downloadButton.hidden = false;

        updateProgress(100, "Your PDF is ready.");
        showMessage(
            "Success! Your new PDF is ready to download. Its pages have been converted into images, so text and interactive features are not preserved.",
            "success"
        );
    } catch (error) {
        if (currentOperation !== operationId) return;

        console.error("Unlock PDF error:", error);

        let errorText = error.message || "Something went wrong while processing your PDF.";

        if (/password|encrypted/i.test(errorText) &&
            !/incorrect|requires a password|enter it/i.test(errorText)) {
            errorText = "This PDF could not be opened. Check the password and make sure the PDF uses a supported encryption format.";
        } else if (/worker|fetch|network|loading/i.test(errorText)) {
            errorText = "A required library could not be loaded. Check your internet connection and reload this page.";
        } else if (/memory|allocation/i.test(errorText)) {
            errorText = "Your browser ran out of memory while processing this PDF. Try a smaller document.";
        }

        showMessage(errorText, "error");
        progressArea.hidden = true;
    } finally {
        if (loadingTask) {
            try {
                await loadingTask.destroy();
            } catch (_) {
                // The PDF task may already have been destroyed.
            }
        }

        if (currentOperation === operationId) {
            setProcessing(false);
        }
    }
});