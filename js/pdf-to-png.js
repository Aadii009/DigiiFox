/* =========================
   DIGIIFOX PDF TO PNG
   ========================= */

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const pdfInput = document.getElementById("pdfInput");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const uploadBox = document.getElementById("uploadBox");

const filePanel = document.getElementById("filePanel");
const settingsPanel = document.getElementById("settingsPanel");
const resultsPanel = document.getElementById("resultsPanel");

const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const pageCount = document.getElementById("pageCount");

const removeFileBtn = document.getElementById("removeFileBtn");
const pageMode = document.getElementById("pageMode");
const selectedPagesGroup = document.getElementById("selectedPagesGroup");
const selectedPagesInput = document.getElementById("selectedPages");
const imageQuality = document.getElementById("imageQuality");

const convertBtn = document.getElementById("convertBtn");
const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const imageGrid = document.getElementById("imageGrid");
const resultsSummary = document.getElementById("resultsSummary");

const downloadZipBtn = document.getElementById("downloadZipBtn");
const convertAnotherBtn = document.getElementById("convertAnotherBtn");
const statusMessage = document.getElementById("statusMessage");

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PAGES = 100;
const MAX_RENDER_PIXELS = 20_000_000;

let selectedFile = null;
let pdfDocument = null;
let convertedImages = [];
let isConverting = false;
let fileGeneration = 0;

/* =========================
   BASIC HELPERS
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
        .slice(0, 100) || "converted-document";
}

function setProgress(percent, message) {
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressText.textContent = message;
}

function resetProgress() {
    progressBar.style.width = "0%";
    progressText.textContent = "Preparing conversion...";
}

/* =========================
   FILE SELECTION
   ========================= */

chooseFileBtn.addEventListener("click", () => {
    if (isConverting) return;

    pdfInput.click();
});

pdfInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (file) {
        loadPDF(file);
    }
});

uploadBox.addEventListener("dragover", (event) => {
    event.preventDefault();

    if (!isConverting) {
        uploadBox.classList.add("drag-active");
    }
});

uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("drag-active");
});

uploadBox.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadBox.classList.remove("drag-active");

    if (isConverting) return;

    const file = event.dataTransfer.files[0];

    if (file) {
        loadPDF(file);
    }
});

function resetTool() {
    fileGeneration++;

    if (pdfDocument) {
        try {
            pdfDocument.destroy();
        } catch (error) {
            console.warn("Could not release the previous PDF document.", error);
        }
    }

    pdfDocument = null;
    selectedFile = null;
    convertedImages = [];

    pdfInput.value = "";

    filePanel.classList.add("hidden");
    settingsPanel.classList.add("hidden");
    resultsPanel.classList.add("hidden");
    progressArea.classList.add("hidden");

    selectedPagesGroup.classList.add("hidden");
    selectedPagesInput.value = "";
    pageMode.value = "all";

    imageGrid.replaceChildren();

    clearStatus();
    resetProgress();
}

async function loadPDF(file) {
    if (isConverting) return;

    clearStatus();

    const isPDF =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
        showStatus("Please select a valid PDF file.", "error");
        pdfInput.value = "";
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showStatus("The file exceeds the 50 MB size limit.", "error");
        pdfInput.value = "";
        return;
    }

    if (file.size === 0) {
        showStatus("The selected file is empty.", "error");
        pdfInput.value = "";
        return;
    }

    resetTool();

    const thisGeneration = fileGeneration;
    selectedFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    pageCount.textContent = "Reading PDF...";

    filePanel.classList.remove("hidden");
    uploadBox.classList.add("hidden");

    try {
        const arrayBuffer = await file.arrayBuffer();

        if (thisGeneration !== fileGeneration) return;

        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer)
        });

        const document = await loadingTask.promise;

        if (thisGeneration !== fileGeneration) {
            await document.destroy();
            return;
        }

        pdfDocument = document;

        if (document.numPages < 1) {
            throw new Error("This PDF does not contain any pages.");
        }

        if (document.numPages > MAX_PAGES) {
            throw new Error(
                `This tool currently supports up to ${MAX_PAGES} pages per PDF.`
            );
        }

        pageCount.textContent =
            `${document.numPages} page${document.numPages === 1 ? "" : "s"}`;

        settingsPanel.classList.remove("hidden");

    } catch (error) {
        console.error("PDF loading error:", error);

        if (thisGeneration !== fileGeneration) return;

        resetTool();
        uploadBox.classList.remove("hidden");

        showStatus(
            error.message ||
            "Could not open this PDF. It may be damaged, password-protected, or unsupported.",
            "error"
        );
    }
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
        throw new Error("Enter the page numbers you want to convert.");
    }

    const pages = new Set();
    const parts = text.split(",");

    for (const part of parts) {
        const item = part.trim();

        if (!item) {
            throw new Error("Please check your page-number format.");
        }

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
                throw new Error(
                    `Invalid page range: ${item}. Use a range between 1 and ${totalPages}.`
                );
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

    const result = [...pages].sort((a, b) => a - b);

    if (result.length > MAX_PAGES) {
        throw new Error(`You can convert up to ${MAX_PAGES} pages at once.`);
    }

    return result;
}

