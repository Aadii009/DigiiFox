"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const pdfInput = document.getElementById("pdfInput");
    const dropZone = document.getElementById("dropZone");
    const fileInfo = document.getElementById("fileInfo");
    const fileName = document.getElementById("fileName");
    const fileSize = document.getElementById("fileSize");
    const removeFileButton = document.getElementById("removeFile");

    const organizerToolbar = document.getElementById("organizerToolbar");
    const pageCount = document.getElementById("pageCount");
    const pageGrid = document.getElementById("pageGrid");
    const emptyState = document.getElementById("emptyState");
    const resetOrderButton = document.getElementById("resetOrder");
    const downloadButton = document.getElementById("downloadBtn");

    const statusMessage = document.getElementById("statusMessage");
    const progressTrack = document.getElementById("progressTrack");
    const progressBar = document.getElementById("progressBar");

    const MAX_FILE_SIZE = 50 * 1024 * 1024;

    let selectedFile = null;
    let originalBytes = null;
    let originalPages = [];
    let workingPages = [];
    let isBusy = false;
    let operationId = 0;

    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
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
        progressBar.style.width =
            `${Math.max(0, Math.min(100, value))}%`;
    }

    function clearProgress() {
        progressTrack.hidden = true;
        progressBar.style.width = "0%";
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function setBusy(busy) {
        isBusy = busy;

        downloadButton.disabled = busy || workingPages.length === 0;
        resetOrderButton.disabled = busy;
        removeFileButton.disabled = busy;
        pdfInput.disabled = busy;

        pageGrid.querySelectorAll("button").forEach((button) => {
            button.disabled = busy || button.disabled;
        });

        dropZone.setAttribute("aria-disabled", String(busy));
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

    function updatePageSummary() {
        const count = workingPages.length;

        pageCount.textContent =
            `${count} page${count === 1 ? "" : "s"} remaining`;

        downloadButton.disabled = isBusy || count === 0;
        resetOrderButton.disabled = isBusy || originalPages.length === 0;

        emptyState.hidden = count !== 0;
        pageGrid.hidden = count === 0;
        organizerToolbar.hidden = originalPages.length === 0;
    }

    function createButton(label, className, title, onClick) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = label;
        button.className = className;
        button.title = title;
        button.setAttribute("aria-label", title);
        button.addEventListener("click", onClick);

        return button;
    }

    function renderPageGrid() {
        pageGrid.replaceChildren();

        workingPages.forEach((page, index) => {
            const card = document.createElement("article");
            card.className = "page-card";

            const preview = document.createElement("div");
            preview.className = "page-preview";

            if (page.canvas) {
                preview.appendChild(page.canvas);
            } else {
                const errorText = document.createElement("span");
                errorText.className = "preview-error";
                errorText.textContent = "Preview unavailable";
                preview.appendChild(errorText);
            }

            const footer = document.createElement("div");
            footer.className = "page-card-footer";

            const title = document.createElement("div");
            title.className = "page-card-title";

            const pageLabel = document.createElement("strong");
            pageLabel.textContent = `Page ${page.pageNumber}`;

            const positionLabel = document.createElement("span");
            positionLabel.textContent = `Order ${index + 1}`;

            title.append(pageLabel, positionLabel);

            const controls = document.createElement("div");
            controls.className = "page-controls";

            const upButton = createButton(
                "↑ Up",
                "",
                `Move original page ${page.pageNumber} up`,
                () => movePage(index, -1)
            );

            const downButton = createButton(
                "↓ Down",
                "",
                `Move original page ${page.pageNumber} down`,
                () => movePage(index, 1)
            );

            upButton.disabled = index === 0 || isBusy;
            downButton.disabled =
                index === workingPages.length - 1 || isBusy;

            const removeButton = createButton(
                "Remove",
                "remove-page",
                `Remove original page ${page.pageNumber}`,
                () => removePage(index)
            );

            removeButton.disabled =
                workingPages.length <= 1 || isBusy;

            controls.append(upButton, downButton, removeButton);
            footer.append(title, controls);
            card.append(preview, footer);
            pageGrid.appendChild(card);
        });

        updatePageSummary();
    }

    function movePage(index, direction) {
        if (isBusy) return;

        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= workingPages.length) {
            return;
        }

        const [page] = workingPages.splice(index, 1);
        workingPages.splice(newIndex, 0, page);

        renderPageGrid();
        setStatus("Page order updated. Download the PDF to save your changes.");
    }

    function removePage(index) {
        if (isBusy || workingPages.length <= 1) {
            setStatus("At least one page must remain in your PDF.", "error");
            return;
        }

        const [removedPage] = workingPages.splice(index, 1);

        renderPageGrid();
        setStatus(
            `Page ${removedPage.pageNumber} removed from the output. Your original PDF remains unchanged.`
        );
    }

    function resetChanges() {
        if (isBusy || originalPages.length === 0) return;

        workingPages = originalPages.slice();
        renderPageGrid();

        setStatus("All original pages have been restored in their original order.");
    }

    async function renderPdfPreviews(file, currentOperation) {
        if (!window.pdfjsLib || !window.PDFLib) {
            throw new Error(
                "The PDF libraries could not load. Check your internet connection and refresh the page."
            );
        }

        setStatus("Reading your PDF...");
        setProgress(3);

        const bytes = await file.arrayBuffer();

        if (currentOperation !== operationId) return;

        // Keep a separate copy for PDF-Lib because PDF.js may transfer its buffer.
        originalBytes = bytes.slice(0);

        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(bytes.slice(0))
        });

        const pdf = await loadingTask.promise;

        if (currentOperation !== operationId) {
            await pdf.destroy();
            return;
        }

        if (pdf.numPages < 1) {
            await pdf.destroy();
            throw new Error("This PDF does not contain any pages.");
        }

        originalPages = [];
        workingPages = [];

        setStatus(`Preparing previews for ${pdf.numPages} page(s)...`);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            if (currentOperation !== operationId) {
                await pdf.destroy();
                return;
            }

            const page = await pdf.getPage(pageNumber);
            const baseViewport = page.getViewport({ scale: 1 });

            const maxWidth = 230;
            const maxHeight = 300;

            const scale = Math.min(
                maxWidth / baseViewport.width,
                maxHeight / baseViewport.height,
                0.8
            );

            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d", {
                alpha: false
            });

            if (!context) {
                throw new Error("Your browser could not create a page preview.");
            }

            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));

            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);

            try {
                await page.render({
                    canvasContext: context,
                    viewport,
                    background: "#ffffff"
                }).promise;

                const pageItem = {
                    pageNumber,
                    canvas
                };

                originalPages.push(pageItem);
                workingPages.push(pageItem);
            } finally {
                page.cleanup();
            }

            setProgress(
                5 + Math.round((pageNumber / pdf.numPages) * 75)
            );

            setStatus(
                `Loading page previews: ${pageNumber} of ${pdf.numPages}...`
            );

            // Let the browser update the interface between pages.
            if (pageNumber % 3 === 0) {
                renderPageGrid();
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }

        await pdf.destroy();

        if (currentOperation !== operationId) return;

        renderPageGrid();
        setProgress(100);

        setStatus(
            `Ready! ${originalPages.length} page(s) loaded. Reorder or remove pages as needed.`,
            "success"
        );

        setTimeout(() => {
            if (currentOperation === operationId) {
                clearProgress();
            }
        }, 700);
    }

    function clearCurrentDocument() {
        operationId++;

        selectedFile = null;
        originalBytes = null;
        originalPages = [];
        workingPages = [];

        pdfInput.value = "";
        updateFileDisplay();

        pageGrid.replaceChildren();
        pageGrid.hidden = true;

        organizerToolbar.hidden = true;
        emptyState.hidden = false;
        emptyState.textContent =
            "Your PDF page previews will appear here after you upload a file.";

        downloadButton.disabled = true;
        resetOrderButton.disabled = true;

        setStatus("");
        clearProgress();
    }

    async function selectFile(file) {
        if (isBusy || !file) return;

        const looksLikePdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!looksLikePdf) {
            setStatus("Please select a PDF file.", "error");
            return;
        }

        if (file.size === 0) {
            setStatus("This file is empty. Please choose another PDF.", "error");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setStatus("The file exceeds the 50 MB size limit.", "error");
            return;
        }

        clearCurrentDocument();

        selectedFile = file;
        updateFileDisplay();

        const currentOperation = operationId;

        setBusy(true);
        pageGrid.hidden = false;
        emptyState.hidden = true;

        try {
            await renderPdfPreviews(file, currentOperation);
        } catch (error) {
            console.error("PDF preview error:", error);

            clearCurrentDocument();

            setStatus(
                error?.message ||
                "Could not read this PDF. Try another file.",
                "error"
            );
        } finally {
            setBusy(false);
            updatePageSummary();
            renderPageGrid();
        }
    }

    async function downloadOrganizedPdf() {
        if (isBusy) return;

        if (!selectedFile || !originalBytes) {
            setStatus("Please upload a PDF file first.", "error");
            return;
        }

        if (workingPages.length === 0) {
            setStatus("Your PDF must contain at least one page.", "error");
            return;
        }

        if (!window.PDFLib) {
            setStatus(
                "The PDF library could not load. Check your internet connection.",
                "error"
            );
            return;
        }

        let objectUrl = null;

        setBusy(true);
        clearProgress();

        try {
            setStatus("Preparing your organized PDF...");
            setProgress(10);

            const sourcePdf = await PDFLib.PDFDocument.load(
                originalBytes.slice(0),
                { updateMetadata: false }
            );

            const outputPdf = await PDFLib.PDFDocument.create();

            const sourceIndices = workingPages.map(
                (page) => page.pageNumber - 1
            );

            const copiedPages = await outputPdf.copyPages(
                sourcePdf,
                sourceIndices
            );

            for (let i = 0; i < copiedPages.length; i++) {
                outputPdf.addPage(copiedPages[i]);

                setProgress(
                    15 + Math.round(((i + 1) / copiedPages.length) * 70)
                );

                if (i % 5 === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }

            setStatus("Creating the download...");
            setProgress(90);

            const outputBytes = await outputPdf.save();

            const blob = new Blob([outputBytes], {
                type: "application/pdf"
            });

            objectUrl = URL.createObjectURL(blob);

            const originalName = selectedFile.name.replace(/\.pdf$/i, "");
            const downloadName = `${originalName}-organized.pdf`;

            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = downloadName;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setProgress(100);

            setStatus(
                `Success! Your organized PDF with ${workingPages.length} page(s) is ready for download.`,
                "success"
            );
        } catch (error) {
            console.error("PDF organizer error:", error);

            let message =
                error?.message ||
                "Something went wrong while organizing the PDF.";

            if (/encrypted|password/i.test(message)) {
                message =
                    "This PDF may be encrypted or password-protected. This tool cannot unlock encrypted PDFs.";
            }

            setStatus(message, "error");
            clearProgress();
        } finally {
            setBusy(false);
            updatePageSummary();
            renderPageGrid();

            if (objectUrl) {
                setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
            }
        }
    }

    pdfInput.addEventListener("change", (event) => {
        selectFile(event.target.files[0]);
    });

    removeFileButton.addEventListener("click", () => {
        if (isBusy) return;

        clearCurrentDocument();
        setBusy(false);
    });

    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", (event) => {
        event.preventDefault();
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropZone.classList.remove("drag-over");

        if (isBusy) return;

        const file = event.dataTransfer.files[0];
        selectFile(file);
    });

    resetOrderButton.addEventListener("click", resetChanges);
    downloadButton.addEventListener("click", downloadOrganizedPdf);

    updatePageSummary();
});