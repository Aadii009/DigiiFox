"use strict";

const pdfInput = document.getElementById("pdfInput");
const dropArea = document.getElementById("dropArea");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFileButton = document.getElementById("removeFile");
const convertButton = document.getElementById("convertButton");
const sheetNameInput = document.getElementById("sheetName");
const pageRangeSelect = document.getElementById("pageRange");
const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const message = document.getElementById("message");

let selectedFile = null;
let isConverting = false;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Configure PDF.js.
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// Display the current year in the footer.
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
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
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
    if (isConverting) {
        return;
    }

    clearMessage();
    resetProgress();

    if (!file) {
        return;
    }

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
        showMessage("The file exceeds the 50 MB limit. Please choose a smaller PDF.");
        return;
    }

    selectedFile = file;
    updateFileDisplay();
}

pdfInput.addEventListener("change", (event) => {
    selectFile(event.target.files[0]);
});

// Remove the selected file.
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

// Drag-and-drop upload.
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

    const file = event.dataTransfer.files[0];
    selectFile(file);
});

function cleanWorksheetName(name) {
    let cleaned = name
        .replace(/[\\/?*[\]:]/g, "")
        .trim();

    if (!cleaned) {
        cleaned = "PDF Data";
    }

    return cleaned.slice(0, 31);
}

/*
 * Group PDF text items into approximate visual lines.
 * PDF text positioning is not equivalent to spreadsheet cell structure,
 * so the resulting columns are best-effort approximations.
 */
function groupItemsIntoRows(items) {
    const positionedItems = items
        .filter(item => item.str && item.str.trim())
        .map(item => ({
            text: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5],
            width: item.width || 0
        }))
        .sort((a, b) => {
            // PDF coordinates usually increase upward.
            if (Math.abs(b.y - a.y) > 3) {
                return b.y - a.y;
            }

            return a.x - b.x;
        });

    const lines = [];

    for (const item of positionedItems) {
        let line = lines.find(
            candidate => Math.abs(candidate.y - item.y) <= 3
        );

        if (!line) {
            line = {
                y: item.y,
                items: []
            };

            lines.push(line);
        }

        line.items.push(item);
    }

    lines.sort((a, b) => b.y - a.y);

    return lines.map(line => {
        line.items.sort((a, b) => a.x - b.x);

        const cells = [];
        let previousItem = null;

        for (const item of line.items) {
            if (previousItem) {
                const previousRight =
                    previousItem.x + previousItem.width;

                const gap = item.x - previousRight;

                // A large horizontal gap may indicate another column.
                if (gap > 22) {
                    cells.push("");
                }
            }

            cells.push(item.text);
            previousItem = item;
        }

        return cells;
    });
}

function padRows(rows) {
    const maxColumns = Math.max(
        1,
        ...rows.map(row => row.length)
    );

    return rows.map(row => {
        const padded = [...row];

        while (padded.length < maxColumns) {
            padded.push("");
        }

        return padded;
    });
}

async function convertPdfToExcel() {
    if (isConverting) {
        return;
    }

    clearMessage();

    if (!selectedFile) {
        showMessage("Please choose a PDF file first.");
        return;
    }

    if (!window.pdfjsLib || !window.XLSX) {
        showMessage(
            "Required libraries could not load. Check your internet connection and refresh the page."
        );
        return;
    }

    isConverting = true;
    convertButton.disabled = true;
    pdfInput.disabled = true;
    removeFileButton.disabled = true;
    pageRangeSelect.disabled = true;
    sheetNameInput.disabled = true;

    try {
        updateProgress(5, "Reading PDF file...");

        const fileBuffer = await selectedFile.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(fileBuffer)
        });

        const pdf = await loadingTask.promise;

        const pageCount =
            pageRangeSelect.value === "first"
                ? 1
                : pdf.numPages;

        const worksheetRows = [
            ["Page", "Extracted Content"]
        ];

        let extractedTextCount = 0;

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
            updateProgress(
                5 + (pageNumber / pageCount) * 80,
                `Extracting text from page ${pageNumber} of ${pageCount}...`
            );

            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();

            const pageRows = groupItemsIntoRows(textContent.items);

            if (pageRows.length === 0) {
                worksheetRows.push([
                    pageNumber,
                    "[No selectable text found on this page]"
                ]);

                continue;
            }

            for (const row of pageRows) {
                worksheetRows.push([
                    pageNumber,
                    ...row
                ]);

                extractedTextCount++;
            }
        }

        updateProgress(90, "Creating Excel workbook...");

        if (extractedTextCount === 0) {
            throw new Error(
                "No selectable text was found. This PDF may contain scanned images and require OCR."
            );
        }

        const workbook = XLSX.utils.book_new();

        const worksheet = XLSX.utils.aoa_to_sheet(
            padRows(worksheetRows)
        );

        worksheet["!cols"] = [
            { wch: 10 },
            ...Array.from(
                {
                    length: Math.max(
                        1,
                        ...worksheetRows.map(row => row.length)
                    ) - 1
                },
                () => ({ wch: 24 })
            )
        ];

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            cleanWorksheetName(sheetNameInput.value)
        );

        updateProgress(96, "Preparing your download...");

        const originalName = selectedFile.name.replace(/\.pdf$/i, "");
        const outputName = `${originalName || "converted"}-excel.xlsx`;

        XLSX.writeFile(workbook, outputName);

        updateProgress(100, "Conversion complete.");

        showMessage(
            `Excel file created successfully. Extracted ${extractedTextCount} text rows from ${pageCount} page(s). Please review the spreadsheet for layout or column errors.`,
            "success"
        );

        if (typeof pdf.destroy === "function") {
            await pdf.destroy();
        }

    } catch (error) {
        console.error("PDF to Excel conversion error:", error);

        const reason = error && error.message
            ? error.message
            : "An unexpected error occurred.";

        showMessage(`Conversion failed: ${reason}`);
        statusText.textContent = "Conversion failed.";

    } finally {
        isConverting = false;
        convertButton.disabled = !selectedFile;
        pdfInput.disabled = false;
        removeFileButton.disabled = false;
        pageRangeSelect.disabled = false;
        sheetNameInput.disabled = false;
    }
}

convertButton.addEventListener("click", convertPdfToExcel);