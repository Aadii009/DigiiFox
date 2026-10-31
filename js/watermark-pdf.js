/* =========================
   DIGIIFOX WATERMARK PDF
   ========================= */

const pdfInput = document.getElementById("pdfInput");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const uploadBox = document.getElementById("uploadBox");

const filePanel = document.getElementById("filePanel");
const settingsPanel = document.getElementById("settingsPanel");

const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const pageCount = document.getElementById("pageCount");

const removeFileBtn = document.getElementById("removeFileBtn");

const watermarkText = document.getElementById("watermarkText");
const fontSizeInput = document.getElementById("fontSize");
const watermarkColor = document.getElementById("watermarkColor");
const opacityInput = document.getElementById("opacity");
const rotationInput = document.getElementById("rotation");

const pageMode = document.getElementById("pageMode");
const selectedPagesGroup = document.getElementById("selectedPagesGroup");
const selectedPagesInput = document.getElementById("selectedPages");

const previewText = document.getElementById("previewText");
const watermarkPreview = document.getElementById("watermarkPreview");

const applyBtn = document.getElementById("applyBtn");
const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const statusMessage = document.getElementById("statusMessage");

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PAGES = 500;

let selectedFile = null;
let pdfPageCount = 0;
let isProcessing = false;
let fileGeneration = 0;

/* =========================
   HELPERS
   ========================= */

function showStatus(message, type = "info") {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
}

function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "status-message hidden";
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function safeBaseName(name) {
    return name
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .trim()
        .slice(0, 100) || "watermarked-document";
}

function setProgress(percent, message) {
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressText.textContent = message;
}

function resetProgress() {
    progressBar.style.width = "0%";
    progressText.textContent = "Preparing PDF...";
}

/* =========================
   WATERMARK PREVIEW
   ========================= */

function updatePreview() {
    const text = watermarkText.value.trim() || "WATERMARK";
    const size = Number(fontSizeInput.value) || 42;
    const color = watermarkColor.value;
    const opacity = Number(opacityInput.value);
    const rotation = Number(rotationInput.value);

    previewText.textContent = text;
    previewText.style.color = color;
    previewText.style.opacity = opacity;
    previewText.style.transform = `rotate(${-rotation}deg)`;

    // Keep the preview text within reasonable visual limits.
    previewText.style.fontSize = `${Math.min(size, 48)}px`;
}

[
    watermarkText,
    fontSizeInput,
    watermarkColor,
    opacityInput,
    rotationInput
].forEach((element) => {
    element.addEventListener("input", updatePreview);
    element.addEventListener("change", updatePreview);
});

updatePreview();

/* =========================
   FILE SELECTION
   ========================= */

chooseFileBtn.addEventListener("click", () => {
    if (!isProcessing) {
        pdfInput.click();
    }
});

pdfInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (file) {
        loadPDF(file);
    }
});

uploadBox.addEventListener("dragover", (event) => {
    event.preventDefault();

    if (!isProcessing) {
        uploadBox.classList.add("drag-active");
    }
});

uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("drag-active");
});

uploadBox.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadBox.classList.remove("drag-active");

    if (isProcessing) return;

    const file = event.dataTransfer.files[0];

    if (file) {
        loadPDF(file);
    }
});

async function loadPDF(file) {
    if (isProcessing) return;

    clearStatus();

    const isPDF =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
        showStatus("Please select a valid PDF file.", "error");
        pdfInput.value = "";
        return;
    }

    if (file.size === 0) {
        showStatus("The selected file is empty.", "error");
        pdfInput.value = "";
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showStatus("The file exceeds the 50 MB size limit.", "error");
        pdfInput.value = "";
        return;
    }

    resetTool();

    const generation = fileGeneration;
    selectedFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    pageCount.textContent = "Checking PDF...";

    filePanel.classList.remove("hidden");
    uploadBox.classList.add("hidden");

    try {
        // Read the PDF locally in the browser.
        const buffer = await file.arrayBuffer();

        if (generation !== fileGeneration) return;

        const pdf = await PDFLib.PDFDocument.load(buffer);

        if (generation !== fileGeneration) return;

        pdfPageCount = pdf.getPageCount();

        if (pdfPageCount < 1) {
            throw new Error("This PDF does not contain any pages.");
        }

        if (pdfPageCount > MAX_PAGES) {
            throw new Error(
                `This tool supports up to ${MAX_PAGES} pages per PDF.`
            );
        }

        pageCount.textContent =
            `${pdfPageCount} page${pdfPageCount === 1 ? "" : "s"}`;

        settingsPanel.classList.remove("hidden");

    } catch (error) {
        console.error("PDF loading error:", error);

        if (generation !== fileGeneration) return;

        resetTool();
        uploadBox.classList.remove("hidden");

        showStatus(
            "Could not open this PDF. It may be damaged, encrypted, or unsupported.",
            "error"
        );
    }
}

