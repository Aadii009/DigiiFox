"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const pdfInput = document.getElementById("pdfInput");
    const dropZone = document.getElementById("dropZone");
    const fileInfo = document.getElementById("fileInfo");
    const fileName = document.getElementById("fileName");
    const fileSize = document.getElementById("fileSize");
    const removeFileButton = document.getElementById("removeFile");
    const processButton = document.getElementById("processBtn");
    const statusMessage = document.getElementById("statusMessage");
    const progressTrack = document.getElementById("progressTrack");
    const progressBar = document.getElementById("progressBar");

    const positionInput = document.getElementById("position");
    const formatInput = document.getElementById("format");
    const startNumberInput = document.getElementById("startNumber");
    const fontSizeInput = document.getElementById("fontSize");
    const fontColorInput = document.getElementById("fontColor");
    const marginInput = document.getElementById("margin");
    const pageRangeInput = document.getElementById("pageRange");
    const numberPreview = document.getElementById("numberPreview");

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    let selectedFile = null;
    let isProcessing = false;

    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
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

    function setProgress(value) {
        progressTrack.hidden = false;
        progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
    }

    function clearProgress() {
        progressTrack.hidden = true;
        progressBar.style.width = "0%";
    }

    function setBusy(busy) {
        isProcessing = busy;
        processButton.disabled = busy;
        processButton.innerHTML = busy
            ? "Processing PDF..."
            : 'Add Page Numbers <span aria-hidden="true">→</span>';
    }

    function updateFileDisplay() {
        if (!selectedFile) {
            fileInfo.hidden = true;
            fileName.textContent = "";
            fileSize.textContent = "";
            return;
        }

        fileInfo.hidden = false;
        fileName.textContent = selectedFile.name;
        fileSize.textContent = formatBytes(selectedFile.size);
    }

    function selectFile(file) {
        if (isProcessing) return;

        setStatus("");
        clearProgress();

        if (!file) return;

        const looksLikePdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!looksLikePdf) {
            setStatus("Please select a PDF file.", "error");
            return;
        }

        if (file.size === 0) {
            setStatus("This file is empty. Please select another PDF.", "error");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setStatus("The file exceeds the 50 MB size limit.", "error");
            return;
        }

        selectedFile = file;
        updateFileDisplay();
        setStatus("PDF selected. Customize your settings and continue.", "success");
    }

    function clearFile() {
        if (isProcessing) return;

        selectedFile = null;
        pdfInput.value = "";
        updateFileDisplay();
        setStatus("");
        clearProgress();
    }

    pdfInput.addEventListener("change", (event) => {
        selectFile(event.target.files[0]);
    });

    removeFileButton.addEventListener("click", clearFile);

    ["dragenter", "dragover"].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropZone.classList.add("drag-over");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropZone.classList.remove("drag-over");
        });
    });

    dropZone.addEventListener("drop", (event) => {
        const file = event.dataTransfer.files[0];
        selectFile(file);
    });

    function getStartNumber() {
        const value = Number(startNumberInput.value);

        if (!Number.isInteger(value) || value < 1 || value > 999999) {
            throw new Error("Starting number must be a whole number between 1 and 999999.");
        }

        return value;
    }

    function getMargin() {
        const value = Number(marginInput.value);

        if (!Number.isFinite(value) || value < 10 || value > 100) {
            throw new Error("Edge margin must be between 10 and 100 points.");
        }

        return value;
    }

    function parsePageRanges(rangeText, totalPages) {
        const text = rangeText.trim();

        if (!text) {
            return Array.from({ length: totalPages }, (_, index) => index);
        }

        const selected = new Set();
        const parts = text.split(",");

        for (const rawPart of parts) {
            const part = rawPart.trim();

            if (!part) {
                throw new Error("Please check the page ranges. Avoid empty entries.");
            }

            const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);

            if (!match) {
                throw new Error(
                    'Invalid page range. Use a format such as "1-3, 5, 8-10".'
                );
            }

            const first = Number(match[1]);
            const last = match[2] === undefined ? first : Number(match[2]);

            if (
                !Number.isInteger(first) ||
                !Number.isInteger(last) ||
                first < 1 ||
                last < first ||
                last > totalPages
            ) {
                throw new Error(
                    `Page range "${part}" is invalid. This PDF contains ${totalPages} page(s).`
                );
            }

            for (let page = first; page <= last; page++) {
                selected.add(page - 1);
            }
        }

        return Array.from(selected).sort((a, b) => a - b);
    }

    function getColor(name) {
        const colors = {
            black: PDFLib.rgb(0.12, 0.12, 0.12),
            gray: PDFLib.rgb(0.42, 0.42, 0.42),
            red: PDFLib.rgb(0.75, 0.16, 0.22),
            blue: PDFLib.rgb(0.12, 0.30, 0.70)
        };

        return colors[name] || colors.black;
    }

    function makeNumberLabel(number, format, totalPages) {
        if (format === "page") {
            return `Page ${number}`;
        }

        if (format === "of") {
            return `Page ${number} of ${totalPages}`;
        }

        return String(number);
    }

    function getPositionCoordinates(page, textWidth, fontSize, position, margin) {
        const { width, height } = page.getSize();
        const topPosition = position.startsWith("top-");
        const alignment = position.split("-")[1];

        let x;

        if (alignment === "left") {
            x = margin;
        } else if (alignment === "right") {
            x = width - margin - textWidth;
        } else {
            x = (width - textWidth) / 2;
        }

        // PDF coordinates start at the bottom-left corner.
        const y = topPosition
            ? height - margin - fontSize
            : margin;

        return { x, y };
    }

    function updatePreview() {
        const start = Number(startNumberInput.value);
        const format = formatInput.value;
        const exampleNumber = Number.isInteger(start) && start >= 1
            ? start
            : 1;

        if (format === "page") {
            numberPreview.textContent = `Page ${exampleNumber}`;
        } else if (format === "of") {
            numberPreview.textContent = `Page ${exampleNumber} of 10`;
        } else {
            numberPreview.textContent = String(exampleNumber);
        }

        const previewColors = {
            black: "#222222",
            gray: "#6b6b6b",
            red: "#bf2938",
            blue: "#1f4db3"
        };

        numberPreview.style.color = previewColors[fontColorInput.value] || "#222222";
        numberPreview.style.fontSize = `${Math.min(Number(fontSizeInput.value), 18)}px`;
    }

    [
        formatInput,
        startNumberInput,
        fontSizeInput,
        fontColorInput
    ].forEach((element) => {
        element.addEventListener("input", updatePreview);
        element.addEventListener("change", updatePreview);
    });

    updatePreview();

    processButton.addEventListener("click", async () => {
        if (isProcessing) return;

        if (!selectedFile) {
            setStatus("Please upload a PDF file first.", "error");
            return;
        }

        if (!window.PDFLib) {
            setStatus(
                "The PDF library could not load. Check your internet connection and refresh the page.",
                "error"
            );
            return;
        }

        let objectUrl = null;

        try {
            const startNumber = getStartNumber();
            const margin = getMargin();
            const fontSize = Number(fontSizeInput.value);
            const format = formatInput.value;
            const position = positionInput.value;
            const color = getColor(fontColorInput.value);

            if (!Number.isFinite(fontSize) || fontSize < 6 || fontSize > 30) {
                throw new Error("Please choose a valid font size.");
            }

            setBusy(true);
            clearProgress();
            setStatus("Reading your PDF...");

            const fileBytes = await selectedFile.arrayBuffer();

            const pdfDoc = await PDFLib.PDFDocument.load(fileBytes, {
                updateMetadata: false
            });

            const pages = pdfDoc.getPages();
            const totalPages = pages.length;

            if (totalPages === 0) {
                throw new Error("This PDF does not contain any pages.");
            }

            const selectedPages = parsePageRanges(pageRangeInput.value, totalPages);

            if (selectedPages.length === 0) {
                throw new Error("Select at least one page to number.");
            }

            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

            setStatus(`Adding numbers to ${selectedPages.length} page(s)...`);
            setProgress(5);

            for (let i = 0; i < selectedPages.length; i++) {
                const pageIndex = selectedPages[i];
                const page = pages[pageIndex];
                const pageNumber = startNumber + i;

                const label = makeNumberLabel(
                    pageNumber,
                    format,
                    totalPages
                );

                const textWidth = font.widthOfTextAtSize(label, fontSize);
                const { x, y } = getPositionCoordinates(
                    page,
                    textWidth,
                    fontSize,
                    position,
                    margin
                );

                const { width, height } = page.getSize();

                // Avoid drawing text outside unusually small pages.
                const safeX = Math.max(
                    0,
                    Math.min(x, Math.max(0, width - textWidth))
                );

                const safeY = Math.max(
                    0,
                    Math.min(y, Math.max(0, height - fontSize))
                );

                page.drawText(label, {
                    x: safeX,
                    y: safeY,
                    size: fontSize,
                    font,
                    color,
                    opacity: 0.95
                });

                setProgress(5 + Math.round(((i + 1) / selectedPages.length) * 75));

                // Allow the browser to update the progress indicator.
                if (i % 5 === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }

            setStatus("Preparing your numbered PDF...");
            setProgress(85);

            const outputBytes = await pdfDoc.save();
            const outputBlob = new Blob([outputBytes], {
                type: "application/pdf"
            });

            objectUrl = URL.createObjectURL(outputBlob);

            const originalName = selectedFile.name.replace(/\.pdf$/i, "");
            const downloadName = `${originalName}-numbered.pdf`;

            const downloadLink = document.createElement("a");
            downloadLink.href = objectUrl;
            downloadLink.download = downloadName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();

            setProgress(100);
            setStatus(
                `Done! Your numbered PDF (${selectedPages.length} page(s)) has been prepared for download.`,
                "success"
            );
        } catch (error) {
            console.error("Add Page Numbers error:", error);

            let message = error?.message || "Something went wrong while processing the PDF.";

            if (
                /encrypted|password/i.test(message) ||
                /encrypted|password/i.test(error?.name || "")
            ) {
                message = "This PDF may be password-protected or encrypted. This tool cannot unlock encrypted PDFs.";
            } else if (/Failed to parse|No PDF header|Invalid PDF/i.test(message)) {
                message = "The file could not be read as a valid PDF. Try opening it in a PDF reader and saving a fresh copy.";
            }

            setStatus(message, "error");
            clearProgress();
        } finally {
            setBusy(false);

            if (objectUrl) {
                // Give the browser time to begin the download.
                setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
            }
        }
    });
});