/* =========================
   CONVERT PDF TO PNG
   ========================= */

convertBtn.addEventListener("click", convertPDF);

async function convertPDF() {
    if (isConverting) return;

    if (!selectedFile || !pdfDocument) {
        showStatus("Please select a PDF file first.", "error");
        return;
    }

    clearStatus();

    let pagesToConvert;

    try {
        if (pageMode.value === "all") {
            pagesToConvert = Array.from(
                { length: pdfDocument.numPages },
                (_, index) => index + 1
            );
        } else {
            pagesToConvert = parsePageSelection(
                selectedPagesInput.value,
                pdfDocument.numPages
            );
        }
    } catch (error) {
        showStatus(error.message, "error");
        return;
    }

    if (pagesToConvert.length > MAX_PAGES) {
        showStatus(
            `You can convert up to ${MAX_PAGES} pages at once.`,
            "error"
        );
        return;
    }

    isConverting = true;
    convertBtn.disabled = true;
    chooseFileBtn.disabled = true;
    removeFileBtn.disabled = true;
    convertAnotherBtn.disabled = true;
    downloadZipBtn.disabled = true;

    resultsPanel.classList.add("hidden");
    progressArea.classList.remove("hidden");
    imageGrid.replaceChildren();
    convertedImages = [];

    const scale = Number(imageQuality.value);
    const baseName = safeBaseName(selectedFile.name);

    try {
        const results = [];

        for (let index = 0; index < pagesToConvert.length; index++) {
            const pageNumber = pagesToConvert[index];

            setProgress(
                (index / pagesToConvert.length) * 100,
                `Converting page ${pageNumber} of ${pagesToConvert.length}...`
            );

            const page = await pdfDocument.getPage(pageNumber);

            const baseViewport = page.getViewport({ scale: 1 });

            let effectiveScale = scale;

            const estimatedPixels =
                baseViewport.width *
                baseViewport.height *
                effectiveScale *
                effectiveScale;

            if (estimatedPixels > MAX_RENDER_PIXELS) {
                effectiveScale = Math.sqrt(
                    MAX_RENDER_PIXELS /
                    (baseViewport.width * baseViewport.height)
                );

                effectiveScale = Math.min(effectiveScale, scale);
            }

            const viewport = page.getViewport({
                scale: effectiveScale
            });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d", {
                alpha: false
            });

            if (!context) {
                throw new Error("Your browser could not create an image canvas.");
            }

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            if (
                canvas.width * canvas.height > MAX_RENDER_PIXELS
            ) {
                throw new Error(
                    `Page ${pageNumber} is too large to render safely. Try a lower resolution.`
                );
            }

            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error(
                            `Could not create the PNG image for page ${pageNumber}.`
                        ));
                    }
                }, "image/png");
            });

            const image = {
                pageNumber,
                name: `${baseName}-page-${pageNumber}.png`,
                blob,
                url: URL.createObjectURL(blob),
                width: canvas.width,
                height: canvas.height
            };

            results.push(image);

            canvas.width = 0;
            canvas.height = 0;

            page.cleanup();

            setProgress(
                ((index + 1) / pagesToConvert.length) * 100,
                `Converted ${index + 1} of ${pagesToConvert.length} page(s)...`
            );

            // Allow the browser to update the progress display.
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        convertedImages = results;

        displayResults();

        setProgress(100, "Conversion complete!");

        showStatus(
            `Successfully converted ${results.length} page(s) to PNG.`,
            "success"
        );

    } catch (error) {
        console.error("Conversion error:", error);

        convertedImages.forEach((image) => URL.revokeObjectURL(image.url));
        convertedImages = [];

        imageGrid.replaceChildren();
        resultsPanel.classList.add("hidden");

        showStatus(
            error.message ||
            "Something went wrong during conversion. Please try again.",
            "error"
        );

    } finally {
        isConverting = false;

        convertBtn.disabled = false;
        chooseFileBtn.disabled = false;
        removeFileBtn.disabled = false;
        convertAnotherBtn.disabled = false;
        downloadZipBtn.disabled = false;
    }
}

