const pdfInput = document.getElementById("pdfInput");
const uploadArea = document.getElementById("uploadArea");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const fileDetails = document.getElementById("fileDetails");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFileBtn = document.getElementById("removeFileBtn");
const outputName = document.getElementById("outputName");
const convertBtn = document.getElementById("convertBtn");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const statusMessage = document.getElementById("statusMessage");

let selectedFile = null;
let isConverting = false;

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_PAGES = 500;

// Configure PDF.js worker.
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// Display the current year in the footer.
document.getElementById("currentYear").textContent =
    new Date().getFullYear();

// Open the file picker.
chooseFileBtn.addEventListener("click", () => {
    if (!isConverting) {
        pdfInput.click();
    }
});

// Also allow the upload area to open the file picker.
uploadArea.addEventListener("click", (event) => {
    if (
        !isConverting &&
        !event.target.closest("button") &&
        event.target.id !== "pdfInput"
    ) {
        pdfInput.click();
    }
});

// Handle the selected PDF.
pdfInput.addEventListener("change", (event) => {
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

// Remove the selected PDF.
removeFileBtn.addEventListener("click", () => {
    if (isConverting) {
        return;
    }

    selectedFile = null;
    pdfInput.value = "";

    fileDetails.hidden = true;
    uploadArea.hidden = false;
    convertBtn.disabled = true;

    outputName.value = "converted-document";

    hideStatus();
    resetProgress();
});

// Validate and display the file.
function handleFile(file) {
    hideStatus();

    const isPdfName = file.name.toLowerCase().endsWith(".pdf");
    const isPdfType =
        file.type === "application/pdf" || file.type === "";

    if (!isPdfName || !isPdfType) {
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
        showStatus(
            "This file exceeds the 100 MB limit. Please choose a smaller PDF.",
            "error"
        );
        pdfInput.value = "";
        return;
    }

    selectedFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);

    outputName.value = file.name.replace(/\.pdf$/i, "") || "converted-document";

    fileDetails.hidden = false;
    uploadArea.hidden = true;
    convertBtn.disabled = false;

    resetProgress();
}

// Convert the PDF to a DOCX document.
convertBtn.addEventListener("click", convertPdfToWord);

async function convertPdfToWord() {
    if (!selectedFile || isConverting) {
        return;
    }

    if (!window.pdfjsLib) {
        showStatus(
            "The PDF library could not load. Check your internet connection and refresh the page.",
            "error"
        );
        return;
    }

    if (!window.docx) {
        showStatus(
            "The Word document library could not load. Check your internet connection and refresh the page.",
            "error"
        );
        return;
    }

    isConverting = true;
    convertBtn.disabled = true;
    removeFileBtn.disabled = true;
    chooseFileBtn.disabled = true;

    hideStatus();
    showProgress(2, "Opening your PDF...");

    let pdfDocument = null;

    try {
        const fileBytes = new Uint8Array(
            await selectedFile.arrayBuffer()
        );

        pdfDocument = await pdfjsLib.getDocument({
            data: fileBytes
        }).promise;

        if (pdfDocument.numPages > MAX_PAGES) {
            throw new Error(
                `This PDF contains ${pdfDocument.numPages} pages. The current limit is ${MAX_PAGES} pages.`
            );
        }

        if (pdfDocument.numPages === 0) {
            throw new Error("The PDF does not contain any pages.");
        }

        const {
            Document,
            Paragraph,
            TextRun,
            Packer
        } = window.docx;

        const wordParagraphs = [];
        let extractedCharacters = 0;

        for (let pageNumber = 1;
             pageNumber <= pdfDocument.numPages;
             pageNumber++) {

            showProgress(
                5 + Math.round(
                    (pageNumber / pdfDocument.numPages) * 70
                ),
                `Extracting text from page ${pageNumber} of ${pdfDocument.numPages}...`
            );

            const page = await pdfDocument.getPage(pageNumber);
            const textContent = await page.getTextContent();

            const lines = groupTextIntoLines(textContent.items);

            if (pageNumber > 1) {
                // Add a page break before each new PDF page.
                wordParagraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "",
                                break: 1
                            })
                        ],
                        pageBreakBefore: true
                    })
                );
            }

            if (lines.length === 0) {
                wordParagraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "[No selectable text found on this page]",
                                italics: true,
                                color: "777777"
                            })
                        ]
                    })
                );
            } else {
                for (const line of lines) {
                    const cleanLine = normalizeText(line);

                    if (cleanLine.length > 0) {
                        extractedCharacters += cleanLine.length;

                        wordParagraphs.push(
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: cleanLine
                                    })
                                ],
                                spacing: {
                                    after: 100
                                }
                            })
                        );
                    } else {
                        // Preserve some paragraph spacing.
                        wordParagraphs.push(
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: ""
                                    })
                                ],
                                spacing: {
                                    after: 80
                                }
                            })
                        );
                    }
                }
            }

            page.cleanup();
        }

        if (extractedCharacters === 0) {
            showStatus(
                "No selectable text was found. This may be a scanned PDF that requires OCR.",
                "warning"
            );
            return;
        }

        showProgress(82, "Creating your Word document...");

        const wordDocument = new Document({
            creator: "DigiiFox",
            title: getOutputFileName(),
            description: "Text extracted from a PDF using DigiiFox.",
            sections: [
                {
                    properties: {},
                    children: wordParagraphs
                }
            ]
        });

        showProgress(92, "Preparing your download...");

        const blob = await Packer.toBlob(wordDocument);

        showProgress(98, "Finishing your document...");

        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");

        downloadLink.href = downloadUrl;
        downloadLink.download = `${getOutputFileName()}.docx`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        // Release the temporary download URL.
        setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
        }, 1000);

        showProgress(100, "Conversion complete.");

        showStatus(
            `Your Word document has been created. Extracted text from ${pdfDocument.numPages} page(s). Check the downloaded DOCX for formatting and missing text.`,
            "success"
        );

    } catch (error) {
        console.error("PDF to Word conversion failed:", error);

        const errorMessage = error && error.message
            ? error.message
            : "An unexpected error occurred.";

        if (
            /password|encrypted/i.test(errorMessage)
        ) {
            showStatus(
                "This PDF may be password-protected. Please use a PDF you can open without a password and try again.",
                "error"
            );
        } else {
            showStatus(
                `Conversion failed: ${errorMessage}`,
                "error"
            );
        }

    } finally {
        if (pdfDocument) {
            try {
                await pdfDocument.destroy();
            } catch (cleanupError) {
                console.warn("PDF cleanup warning:", cleanupError);
            }
        }

        isConverting = false;
        convertBtn.disabled = !selectedFile;
        removeFileBtn.disabled = false;
        chooseFileBtn.disabled = false;
    }
}