/* =========================
   RESET TOOL
   ========================= */

function resetTool() {
    fileGeneration++;

    selectedFile = null;
    pdfPageCount = 0;

    pdfInput.value = "";

    filePanel.classList.add("hidden");
    settingsPanel.classList.add("hidden");
    progressArea.classList.add("hidden");

    selectedPagesGroup.classList.add("hidden");
    selectedPagesInput.value = "";
    pageMode.value = "all";

    clearStatus();
    resetProgress();
}

/* =========================
   PAGE SELECTION
   ========================= */

pageMode.addEventListener("change", () => {
    if (pageMode.value === "selected") {
        selectedPagesGroup.classList.remove("hidden");
    } else {
        selectedPagesGroup.classList.add("hidden");
    }
});

function parsePageSelection(input, totalPages) {
    const text = input.trim();

    if (!text) {
        throw new Error("Enter the page numbers to watermark.");
    }

    const pages = new Set();

    for (const part of text.split(",")) {
        const item = part.trim();

        if (/^\d+$/.test(item)) {
            const page = Number(item);

            if (page < 1 || page > totalPages) {
                throw new Error(
                    `Page ${page} is outside the valid range of 1 to ${totalPages}.`
                );
            }

            pages.add(page);
            continue;
        }

        const range = item.match(/^(\d+)\s*-\s*(\d+)$/);

        if (range) {
            const start = Number(range[1]);
            const end = Number(range[2]);

            if (
                start < 1 ||
                end > totalPages ||
                start > end
            ) {
                throw new Error(`Invalid page range: ${item}.`);
            }

            for (let page = start; page <= end; page++) {
                pages.add(page);
            }

            continue;
        }

        throw new Error(
            `Invalid page selection: "${item}". Example: 1, 3, 5-7`
        );
    }

    return [...pages].sort((a, b) => a - b);
}

/* =========================
   VALIDATE SETTINGS
   ========================= */

function getWatermarkSettings() {
    const text = watermarkText.value.trim();
    const fontSize = Number(fontSizeInput.value);
    const opacity = Number(opacityInput.value);
    const rotation = Number(rotationInput.value);
    const colorHex = watermarkColor.value;

    if (!text) {
        throw new Error("Please enter your watermark text.");
    }

    if (text.length > 100) {
        throw new Error("Watermark text cannot exceed 100 characters.");
    }

    if (!Number.isFinite(fontSize) || fontSize < 10 || fontSize > 120) {
        throw new Error("Font size must be between 10 and 120.");
    }

    if (!Number.isFinite(opacity) || opacity < 0.15 || opacity > 0.8) {
        throw new Error("Please select a valid opacity.");
    }

    if (![0, 45, -45, 90].includes(rotation)) {
        throw new Error("Please select a valid rotation.");
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
        throw new Error("Please select a valid text color.");
    }

    return {
        text,
        fontSize,
        opacity,
        rotation,
        colorHex
    };
}

function hexToRgb(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16) / 255,
        g: parseInt(hex.slice(3, 5), 16) / 255,
        b: parseInt(hex.slice(5, 7), 16) / 255
    };
}

/* =========================
   APPLY WATERMARK
   ========================= */

applyBtn.addEventListener("click", applyWatermark);