/* =========================
   DISPLAY RESULTS
   ========================= */

function displayResults() {
    imageGrid.replaceChildren();

    if (!convertedImages.length) {
        resultsPanel.classList.add("hidden");
        return;
    }

    convertedImages.forEach((image) => {
        const card = document.createElement("article");
        card.className = "image-card";

        const preview = document.createElement("div");
        preview.className = "image-preview";

        const img = document.createElement("img");
        img.src = image.url;
        img.alt = `PNG preview of PDF page ${image.pageNumber}`;
        img.loading = "lazy";

        preview.appendChild(img);

        const info = document.createElement("div");
        info.className = "image-card-info";

        const title = document.createElement("h3");
        title.textContent = image.name;

        const details = document.createElement("p");
        details.textContent =
            `${image.width} × ${image.height} px · ${formatBytes(image.blob.size)}`;

        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.className = "download-btn";
        downloadButton.textContent = "Download PNG";

        downloadButton.addEventListener("click", () => {
            downloadBlob(image.blob, image.name);
        });

        info.append(title, details, downloadButton);
        card.append(preview, info);

        imageGrid.appendChild(card);
    });

    resultsSummary.textContent =
        `${convertedImages.length} PNG image${convertedImages.length === 1 ? "" : "s"} ready to download.`;

    resultsPanel.classList.remove("hidden");

    resultsPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* =========================
   DOWNLOAD PNG
   ========================= */

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================
   DOWNLOAD ZIP
   ========================= */

downloadZipBtn.addEventListener("click", async () => {
    if (!convertedImages.length || isConverting) {
        return;
    }

    if (typeof JSZip === "undefined") {
        showStatus(
            "The ZIP library did not load. You can download each PNG individually.",
            "error"
        );
        return;
    }

    downloadZipBtn.disabled = true;
    clearStatus();

    try {
        const zip = new JSZip();
        const baseName = safeBaseName(selectedFile?.name || "converted-document");

        convertedImages.forEach((image) => {
            zip.file(image.name, image.blob);
        });

        showStatus("Creating your ZIP file...", "info");

        const zipBlob = await zip.generateAsync(
            {
                type: "blob",
                compression: "STORE"
            },
            (metadata) => {
                resultsSummary.textContent =
                    `Preparing ZIP: ${Math.round(metadata.percent)}%`;
            }
        );

        downloadBlob(zipBlob, `${baseName}-png-images.zip`);

        resultsSummary.textContent =
            `${convertedImages.length} PNG image(s) ready to download.`;

        showStatus("Your ZIP file is ready.", "success");

    } catch (error) {
        console.error("ZIP error:", error);

        showStatus(
            "Could not create the ZIP file. Please download the images individually.",
            "error"
        );

    } finally {
        downloadZipBtn.disabled = false;
    }
});

/* =========================
   REMOVE / START AGAIN
   ========================= */

removeFileBtn.addEventListener("click", () => {
    if (isConverting) return;

    resetTool();
    uploadBox.classList.remove("hidden");
});

convertAnotherBtn.addEventListener("click", () => {
    if (isConverting) return;

    resetTool();
    uploadBox.classList.remove("hidden");

    uploadBox.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});

/* =========================
   FOOTER YEAR
   ========================= */

document.getElementById("currentYear").textContent =
    new Date().getFullYear();