// Group nearby PDF text items into lines using their vertical positions.
function groupTextIntoLines(items) {
    const textItems = items
        .filter((item) => {
            return (
                typeof item.str === "string" &&
                item.str.length > 0 &&
                Array.isArray(item.transform)
            );
        })
        .map((item) => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width || 0,
            height: Math.abs(item.transform[3]) || 10
        }))
        .sort((a, b) => {
            if (Math.abs(b.y - a.y) > 2) {
                return b.y - a.y;
            }

            return a.x - b.x;
        });

    const lines = [];

    for (const item of textItems) {
        let matchingLine = null;

        for (const line of lines) {
            const tolerance = Math.max(
                2,
                Math.min(item.height, line.averageHeight) * 0.35
            );

            if (Math.abs(line.y - item.y) <= tolerance) {
                matchingLine = line;
                break;
            }
        }

        if (!matchingLine) {
            lines.push({
                y: item.y,
                averageHeight: item.height,
                items: [item]
            });

            continue;
        }

        matchingLine.items.push(item);

        const count = matchingLine.items.length;

        matchingLine.averageHeight =
            (
                matchingLine.averageHeight * (count - 1) +
                item.height
            ) / count;
    }

    lines.sort((a, b) => b.y - a.y);

    return lines.map((line) => {
        line.items.sort((a, b) => a.x - b.x);

        let result = "";
        let previousItem = null;

        for (const item of line.items) {
            if (previousItem) {
                const previousEnd =
                    previousItem.x + previousItem.width;

                const gap = item.x - previousEnd;
                const spaceThreshold = Math.max(
                    2,
                    item.height * 0.2
                );

                if (
                    gap > spaceThreshold &&
                    !result.endsWith(" ") &&
                    !item.text.startsWith(" ")
                ) {
                    result += " ";
                }
            }

            result += item.text;
            previousItem = item;
        }

        return result;
    });
}

// Normalize extracted text without merging words.
function normalizeText(text) {
    return text
        .replace(/\u00a0/g, " ")
        .replace(/[\u200b-\u200d\ufeff]/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();
}

// Return a safe filename without a file extension.
function getOutputFileName() {
    let name = outputName.value.trim();

    name = name
        .replace(/\.docx$/i, "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/[. ]+$/g, "")
        .slice(0, 100);

    return name || "converted-document";
}

// Display a human-readable file size.
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} bytes`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Update the progress bar.
function showProgress(percent, message) {
    progressContainer.hidden = false;

    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressText.textContent = message;
}

// Reset progress display.
function resetProgress() {
    progressContainer.hidden = true;
    progressBar.style.width = "0%";
    progressText.textContent = "Preparing your document...";
}

// Display a status message.
function showStatus(message, type = "success") {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.hidden = false;
}

// Hide the status message.
function hideStatus() {
    statusMessage.hidden = true;
    statusMessage.textContent = "";
    statusMessage.className = "status-message";
}