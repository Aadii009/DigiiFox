const pdfInput = document.getElementById("pdfInput");
const browseBtn = document.getElementById("browseBtn");
const dropZone = document.getElementById("dropZone");

const workspace = document.getElementById("workspace");
const fileName = document.getElementById("fileName");
const fileDetails = document.getElementById("fileDetails");

const pageMode = document.getElementById("pageMode");
const selectedPagesBox = document.getElementById("selectedPagesBox");
const selectedPagesInput = document.getElementById("selectedPages");
const imageQuality = document.getElementById("imageQuality");

const convertBtn = document.getElementById("convertBtn");
const removeBtn = document.getElementById("removeBtn");

const statusMessage = document.getElementById("statusMessage");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const resultsSection = document.getElementById("resultsSection");
const resultsSummary = document.getElementById("resultsSummary");
const imageGrid = document.getElementById("imageGrid");
const downloadZipBtn = document.getElementById("downloadZipBtn");

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_RENDER_PIXELS = 20_000_000;

let selectedFile = null;
let pdfDocument = null;
let convertedImages = [];
let conversionInProgress = false;

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

browseBtn.addEventListener("click", () => {
    pdfInput.click();
});

pdfInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];

    if (file) {
        await loadPdf(file);
    }
});

dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");

    const file = event.dataTransfer.files[0];

    if (file) {
        await loadPdf(file);
    }
});

pageMode.addEventListener("change", () => {
    selectedPagesBox.classList.toggle(
        "hidden",
        pageMode.value !== "selected"
    );
});

convertBtn.addEventListener("click", convertPdfToJpg);
downloadZipBtn.addEventListener("click", downloadZip);
removeBtn.addEventListener("click", resetTool);

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

function setProgress(percent, message) {
    progressContainer.classList.remove("hidden");

    progressBar.style.width = `${percent}%`;
    progressText.textContent = message;
}

async function loadPdf(file) {
    if (conversionInProgress) {
        return;
    }

    setStatus("");

    if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert("Please select a PDF file.");
        pdfInput.value = "";
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        alert("The maximum supported file size is 50 MB.");
        pdfInput.value = "";
        return;
    }

    if (file.size === 0) {
        alert("The selected file is empty.");
        pdfInput.value = "";
        return;
    }

    try {
        if (!window.pdfjsLib) {
            throw new Error("The PDF rendering library could not load. Check your internet connection.");
        }

        setStatus("Opening PDF...");

        const bytes = await file.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(bytes)
        });

        const loadedDocument = await loadingTask.promise;

        if (loadedDocument.numPages < 1) {
            throw new Error("This PDF has no pages.");
        }

        if (pdfDocument) {
            await pdfDocument.destroy();
        }

        pdfDocument = loadedDocument;
        selectedFile = file;

        fileName.textContent = file.name;
        fileDetails.textContent =
            `${pdfDocument.numPages} pages · ${formatBytes(file.size)}`;

        dropZone.classList.add("hidden");
        workspace.classList.remove("hidden");
        resultsSection.classList.add("hidden");

        clearConvertedImages();
        setStatus("");
        progressContainer.classList.add("hidden");
    } catch (error) {
        console.error(error);

        setStatus(
            error.message || "Unable to open this PDF.",
            "error"
        );
    }
}

function parsePageNumbers(input, pageCount) {
    const value = input.trim();

    if (!value) {
        throw new Error("Enter at least one page number.");
    }

    const result = new Set();
    const parts = value.split(",");

    for (const part of parts) {
        const item = part.trim();

        if (!item) {
            throw new Error("Check your page list for empty entries.");
        }

        const rangeMatch = item.match(/^(\d+)\s*-\s*(\d+)$/);

        if (rangeMatch) {
            const start = Number(rangeMatch[1]);
            const end = Number(rangeMatch[2]);

            if (start < 1 || end > pageCount || start > end) {
                throw new Error(
                    `Invalid range "${item}". Use page numbers from 1 to ${pageCount}.`
                );
            }

            for (let page = start; page <= end; page++) {
                result.add(page);
            }
        } else {
            if (!/^\d+$/.test(item)) {
                throw new Error(
                    `Invalid page entry "${item}". Use numbers, commas, or ranges such as 2-5.`
                );
            }

            const page = Number(item);

            if (page < 1 || page > pageCount) {
                throw new Error(
                    `Page ${page} does not exist. This PDF has ${pageCount} pages.`
                );
            }

            result.add(page);
        }
    }

    return [...result].sort((a, b) => a - b);
}