async function applyWatermark() {
    if (isProcessing) return;

    if (!selectedFile) {
        showStatus("Please select a PDF file first.", "error");
        return;
    }

    clearStatus();

    let settings;
    let pagesToWatermark;

    try {
        settings = getWatermarkSettings();

        if (pageMode.value === "all") {
            pagesToWatermark = Array.from(
                { length: pdfPageCount },
                (_, index) => index + 1
            );
        } else {
            pagesToWatermark = parsePageSelection(
                selectedPagesInput.value,
                pdfPageCount
            );
        }
    } catch (error) {
        showStatus(error.message, "error");
        return;
    }

    const sourceFile = selectedFile;
    const generation = fileGeneration;

    isProcessing = true;
    applyBtn.disabled = true;
    chooseFileBtn.disabled = true;
    removeFileBtn.disabled = true;

    progressArea.classList.remove("hidden");
    setProgress(5, "Loading your PDF...");

    try {
        const buffer = await sourceFile.arrayBuffer();

        if (generation !== fileGeneration) return;

        const pdfDoc = await PDFLib.PDFDocument.load(buffer);
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

        const rgbColor = hexToRgb(settings.colorHex);
        const color = PDFLib.rgb(rgbColor.r, rgbColor.g, rgbColor.b);

        const degrees = PDFLib.degrees(settings.rotation);

        for (let index = 0; index < pagesToWatermark.length; index++) {
            if (generation !== fileGeneration) return;

            const pageNumber = pagesToWatermark[index];
            const page = pdfDoc.getPages()[pageNumber - 1];

            const { width, height } = page.getSize();

            // Fit long text to the page width where possible.
            let actualFontSize = settings.fontSize;
            let textWidth = font.widthOfTextAtSize(
                settings.text,
                actualFontSize
            );

            const maxWidth = width * 0.82;

            if (textWidth > maxWidth) {
                actualFontSize = Math.max(
                    10,
                    actualFontSize * (maxWidth / textWidth)
                );

                textWidth = font.widthOfTextAtSize(
                    settings.text,
                    actualFontSize
                );
            }

            const textHeight = font.heightAtSize(actualFontSize);

            // Center the watermark on the page.
            const x = Math.max(0, (width - textWidth) / 2);
            const y = Math.max(0, (height - textHeight) / 2);

            page.drawText(settings.text, {
                x,
                y,
                size: actualFontSize,
                font,
                color,
                opacity: settings.opacity,
                rotate: degrees
            });

            setProgress(
                5 + ((index + 1) / pagesToWatermark.length) * 80,
                `Watermarking page ${pageNumber} (${index + 1} of ${pagesToWatermark.length})...`
            );

            // Give the browser a chance to update the progress display.
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        if (generation !== fileGeneration) return;

        setProgress(90, "Preparing your watermarked PDF...");

        const outputBytes = await pdfDoc.save();

        if (generation !== fileGeneration) return;

        const outputBlob = new Blob([outputBytes], {
            type: "application/pdf"
        });

        const outputName =
            `${safeBaseName(sourceFile.name)}-watermarked.pdf`;

        downloadBlob(outputBlob, outputName);

        setProgress(100, "Watermark added successfully.");

        showStatus(
            `Success! Your watermarked PDF has been downloaded. Watermark applied to ${pagesToWatermark.length} page(s).`,
            "success"
        );

    } catch (error) {
        console.error("Watermark error:", error);

        showStatus(
            "Could not add the watermark. The PDF may be damaged, encrypted, or unsupported.",
            "error"
        );

    } finally {
        isProcessing = false;

        applyBtn.disabled = false;
        chooseFileBtn.disabled = false;
        removeFileBtn.disabled = false;
    }
}

/* =========================
   DOWNLOAD PDF
   ========================= */

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* =========================
   REMOVE FILE
   ========================= */

removeFileBtn.addEventListener("click", () => {
    if (isProcessing) return;

    resetTool();
    uploadBox.classList.remove("hidden");
});

/* =========================
   FOOTER YEAR
   ========================= */

document.getElementById("currentYear").textContent =
    new Date().getFullYear();