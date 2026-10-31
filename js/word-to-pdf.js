const wordInput = document.getElementById("wordInput");
const uploadArea = document.getElementById("uploadArea");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const fileDetails = document.getElementById("fileDetails");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFileBtn = document.getElementById("removeFileBtn");
const outputName = document.getElementById("outputName");
const convertBtn = document.getElementById("convertBtn");
const downloadBtn = document.getElementById("downloadBtn");

const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const statusMessage = document.getElementById("statusMessage");

const previewSection = document.getElementById("previewSection");
const documentContent = document.getElementById("documentContent");

const MAX_FILE_SIZE = 50 * 1024 * 1024;

let selectedFile = null;
let isConverting = false;
let convertedSuccessfully = false;

// Show the current year in the footer.
document.getElementById("currentYear").textContent =
    new Date().getFullYear();

// Open the file picker.
chooseFileBtn.addEventListener("click", () => {
    if (!isConverting) {
        wordInput.click();
    }
});

// Clicking the upload area also opens the picker.
uploadArea.addEventListener("click", (event) => {
    if (
        !isConverting &&
        !event.target.closest("button") &&
        event.target.id !== "wordInput"
    ) {
        wordInput.click();
    }
});

// Handle a selected document.
wordInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (file) {
        handleFile(file);
    }
});

// Drag-and-drop support.
uploadArea.addEventListener("dragover", (event) => {
    event.preventDefault();

    if (!isConverting) {
        uploadArea.classList.add("drag-over");
    }
});

uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over");
});

uploadArea.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadArea.classList.remove("drag-over");

    if (isConverting) {
        return;
    }

    const file = event.dataTransfer.files[0];

    if (file) {
        handleFile(file);
    }
});

// Validate the selected DOCX file.
function handleFile(file) {
    hideStatus();

    const hasDocxExtension = /\.docx$/i.test(file.name);

    if (!hasDocxExtension) {
        showStatus(
            "Please select a Word document with the .docx extension. Older .doc files are not supported.",
            "error"
        );

        wordInput.value = "";
        return;
    }

    if (file.size === 0) {
        showStatus("The selected document is empty.", "error");
        wordInput.value = "";
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showStatus(
            "The file exceeds the 50 MB limit. Please choose a smaller document.",
            "error"
        );

        wordInput.value = "";
        return;
    }

    selectedFile = file;
    convertedSuccessfully = false;

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);

    outputName.value =
        file.name.replace(/\.docx$/i, "") || "converted-document";

    fileDetails.hidden = false;
    uploadArea.hidden = true;

    convertBtn.disabled = false;
    downloadBtn.disabled = true;

    previewSection.hidden = true;
    documentContent.replaceChildren();

    resetProgress();
}

// Remove the selected document.
removeFileBtn.addEventListener("click", () => {
    if (isConverting) {
        return;
    }

    selectedFile = null;
    convertedSuccessfully = false;

    wordInput.value = "";
    outputName.value = "converted-document";

    fileDetails.hidden = true;
    uploadArea.hidden = false;

    convertBtn.disabled = true;
    downloadBtn.disabled = true;

    previewSection.hidden = true;
    documentContent.replaceChildren();

    hideStatus();
    resetProgress();
});

// Convert the Word document into a PDF preview.
convertBtn.addEventListener("click", convertWordToPdf);

// Download the prepared PDF.
downloadBtn.addEventListener("click", downloadPdf);