async function convertPdfToJpg() {
    if (conversionInProgress) {
        return;
    }

    if (!pdfDocument || !selectedFile) {
        setStatus("Please upload a PDF first.", "error");
        return;
    }

    if (!window.JSZip) {
        setStatus("The ZIP library could not load. Reload the page and try again.", "error");
        return;
    }

    let pagesToConvert;

    try {
        if (pageMode.value === "all") {
            pagesToConvert = Array.from(
                { length: pdfDocument.numPages },
                (_, index) => index + 1
            );
        } else {
            pagesToConvert = parsePageNumbers(
                selectedPagesInput.value,
                pdfDocument.numPages
            );
        }
    } catch (error) {
        setStatus(error.message, "error");
        return;
    }

    const scale = Number(imageQuality.value);

    if (![1, 1.5, 2].includes(scale)) {
        setStatus("Please choose a valid image resolution.", "error");
        return;
    }

    conversionInProgress = true;
    convertBtn.disabled = true;
    removeBtn.disabled = true;
    convertBtn.textContent = "Converting...";

    resultsSection.classList.add("hidden");
    clearConvertedImages();

    try {
        const outputImages = [];

        for (let index = 0; index < pagesToConvert.length; index++) {
            const pageNumber = pagesToConvert[index];

            setProgress(
                Math.round((index / pagesToConvert.length) * 100),
                `Converting page ${pageNumber} of ${pdfDocument.numPages}...`
            );

            const page = await pdfDocument.getPage(pageNumber);

            const baseViewport = page.getViewport({ scale: 1 });

            // Limit canvas dimensions to reduce the risk of excessive memory use.
            const maxScale = Math.sqrt(
                MAX_RENDER_PIXELS /
                (baseViewport.width * baseViewport.height)
            );

            const effectiveScale = Math.min(scale, maxScale);
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

            if (canvas.width < 1 || canvas.height < 1) {
                throw new Error(`Page ${pageNumber} has invalid dimensions.`);
            }

            await page.render({
                canvasContext: context,
                viewport,
                background: "rgb(255, 255, 255)"
            }).promise;

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error(`Could not create JPG for page ${pageNumber}.`));
                    }
                }, "image/jpeg", 0.92);
            });

            const imageName = `page-${String(pageNumber).padStart(3, "0")}.jpg`;

            outputImages.push({
                pageNumber,
                name: imageName,
                blob,
                url: URL.createObjectURL(blob)
            });

            canvas.width = 0;
            canvas.height = 0;

            page.cleanup();
        }

        convertedImages = outputImages;

        renderImageCards();

        resultsSummary.textContent =
            `${convertedImages.length} image(s) created · ${formatBytes(
                convertedImages.reduce((total, image) => total + image.blob.size, 0)
            )} total`;

        resultsSection.classList.remove("hidden");

        setProgress(100, "Conversion completed successfully.");
        setStatus("Your JPG images are ready.", "success");

        resultsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        console.error(error);

        setStatus(
            error.message || "Something went wrong during conversion.",
            "error"
        );
    } finally {
        conversionInProgress = false;
        convertBtn.disabled = false;
        removeBtn.disabled = false;
        convertBtn.textContent = "🖼️ Convert to JPG";
    }
}

function renderImageCards() {
    imageGrid.replaceChildren();

    convertedImages.forEach((image) => {
        const card = document.createElement("article");
        card.className = "image-card";

        const preview = document.createElement("div");
        preview.className = "image-preview";

        const img = document.createElement("img");
        img.src = image.url;
        img.alt = `JPG preview of PDF page ${image.pageNumber}`;
        img.loading = "lazy";

        preview.appendChild(img);

        const body = document.createElement("div");
        body.className = "image-card-body";

        const title = document.createElement("h3");
        title.textContent = image.name;

        const size = document.createElement("p");
        size.textContent = formatBytes(image.blob.size);

        const downloadLink = document.createElement("a");
        downloadLink.className = "primary-btn";
        downloadLink.href = image.url;
        downloadLink.download = image.name;
        downloadLink.textContent = "⬇ Download JPG";

        body.append(title, size, downloadLink);
        card.append(preview, body);
        imageGrid.appendChild(card);
    });
}

async function downloadZip() {
    if (convertedImages.length === 0) {
        setStatus("Convert at least one page before downloading.", "error");
        return;
    }

    if (!window.JSZip) {
        setStatus("The ZIP library could not load. Reload the page and try again.", "error");
        return;
    }

    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = "Preparing ZIP...";

    try {
        const zip = new JSZip();

        convertedImages.forEach((image) => {
            zip.file(image.name, image.blob);
        });

        const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "STORE"
        });

        const zipUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");

        const baseName = selectedFile
            ? selectedFile.name.replace(/\.pdf$/i, "")
            : "converted-images";

        link.href = zipUrl;
        link.download = `${baseName}-jpg-images.zip`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(zipUrl), 60000);
    } catch (error) {
        console.error(error);
        setStatus("Could not create the ZIP file. Try downloading images individually.", "error");
    } finally {
        downloadZipBtn.disabled = false;
        downloadZipBtn.textContent = "⬇ Download ZIP";
    }
}

function clearConvertedImages() {
    convertedImages.forEach((image) => {
        URL.revokeObjectURL(image.url);
    });

    convertedImages = [];
    imageGrid.replaceChildren();
}

async function resetTool() {
    if (conversionInProgress) {
        return;
    }

    clearConvertedImages();

    if (pdfDocument) {
        try {
            await pdfDocument.destroy();
        } catch (error) {
            console.warn("PDF cleanup warning:", error);
        }
    }

    pdfDocument = null;
    selectedFile = null;
    pdfInput.value = "";
    selectedPagesInput.value = "";
    pageMode.value = "all";
    imageQuality.value = "1.5";

    selectedPagesBox.classList.add("hidden");
    workspace.classList.add("hidden");
    resultsSection.classList.add("hidden");
    dropZone.classList.remove("hidden");
    progressContainer.classList.add("hidden");

    progressBar.style.width = "0%";
    setStatus("");
}