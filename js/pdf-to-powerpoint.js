"use strict";

const pdfInput = document.getElementById("pdfInput");
const dropArea = document.getElementById("dropArea");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFileButton = document.getElementById("removeFile");
const presentationNameInput = document.getElementById("presentationName");
const pageRangeSelect = document.getElementById("pageRange");
const convertButton = document.getElementById("convertButton");
const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const message = document.getElementById("message");

const MAX_FILE_SIZE = 50 * 1024 * 1024;

let selectedFile = null;
let isConverting = false;

const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;

// Configure PDF.js worker.
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// Set footer year.
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

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

function updateFileDisplay() {
    if (!selectedFile) {
        fileInfo.classList.add("hidden");
        convertButton.disabled = true;
        return;
    }

    fileName.textContent = selectedFile.name;
    fileSize.textContent = formatFileSize(selectedFile.size);

    fileInfo.classList.remove("hidden");
    convertButton.disabled = false;
}

function selectFile(file) {
    if (isConverting || !file) {
        return;
    }

    clearMessage();
    resetProgress();

    const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
        selectedFile = null;
        pdfInput.value = "";
        updateFileDisplay();
        showMessage("Please select a PDF file.");
        return;
    }

    if (file.size === 0) {
        selectedFile = null;
        pdfInput.value = "";
        updateFileDisplay();
        showMessage("The selected file is empty.");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        selectedFile = null;
        pdfInput.value = "";
        updateFileDisplay();
        showMessage("The PDF exceeds the 50 MB limit. Please select a smaller file.");
        return;
    }

    selectedFile = file;
    updateFileDisplay();
}

// File picker.
pdfInput.addEventListener("change", (event) => {
    selectFile(event.target.files[0]);
});

// Remove file.
removeFileButton.addEventListener("click", () => {
    if (isConverting) {
        return;
    }

    selectedFile = null;
    pdfInput.value = "";

    updateFileDisplay();
    clearMessage();
    resetProgress();
});

// Drag and drop.
dropArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropArea.classList.add("drag-over");
});

dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("drag-over");
});

dropArea.addEventListener("drop", (event) => {
    event.preventDefault();
    dropArea.classList.remove("drag-over");

    selectFile(event.dataTransfer.files[0]);
});

// Clean presentation filename.
function cleanFileName(name) {
    const cleaned = name
        .trim()
        .replace(/\.pptx$/i, "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
        .replace(/[. ]+$/g, "");

    return cleaned || "converted-presentation";
}

// Fit a page image inside a slide without stretching it.
function calculateImagePlacement(imageWidth, imageHeight) {
    const scale = Math.min(
        SLIDE_WIDTH / imageWidth,
        SLIDE_HEIGHT / imageHeight
    );

    const width = imageWidth * scale;
    const height = imageHeight * scale;

    return {
        x: (SLIDE_WIDTH - width) / 2,
        y: (SLIDE_HEIGHT - height) / 2,
        w: width,
        h: height
    };
}

// Render one PDF page into a PNG data URL.
async function renderPageToImage(page) {
    const originalViewport = page.getViewport({ scale: 1 });

    // Limit rendering dimensions to help control browser memory use.
    const maximumDimension = 2200;
    const scale = Math.min(
        2,
        maximumDimension /
            Math.max(originalViewport.width, originalViewport.height)
    );

    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", {
        alpha: false
    });

    if (!context) {
        throw new Error("Your browser could not create a canvas for rendering.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
        canvasContext: context,
        viewport,
        background: "#ffffff"
    }).promise;

    const imageData = canvas.toDataURL("image/png");

    const imageWidth = canvas.width;
    const imageHeight = canvas.height;

    // Release the canvas pixel buffer after generating the image.
    canvas.width = 1;
    canvas.height = 1;

    return {
        data: imageData,
        width: imageWidth,
        height: imageHeight
    };
}