async function convertWordToPdf() {
    if (!selectedFile || isConverting) {
        return;
    }

    if (!window.mammoth) {
        showStatus(
            "The Word document library could not load. Check your internet connection and refresh the page.",
            "error"
        );
        return;
    }

    if (!window.html2pdf) {
        showStatus(
            "The PDF conversion library could not load. Check your internet connection and refresh the page.",
            "error"
        );
        return;
    }

    isConverting = true;

    convertBtn.disabled = true;
    removeFileBtn.disabled = true;
    chooseFileBtn.disabled = true;
    downloadBtn.disabled = true;

    hideStatus();
    resetProgress();

    showProgress(10, "Reading your Word document...");

    try {
        const arrayBuffer = await selectedFile.arrayBuffer();

        showProgress(30, "Extracting document content...");

        const result = await mammoth.convertToHtml(
            { arrayBuffer },
            {
                includeDefaultStyleMap: true
            }
        );

        const parsedHtml = new DOMParser().parseFromString(
            result.value,
            "text/html"
        );

        const safeFragment = createSafeDocumentFragment(parsedHtml.body);

        if (!safeFragment.textContent.trim() &&
            !safeFragment.querySelector("img")) {
            throw new Error(
                "No readable content was found in this Word document."
            );
        }

        showProgress(55, "Preparing document preview...");

        documentContent.replaceChildren(safeFragment);

        documentContent.classList.remove("pdf-render-mode");

        previewSection.hidden = false;
        convertedSuccessfully = true;

        downloadBtn.disabled = false;

        showProgress(75, "Preparing your PDF...");

        // Wait for images and browser layout before enabling download.
        await waitForImages(documentContent);

        await new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });

        showProgress(100, "Document preview is ready.");

        const warnings = result.messages || [];
        const hasWarnings = warnings.some(
            (message) => message.type === "warning"
        );

        if (hasWarnings) {
            showStatus(
                "Your document is ready for conversion, but some Word formatting may not have been preserved. Review the preview and downloaded PDF.",
                "warning"
            );
        } else {
            showStatus(
                "Your document is ready. Review the preview and click Download PDF.",
                "success"
            );
        }

        previewSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error("Word to PDF conversion failed:", error);

        convertedSuccessfully = false;
        downloadBtn.disabled = true;

        showStatus(
            error && error.message
                ? `Could not convert the document: ${error.message}`
                : "An unexpected error occurred while converting the document.",
            "error"
        );

    } finally {
        isConverting = false;

        convertBtn.disabled = !selectedFile;
        removeFileBtn.disabled = false;
        chooseFileBtn.disabled = false;
    }
}

