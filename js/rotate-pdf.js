const pdfInput = document.getElementById("pdfInput");
const browseBtn = document.getElementById("browseBtn");
const dropZone = document.getElementById("dropZone");

const fileSection = document.getElementById("fileSection");
const fileName = document.getElementById("fileName");
const fileDetails = document.getElementById("fileDetails");

const rotationAngle = document.getElementById("rotationAngle");
const selectedPagesBox = document.getElementById("selectedPagesBox");
const selectedPagesInput = document.getElementById("selectedPages");

const rotateBtn = document.getElementById("rotateBtn");
const removeBtn = document.getElementById("removeBtn");
const statusMessage = document.getElementById("statusMessage");

const resultSection = document.getElementById("resultSection");
const resultDetails = document.getElementById("resultDetails");
const downloadBtn = document.getElementById("downloadBtn");
const startAgainBtn = document.getElementById("startAgainBtn");

const MAX_FILE_SIZE = 50 * 1024 * 1024;

let selectedFile = null;
let originalPageCount = 0;
let downloadUrl = null;

browseBtn.addEventListener("click", () => {
    pdfInput.click();
});

pdfInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (file) {
        loadPdf(file);
    }
});

dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");

    const file = event.dataTransfer.files[0];

    if (file) {
        loadPdf(file);
    }
});

document.querySelectorAll('input[name="pageMode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
        const selectedMode = document.querySelector(
            'input[name="pageMode"]:checked'
        ).value;

        selectedPagesBox.classList.toggle(
            "hidden",
            selectedMode !== "selected"
        );
    });
});

rotateBtn.addEventListener("click", rotatePdf);
removeBtn.addEventListener("click", resetTool);
startAgainBtn.addEventListener("click", resetTool);

function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
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

async function loadPdf(file) {
    resetStatus();

    if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert("Please choose a PDF file.");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        alert("This file is larger than the 50 MB limit.");
        return;
    }

    if (file.size === 0) {
        alert("The selected file is empty.");
        return;
    }

    try {
        if (!window.PDFLib) {
            throw new Error("The PDF library could not be loaded. Check your internet connection and reload this page.");
        }

        const bytes = await file.arrayBuffer();

        const pdfDoc = await PDFLib.PDFDocument.load(bytes, {
            updateMetadata: false
        });

        const pages = pdfDoc.getPages();

        if (pages.length === 0) {
            throw new Error("This PDF does not contain any pages.");
        }

        selectedFile = file;
        originalPageCount = pages.length;

        fileName.textContent = file.name;
        fileDetails.textContent =
            `${pages.length} pages · ${formatBytes(file.size)}`;

        dropZone.classList.add("hidden");
        fileSection.classList.remove("hidden");
        resultSection.classList.add("hidden");

        setStatus("");
    } catch (error) {
        console.error(error);
        alert(
            "Unable to open this PDF. It may be damaged, password-protected, or unsupported."
        );
    }
}

function parsePageNumbers(input, pageCount) {
    const value = input.trim();

    if (!value) {
        throw new Error("Enter at least one page number.");
    }

    const pageNumbers = new Set();
    const parts = value.split(",");

    for (const part of parts) {
        const item = part.trim();

        if (!item) {
            throw new Error("Check your page numbers. There may be an empty entry.");
        }

        const rangeMatch = item.match(/^(\d+)\s*-\s*(\d+)$/);

        if (rangeMatch) {
            const start = Number(rangeMatch[1]);
            const end = Number(rangeMatch[2]);

            if (start < 1 || end < 1 || start > end || end > pageCount) {
                throw new Error(`Invalid range "${item}". Use page numbers from 1 to ${pageCount}.`);
            }

            for (let page = start; page <= end; page++) {
                pageNumbers.add(page - 1);
            }

            continue;
        }

        if (!/^\d+$/.test(item)) {
            throw new Error(`Invalid page entry "${item}". Use numbers, commas, or ranges such as 2-5.`);
        }

        const page = Number(item);

        if (page < 1 || page > pageCount) {
            throw new Error(`Page ${page} does not exist. This PDF has ${pageCount} pages.`);
        }

        pageNumbers.add(page - 1);
    }

    return [...pageNumbers];
}

async function rotatePdf() {
    if (!selectedFile) {
        setStatus("Please choose a PDF file first.", "error");
        return;
    }

    if (!window.PDFLib) {
        setStatus("The PDF library is unavailable. Reload the page and try again.", "error");
        return;
    }

    rotateBtn.disabled = true;
    rotateBtn.textContent = "Processing PDF...";
    setStatus("Please wait while your PDF is processed.");

    try {
        const bytes = await selectedFile.arrayBuffer();

        const pdfDoc = await PDFLib.PDFDocument.load(bytes, {
            updateMetadata: false
        });

        const pages = pdfDoc.getPages();

        if (pages.length !== originalPageCount) {
            throw new Error("The PDF page count changed. Please upload the file again.");
        }

        const angle = Number(rotationAngle.value);
        const pageMode = document.querySelector(
            'input[name="pageMode"]:checked'
        ).value;

        let pageIndexes;

        if (pageMode === "all") {
            pageIndexes = pages.map((page, index) => index);
        } else {
            pageIndexes = parsePageNumbers(
                selectedPagesInput.value,
                pages.length
            );
        }

        if (![90, 180, 270].includes(angle)) {
            throw new Error("Please choose a valid rotation angle.");
        }

        for (const index of pageIndexes) {
            const page = pages[index];
            const currentRotation = page.getRotation().angle;
            const newRotation = ((currentRotation + angle) % 360 + 360) % 360;

            page.setRotation(PDFLib.degrees(newRotation));
        }

        const outputBytes = await pdfDoc.save();

        const outputBlob = new Blob([outputBytes], {
            type: "application/pdf"
        });

        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
        }

        downloadUrl = URL.createObjectURL(outputBlob);

        downloadBtn.href = downloadUrl;
        downloadBtn.download = createOutputName(selectedFile.name);

        resultDetails.textContent =
            `Rotated ${pageIndexes.length} of ${pages.length} page(s) by ${angle}°. Output size: ${formatBytes(outputBlob.size)}.`;

        fileSection.classList.add("hidden");
        resultSection.classList.remove("hidden");

        setStatus("");
    } catch (error) {
        console.error(error);
        setStatus(
            error.message || "Something went wrong while rotating the PDF.",
            "error"
        );
    } finally {
        rotateBtn.disabled = false;
        rotateBtn.textContent = "🔄 Rotate PDF";
    }
}

function createOutputName(originalName) {
    const baseName = originalName.replace(/\.pdf$/i, "");
    return `${baseName}-rotated.pdf`;
}

function resetStatus() {
    setStatus("");
}

function resetTool() {
    selectedFile = null;
    originalPageCount = 0;

    pdfInput.value = "";
    selectedPagesInput.value = "";

    rotationAngle.value = "90";
    document.querySelector('input[name="pageMode"][value="all"]').checked = true;
    selectedPagesBox.classList.add("hidden");

    dropZone.classList.remove("hidden");
    fileSection.classList.add("hidden");
    resultSection.classList.add("hidden");

    setStatus("");

    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
    }
}