async function convertPdfToPowerPoint() {
    if (isConverting) {
        return;
    }

    clearMessage();

    if (!selectedFile) {
        showMessage("Please choose a PDF file first.");
        return;
    }

    if (!window.pdfjsLib || typeof window.pptxgen !== "function") {
        showMessage(
            "The required libraries could not load. Check your internet connection and refresh the page."
        );
        return;
    }

    isConverting = true;

    convertButton.disabled = true;
    pdfInput.disabled = true;
    removeFileButton.disabled = true;
    pageRangeSelect.disabled = true;
    presentationNameInput.disabled = true;

    let loadingTask = null;
    let pdf = null;

    try {
        updateProgress(3, "Reading your PDF...");

        const fileBuffer = await selectedFile.arrayBuffer();

        loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(fileBuffer)
        });

        pdf = await loadingTask.promise;

        const totalPages =
            pageRangeSelect.value === "first"
                ? 1
                : pdf.numPages;

        if (totalPages < 1) {
            throw new Error("No pages were found in this PDF.");
        }

        updateProgress(5, "Preparing PowerPoint presentation...");

        const presentation = new window.pptxgen();

        presentation.layout = "LAYOUT_WIDE";
        presentation.author = "DigiiFox";
        presentation.subject = "Converted from PDF";
        presentation.title = cleanFileName(
            presentationNameInput.value
        );
        presentation.company = "DigiiFox";
        presentation.lang = "en-US";

        presentation.defineSlideMaster({
            title: "PDF_PAGE_MASTER",
            background: {
                color: "FFFFFF"
            },
            objects: []
        });

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
            const progress =
                5 + ((pageNumber - 1) / totalPages) * 85;

            updateProgress(
                progress,
                `Rendering PDF page ${pageNumber} of ${totalPages}...`
            );

            const page = await pdf.getPage(pageNumber);

            const renderedImage = await renderPageToImage(page);

            const placement = calculateImagePlacement(
                renderedImage.width,
                renderedImage.height
            );

            const slide = presentation.addSlide("PDF_PAGE_MASTER");

            slide.addImage({
                data: renderedImage.data,
                x: placement.x,
                y: placement.y,
                w: placement.w,
                h: placement.h
            });

            // Release references before processing the next page.
            renderedImage.data = null;

            page.cleanup();
        }

        updateProgress(93, "Building the PowerPoint file...");

        const outputName =
            `${cleanFileName(presentationNameInput.value)}.pptx`;

        await presentation.writeFile({
            fileName: outputName
        });

        updateProgress(100, "Conversion complete.");

        showMessage(
            `Success! Your PowerPoint presentation contains ${totalPages} slide(s). Each slide contains an image of its corresponding PDF page.`,
            "success"
        );

    } catch (error) {
        console.error("PDF to PowerPoint conversion error:", error);

        let reason = error && error.message
            ? error.message
            : "An unexpected error occurred.";

        if (
            /password|encrypted/i.test(reason)
        ) {
            reason =
                "This PDF may be password-protected or encrypted. Try an accessible, unprotected PDF.";
        }

        showMessage(`Conversion failed: ${reason}`);
        statusText.textContent = "Conversion failed.";

    } finally {
        if (pdf && typeof pdf.destroy === "function") {
            try {
                await pdf.destroy();
            } catch (cleanupError) {
                console.warn("PDF cleanup warning:", cleanupError);
            }
        } else if (loadingTask && typeof loadingTask.destroy === "function") {
            try {
                await loadingTask.destroy();
            } catch (cleanupError) {
                console.warn("PDF loading cleanup warning:", cleanupError);
            }
        }

        isConverting = false;

        convertButton.disabled = !selectedFile;
        pdfInput.disabled = false;
        removeFileButton.disabled = false;
        pageRangeSelect.disabled = false;
        presentationNameInput.disabled = false;
    }
}

convertButton.addEventListener("click", convertPdfToPowerPoint);    