// Allow only common document elements and safe attributes.
// This prevents arbitrary markup from the imported document
// from being inserted directly into the page.
function createSafeDocumentFragment(sourceBody) {
    const allowedTags = new Set([
        "P",
        "BR",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "STRONG",
        "B",
        "EM",
        "I",
        "U",
        "S",
        "DEL",
        "SUB",
        "SUP",
        "UL",
        "OL",
        "LI",
        "BLOCKQUOTE",
        "TABLE",
        "THEAD",
        "TBODY",
        "TFOOT",
        "TR",
        "TH",
        "TD",
        "IMG",
        "A",
        "SPAN",
        "DIV"
    ]);

    const output = document.createDocumentFragment();

    function copyNode(sourceNode, targetParent) {
        if (sourceNode.nodeType === Node.TEXT_NODE) {
            targetParent.appendChild(
                document.createTextNode(sourceNode.nodeValue || "")
            );
            return;
        }

        if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const tag = sourceNode.tagName;

        // Flatten unsupported elements while preserving their text.
        if (!allowedTags.has(tag)) {
            for (const child of sourceNode.childNodes) {
                copyNode(child, targetParent);
            }
            return;
        }

        const element = document.createElement(tag.toLowerCase());

        if (tag === "IMG") {
            const src = sourceNode.getAttribute("src") || "";

            // Only allow embedded data images.
            if (!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)) {
                return;
            }

            element.src = src;
            element.alt = sourceNode.getAttribute("alt") || "";
            element.loading = "eager";
        }

        if (tag === "A") {
            const href = sourceNode.getAttribute("href") || "";

            // Keep ordinary web links, email links, and anchors only.
            if (/^(https?:|mailto:|#)/i.test(href)) {
                element.setAttribute("href", href);
            }
        }

        // Copy only basic formatting properties.
        const style = sourceNode.getAttribute("style") || "";

        if (style) {
            const safeProperties = [
                "color",
                "background-color",
                "font-weight",
                "font-style",
                "text-decoration",
                "text-align",
                "font-size",
                "font-family"
            ];

            const safeStyle = [];

            for (const declaration of style.split(";")) {
                const separator = declaration.indexOf(":");

                if (separator === -1) {
                    continue;
                }

                const property = declaration
                    .slice(0, separator)
                    .trim()
                    .toLowerCase();

                const value = declaration
                    .slice(separator + 1)
                    .trim();

                if (
                    safeProperties.includes(property) &&
                    value &&
                    !/url\s*\(|expression\s*\(|javascript:/i.test(value)
                ) {
                    safeStyle.push(`${property}: ${value}`);
                }
            }

            if (safeStyle.length > 0) {
                element.setAttribute("style", safeStyle.join("; "));
            }
        }

        if (tag === "TD" || tag === "TH") {
            for (const attr of ["colspan", "rowspan"]) {
                const value = sourceNode.getAttribute(attr);

                if (value && /^\d{1,2}$/.test(value)) {
                    element.setAttribute(attr, value);
                }
            }
        }

        for (const child of sourceNode.childNodes) {
            copyNode(child, element);
        }

        targetParent.appendChild(element);
    }

    for (const child of sourceBody.childNodes) {
        copyNode(child, output);
    }

    return output;
}

// Wait for embedded images to finish loading.
async function waitForImages(container) {
    const images = Array.from(container.querySelectorAll("img"));

    await Promise.all(
        images.map((image) => {
            if (image.complete) {
                return Promise.resolve();
            }

            return new Promise((resolve) => {
                image.onload = resolve;
                image.onerror = resolve;

                // Avoid waiting indefinitely for a damaged image.
                setTimeout(resolve, 5000);
            });
        })
    );
}

// Generate and download the PDF.
async function downloadPdf() {
    if (!convertedSuccessfully || isConverting) {
        return;
    }

    if (!window.html2pdf) {
        showStatus(
            "The PDF library is unavailable. Refresh the page and try again.",
            "error"
        );
        return;
    }

    isConverting = true;
    downloadBtn.disabled = true;
    convertBtn.disabled = true;
    removeFileBtn.disabled = true;

    hideStatus();

    let temporaryContainer = null;

    try {
        showProgress(10, "Preparing the PDF layout...");

        // Use a dedicated render container so the preview remains unchanged.
        temporaryContainer = document.createElement("div");
        temporaryContainer.className = "document-content pdf-render-mode";

        // Keep it renderable by html2canvas while off-screen.
        temporaryContainer.style.position = "fixed";
        temporaryContainer.style.left = "-10000px";
        temporaryContainer.style.top = "0";
        temporaryContainer.style.zIndex = "-1";
        temporaryContainer.style.width = "794px";
        temporaryContainer.style.background = "#ffffff";

        temporaryContainer.appendChild(
            documentContent.cloneNode(true)
        );

        // Avoid nesting a cloned document-content element.
        const clonedRoot = temporaryContainer.firstElementChild;

        if (clonedRoot) {
            while (clonedRoot.firstChild) {
                temporaryContainer.appendChild(clonedRoot.firstChild);
            }

            clonedRoot.remove();
        }

        document.body.appendChild(temporaryContainer);

        await waitForImages(temporaryContainer);

        await new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });

        showProgress(35, "Rendering PDF pages...");

        const options = {
            margin: [10, 10, 10, 10],
            filename: `${getOutputFileName()}.pdf`,
            image: {
                type: "jpeg",
                quality: 0.95
            },
            html2canvas: {
                scale: 2,
                useCORS: false,
                backgroundColor: "#ffffff",
                logging: false,
                scrollX: 0,
                scrollY: 0
            },
            jsPDF: {
                unit: "mm",
                format: "a4",
                orientation: "portrait"
            },
            pagebreak: {
                mode: ["css", "legacy"],
                avoid: ["tr", "img", "blockquote"]
            }
        };

        showProgress(60, "Creating your PDF file...");

        await html2pdf()
            .set(options)
            .from(temporaryContainer)
            .save();

        showProgress(100, "PDF download started.");

        showStatus(
            "Your PDF download has started. Open the downloaded file to check the layout and content.",
            "success"
        );

    } catch (error) {
        console.error("PDF creation failed:", error);

        showStatus(
            error && error.message
                ? `Could not create the PDF: ${error.message}`
                : "An unexpected error occurred while creating the PDF.",
            "error"
        );

    } finally {
        if (temporaryContainer) {
            temporaryContainer.remove();
        }

        isConverting = false;

        convertBtn.disabled = !selectedFile;
        removeFileBtn.disabled = false;
        chooseFileBtn.disabled = false;
        downloadBtn.disabled = !convertedSuccessfully;
    }
}

// Return a safe filename without an extension.
function getOutputFileName() {
    let name = outputName.value.trim();

    name = name
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/[. ]+$/g, "")
        .slice(0, 100);

    return name || "converted-document";
}

// Format the selected file size.
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} bytes`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Update progress.
function showProgress(percent, message) {
    progressContainer.hidden = false;

    progressBar.style.width =
        `${Math.max(0, Math.min(100, percent))}%`;

    progressText.textContent = message;
}

// Reset progress display.
function resetProgress() {
    progressContainer.hidden = true;
    progressBar.style.width = "0%";
    progressText.textContent = "Preparing your document...";
}

// Show a status message.
function showStatus(message, type = "success") {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.hidden = false;
}

// Hide a status message.
function hideStatus() {
    statusMessage.hidden = true;
    statusMessage.textContent = "";
    statusMessage.className = "status-message";
}