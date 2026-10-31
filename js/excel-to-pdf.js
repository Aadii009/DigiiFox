"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("excelFile");
    const fileInfo = document.getElementById("fileInfo");
    const conversionPanel = document.getElementById("conversionPanel");
    const worksheetSelect = document.getElementById("worksheetSelect");
    const pageSizeSelect = document.getElementById("pageSize");
    const orientationSelect = document.getElementById("orientation");
    const fontSizeSelect = document.getElementById("fontSize");
    const scaleModeSelect = document.getElementById("scaleMode");
    const previewTable = document.getElementById("previewTable");
    const previewInfo = document.getElementById("previewInfo");
    const statusMessage = document.getElementById("statusMessage");
    const convertBtn = document.getElementById("convertBtn");
    const resetBtn = document.getElementById("resetBtn");
    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    let workbook = null;
    let currentFile = null;
    let currentRows = [];

    const MAX_FILE_SIZE = 30 * 1024 * 1024;
    const MAX_PREVIEW_ROWS = 10;
    const MAX_PREVIEW_COLUMNS = 12;
    const MAX_PDF_ROWS = 20000;
    const MAX_PDF_COLUMNS = 100;

    function setStatus(message, type = "") {
        statusMessage.textContent = message;
        statusMessage.className = "status-message";

        if (type) {
            statusMessage.classList.add(type);
        }
    }

    function clearPreview() {
        previewTable.replaceChildren();
        currentRows = [];
        previewInfo.textContent = "Your spreadsheet data will appear here.";
    }

    function resetTool() {
        workbook = null;
        currentFile = null;

        fileInput.value = "";
        fileInfo.textContent = "No file selected.";
        worksheetSelect.replaceChildren();

        conversionPanel.hidden = true;
        convertBtn.disabled = false;

        clearPreview();
        setStatus("");
    }

    function normalizeCell(value) {
        if (value === null || value === undefined) {
            return "";
        }

        if (typeof value === "object") {
            return JSON.stringify(value);
        }

        return String(value);
    }

    function renderPreview() {
        if (!workbook) {
            return;
        }

        const sheetName = worksheetSelect.value;
        const worksheet = workbook.Sheets[sheetName];

        clearPreview();

        if (!worksheet) {
            setStatus("The selected worksheet could not be found.", "error");
            return;
        }

        const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: "",
            blankrows: false
        });

        currentRows = rows.map(row => row.map(normalizeCell));

        if (!currentRows.length) {
            previewInfo.textContent = "This worksheet is empty.";
            setStatus("The selected worksheet contains no data.", "error");
            return;
        }

        const tableHead = document.createElement("thead");
        const tableBody = document.createElement("tbody");

        const visibleColumnCount = Math.min(
            MAX_PREVIEW_COLUMNS,
            Math.max(1, ...currentRows.map(row => row.length))
        );

        const headerRow = document.createElement("tr");

        for (let column = 0; column < visibleColumnCount; column++) {
            const th = document.createElement("th");
            th.textContent = currentRows[0][column] || `Column ${column + 1}`;
            headerRow.appendChild(th);
        }

        tableHead.appendChild(headerRow);

        const visibleRows = currentRows.slice(1, MAX_PREVIEW_ROWS + 1);

        visibleRows.forEach(row => {
            const tr = document.createElement("tr");

            for (let column = 0; column < visibleColumnCount; column++) {
                const td = document.createElement("td");
                td.textContent = row[column] ?? "";
                tr.appendChild(td);
            }

            tableBody.appendChild(tr);
        });

        previewTable.append(tableHead, tableBody);

        const totalRows = currentRows.length;
        const totalColumns = Math.max(0, ...currentRows.map(row => row.length));

        previewInfo.textContent =
            `${totalRows.toLocaleString()} rows · ` +
            `${totalColumns.toLocaleString()} columns · ` +
            `${sheetName}`;

        if (totalRows > MAX_PREVIEW_ROWS + 1 ||
            totalColumns > MAX_PREVIEW_COLUMNS) {
            setStatus(
                `Showing a preview of the first ${MAX_PREVIEW_ROWS + 1} rows ` +
                `and ${MAX_PREVIEW_COLUMNS} columns. The PDF can include more data.`,
                ""
            );
        } else {
            setStatus("Worksheet ready to convert.", "success");
        }
    }

    async function handleFileSelection(event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        resetTool();

        // Resetting the tool clears the file input, so restore the selected file.
        fileInput.files = event.target.files;
        currentFile = file;

        const extension = file.name.split(".").pop().toLowerCase();

        if (!["xlsx", "xls"].includes(extension)) {
            resetTool();
            setStatus("Please select a valid XLS or XLSX file.", "error");
            fileInfo.textContent = "Unsupported file format.";
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            resetTool();
            fileInfo.textContent = "File is too large.";
            setStatus("Please select an Excel file smaller than 30 MB.", "error");
            return;
        }

        if (file.size === 0) {
            resetTool();
            fileInfo.textContent = "The selected file is empty.";
            setStatus("Please choose a non-empty Excel file.", "error");
            return;
        }

        fileInfo.textContent =
            `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;

        conversionPanel.hidden = false;
        convertBtn.disabled = true;
        setStatus("Reading your spreadsheet...");

        try {
            if (typeof XLSX === "undefined") {
                throw new Error(
                    "The Excel library did not load. Check your internet connection and reload the page."
                );
            }

            const arrayBuffer = await file.arrayBuffer();

            workbook = XLSX.read(arrayBuffer, {
                type: "array",
                cellDates: true
            });

            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error("No worksheets were found in this file.");
            }

            worksheetSelect.replaceChildren();

            workbook.SheetNames.forEach(sheetName => {
                const option = document.createElement("option");
                option.value = sheetName;
                option.textContent = sheetName;
                worksheetSelect.appendChild(option);
            });

            renderPreview();
            convertBtn.disabled = false;
        } catch (error) {
            console.error("Excel file processing error:", error);

            workbook = null;
            conversionPanel.hidden = true;
            fileInfo.textContent = "Could not read this Excel file.";

            setStatus(
                error.message ||
                "Could not read the spreadsheet. The file may be damaged or password-protected.",
                "error"
            );
        }
    }

    function getPdfFilename() {
        const originalName = currentFile.name.replace(/\.[^.]+$/, "");
        const safeName = originalName
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
            .trim()
            .slice(0, 100) || "spreadsheet";

        return `${safeName}.pdf`;
    }

    async function convertToPdf() {
        if (!workbook || !currentFile) {
            setStatus("Please upload an Excel file first.", "error");
            return;
        }

        if (
            typeof window.jspdf === "undefined" ||
            typeof window.jspdf.jsPDF !== "function"
        ) {
            setStatus(
                "The PDF library did not load. Check your internet connection and reload the page.",
                "error"
            );
            return;
        }

        const sheetName = worksheetSelect.value;
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
            setStatus("Please select a valid worksheet.", "error");
            return;
        }

        const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: "",
            blankrows: false
        }).map(row => row.map(normalizeCell));

        if (rows.length === 0) {
            setStatus("This worksheet has no data to convert.", "error");
            return;
        }

        const columnCount = Math.max(0, ...rows.map(row => row.length));

        if (columnCount === 0) {
            setStatus("This worksheet has no columns to convert.", "error");
            return;
        }

        if (rows.length > MAX_PDF_ROWS) {
            setStatus(
                `This worksheet contains more than ${MAX_PDF_ROWS.toLocaleString()} rows. ` +
                "Please split the data into smaller worksheets and try again.",
                "error"
            );
            return;
        }

        if (columnCount > MAX_PDF_COLUMNS) {
            setStatus(
                `This worksheet contains more than ${MAX_PDF_COLUMNS} columns. ` +
                "Please reduce the number of columns and try again.",
                "error"
            );
            return;
        }

        const hasData = rows.some(row =>
            row.some(cell => String(cell).trim() !== "")
        );

        if (!hasData) {
            setStatus("This worksheet contains no data to export.", "error");
            return;
        }

        convertBtn.disabled = true;
        setStatus("Creating your PDF...");

        try {
            const { jsPDF } = window.jspdf;

            const doc = new jsPDF({
                orientation: orientationSelect.value,
                unit: "mm",
                format: pageSizeSelect.value,
                compress: true
            });

            const title = currentFile.name.replace(/\.[^.]+$/, "");
            const fontSize = Number(fontSizeSelect.value);
            const fitToWidth = scaleModeSelect.value === "width";

            const margin = {
                top: 19,
                right: 8,
                bottom: 14,
                left: 8
            };

            const pageWidth = doc.internal.pageSize.getWidth();
            const availableWidth = pageWidth - margin.left - margin.right;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.text(
                doc.splitTextToSize(title, availableWidth),
                margin.left,
                10
            );

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(
                `Worksheet: ${sheetName}`,
                margin.left,
                15
            );

            const head = [
                Array.from({ length: columnCount }, (_, index) =>
                    rows[0][index] || `Column ${index + 1}`
                )
            ];

            const body = rows.slice(1).map(row =>
                Array.from({ length: columnCount }, (_, index =>
                    row[index] ?? ""
                ))
            );

            // AutoTable can split wide tables across pages when necessary.
            const tableOptions = {
                head,
                body,
                startY: 20,
                margin,
                theme: "grid",
                showHead: "everyPage",
                styles: {
                    font: "helvetica",
                    fontSize,
                    cellPadding: fontSize <= 7 ? 1.4 : 2,
                    overflow: "linebreak",
                    valign: "middle",
                    lineWidth: 0.1
                },
                headStyles: {
                    fontStyle: "bold",
                    textColor: [110, 25, 25],
                    fillColor: [255, 235, 235]
                },
                alternateRowStyles: {
                    fillColor: [250, 250, 250]
                },
                rowPageBreak: "auto",
                didDrawPage: function () {
                    const pageNumber = doc.internal.getNumberOfPages();
                    const pageHeight = doc.internal.pageSize.getHeight();

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.text(
                        `Page ${pageNumber}`,
                        pageWidth - margin.right,
                        pageHeight - 6,
                        { align: "right" }
                    );
                }
            };

            if (fitToWidth) {
                tableOptions.tableWidth = availableWidth;
                tableOptions.horizontalPageBreak = true;
                tableOptions.horizontalPageBreakRepeat = 0;
            } else {
                tableOptions.tableWidth = "auto";
            }

            if (typeof doc.autoTable !== "function") {
                throw new Error(
                    "The PDF table library did not load. Reload the page and try again."
                );
            }

            doc.autoTable(tableOptions);

            doc.save(getPdfFilename());

            setStatus("Your PDF has been created and downloaded.", "success");
        } catch (error) {
            console.error("PDF conversion error:", error);

            setStatus(
                error.message ||
                "Something went wrong while creating the PDF. Please try again.",
                "error"
            );
        } finally {
            convertBtn.disabled = false;
        }
    }

    fileInput.addEventListener("change", handleFileSelection);
    worksheetSelect.addEventListener("change", renderPreview);
    convertBtn.addEventListener("click", convertToPdf);
    resetBtn.addEventListener("click", resetTool);
});