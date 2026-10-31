"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const pdfInput = document.getElementById("pdfInput");
    const dropZone = document.getElementById("dropZone");
    const fileName = document.getElementById("fileName");
    const workspace = document.getElementById("workspace");
    const documentTitle = document.getElementById("documentTitle");
    const documentInfo = document.getElementById("documentInfo");
    const removeFileBtn = document.getElementById("removeFileBtn");

    const pageMode = document.getElementById("pageMode");
    const singlePageGroup = document.getElementById("singlePageGroup");
    const pageNumber = document.getElementById("pageNumber");
    const ocrLanguage = document.getElementById("ocrLanguage");

    const pdfCanvas = document.getElementById("pdfCanvas");
    const pageCountBadge = document.getElementById("pageCountBadge");

    const startOcrBtn = document.getElementById("startOcrBtn");
    const progressSection = document.getElementById("progressSection");
    const progressStatus = document.getElementById("progressStatus");
    const progressPercent = document.getElementById("progressPercent");
    const ocrProgress = document.getElementById("ocrProgress");

    const resultsSection = document.getElementById("resultsSection");
    const resultSummary = document.getElementById("resultSummary");
    const ocrOutput = document.getElementById("ocrOutput");
    const copyTextBtn = document.getElementById("copyTextBtn");
    const downloadTextBtn = document.getElementById("downloadTextBtn");
    const errorMessage = document.getElementById("errorMessage");

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const MAX_PAGES = 300;
    const MAX_RENDER_WIDTH = 1400;

    let pdfDocument = null;
    let currentFile = null;
    let currentOperation = 0;
    let isProcessing = false;
    let activeWorker = null;
    let results = [];
    let renderedPageNumber = null;

    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    // Configure PDF.js.
    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove("hidden");
    }

    function clearError() {
        errorMessage.textContent = "";
        errorMessage.classList.add("hidden");
    }

    function setProgress(percent, message) {
        const safePercent = Math.max(0, Math.min(100, percent));

        ocrProgress.value = safePercent;
        progressPercent.textContent = `${Math.round(safePercent)}%`;
        progressStatus.textContent = message;
    }

    function setProcessing(processing) {
        isProcessing = processing;

        startOcrBtn.disabled = processing || !pdfDocument;
        removeFileBtn.disabled = processing;
        pdfInput.disabled = processing;
        pageMode.disabled = processing;
        pageNumber.disabled = processing;
        ocrLanguage.disabled = processing;

        startOcrBtn.textContent = processing
            ? "Processing..."
            : "Start OCR";
    }

    function clearResults() {
        results = [];
        ocrOutput.value = "";
        resultsSection.classList.add("hidden");
        resultSummary.textContent = "";
    }

    function showResults() {
        ocrOutput.value = results
            .map((result) => {
                return `===== Page ${result.page} =====\n\n${result.text.trim()}`;
            })
            .join("\n\n\n");

        resultSummary.textContent =
            `Recognized text from ${results.length} page(s). Review the text before using it.`;

        resultsSection.classList.remove("hidden");
    }

    async function terminateWorker() {
        if (activeWorker) {
            const worker = activeWorker;
            activeWorker = null;

            try {
                await worker.terminate();
            } catch (error) {
                console.warn("Could not terminate OCR worker:", error);
            }
        }
    }

    async function resetForm() {
        currentOperation++;
        setProcessing(false);

        await terminateWorker();

        if (pdfDocument) {
            try {
                await pdfDocument.destroy();
            } catch (error) {
                console.warn("Could not close PDF document:", error);
            }
        }

        pdfDocument = null;
        currentFile = null;
        renderedPageNumber = null;

        pdfInput.value = "";
        fileName.textContent = "";
        documentTitle.textContent = "Your document";
        documentInfo.textContent = "Ready for OCR";

        workspace.classList.add("hidden");
        progressSection.classList.add("hidden");
        singlePageGroup.classList.add("hidden");

        pageCountBadge.textContent = "0 pages";
        pageNumber.value = "1";
        pageNumber.min = "1";
        pageNumber.max = "1";

        const context = pdfCanvas.getContext("2d");
        context.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        pdfCanvas.width = 0;
        pdfCanvas.height = 0;

        clearResults();
        clearError();
        setProgress(0, "Preparing OCR...");
    }

    async function renderPage(pageNum, operationId) {
        if (!pdfDocument) {
            throw new Error("Please upload a PDF first.");
        }

        const page = await pdfDocument.getPage(pageNum);

        if (operationId !== currentOperation) {
            return;
        }

        const originalViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(
            1.6,
            MAX_RENDER_WIDTH / originalViewport.width
        );

        const viewport = page.getViewport({ scale });

        pdfCanvas.width = Math.ceil(viewport.width);
        pdfCanvas.height = Math.ceil(viewport.height);

        const context = pdfCanvas.getContext("2d", {
            alpha: false
        });

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        if (operationId !== currentOperation) {
            return;
        }

        renderedPageNumber = pageNum;
    }

    async function loadPDF(file) {
        if (isProcessing) {
            return;
        }

        clearError();

        if (!file) {
            return;
        }

        if (file.type !== "application/pdf" &&
            !file.name.toLowerCase().endsWith(".pdf")) {
            showError("Please select a valid PDF file.");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showError("This PDF exceeds the 50 MB file-size limit.");
            return;
        }

        if (file.size === 0) {
            showError("The selected file is empty.");
            return;
        }

        const operationId = currentOperation + 1;
        currentOperation = operationId;

        await terminateWorker();

        if (pdfDocument) {
            try {
                await pdfDocument.destroy();
            } catch (error) {
                console.warn(error);
            }
        }

        pdfDocument = null;
        currentFile = null;
        renderedPageNumber = null;
        clearResults();
        progressSection.classList.add("hidden");

        fileName.textContent = "";
        workspace.classList.add("hidden");

        if (!window.pdfjsLib) {
            showError(
                "PDF.js could not load. Check your internet connection and refresh the page."
            );
            return;
        }

        try {
            documentTitle.textContent = file.name;
            documentInfo.textContent = "Loading PDF...";
            fileName.textContent = `Selected: ${file.name}`;

            const arrayBuffer = await file.arrayBuffer();

            if (operationId !== currentOperation) {
                return;
            }

            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(arrayBuffer)
            });

            const loadedPDF = await loadingTask.promise;

            if (operationId !== currentOperation) {
                await loadedPDF.destroy();
                return;
            }

            if (loadedPDF.numPages > MAX_PAGES) {
                await loadedPDF.destroy();

                showError(
                    `This PDF contains ${loadedPDF.numPages} pages. The current limit is ${MAX_PAGES} pages.`
                );

                documentInfo.textContent = "PDF not loaded";
                return;
            }

            pdfDocument = loadedPDF;
            currentFile = file;

            pageNumber.min = "1";
            pageNumber.max = String(pdfDocument.numPages);
            pageNumber.value = "1";

            pageCountBadge.textContent =
                `${pdfDocument.numPages} page${pdfDocument.numPages === 1 ? "" : "s"}`;

            documentInfo.textContent =
                `${pdfDocument.numPages} page(s) · ${formatFileSize(file.size)}`;

            workspace.classList.remove("hidden");
            await renderPage(1, operationId);

            if (operationId !== currentOperation) {
                return;
            }

            setProcessing(false);
        } catch (error) {
            console.error("PDF loading error:", error);

            if (operationId !== currentOperation) {
                return;
            }

            pdfDocument = null;
            currentFile = null;

            documentInfo.textContent = "Could not load PDF";

            showError(
                "Unable to open this PDF. It may be damaged, password-protected, or unsupported. Try another PDF."
            );
        }
    }

    function formatFileSize(bytes) {
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async function startOCR() {
        if (isProcessing || !pdfDocument || !currentFile) {
            return;
        }

        clearError();
        clearResults();

        if (!window.Tesseract) {
            showError(
                "The OCR library could not load. Check your internet connection and refresh the page."
            );
            return;
        }

        let pagesToProcess = [];

        if (pageMode.value === "single") {
            const selectedPage = Number.parseInt(pageNumber.value, 10);

            if (
                !Number.isInteger(selectedPage) ||
                selectedPage < 1 ||
                selectedPage > pdfDocument.numPages
            ) {
                showError(
                    `Enter a page number between 1 and ${pdfDocument.numPages}.`
                );
                return;
            }

            pagesToProcess = [selectedPage];
        } else {
            pagesToProcess = Array.from(
                { length: pdfDocument.numPages },
                (_, index) => index + 1
            );
        }

        const operationId = currentOperation;
        const totalPages = pagesToProcess.length;

        setProcessing(true);
        progressSection.classList.remove("hidden");
        resultsSection.classList.add("hidden");
        setProgress(0, "Starting OCR...");

        const language = ocrLanguage.value;

        try {
            progressStatus.textContent =
                `Loading OCR language: ${language}...`;

            const worker = await Tesseract.createWorker(
                language,
                1,
                {
                    logger: (message) => {
                        if (operationId !== currentOperation) {
                            return;
                        }

                        if (message.status) {
                            progressStatus.textContent =
                                `OCR engine: ${message.status}`;

                            if (typeof message.progress === "number") {
                                const percent = message.progress * 100;

                                progressPercent.textContent =
                                    `${Math.round(percent)}%`;
                            }
                        }
                    }
                }
            );

            if (operationId !== currentOperation) {
                await worker.terminate();
                return;
            }

            activeWorker = worker;

            for (let index = 0; index < pagesToProcess.length; index++) {
                if (operationId !== currentOperation) {
                    return;
                }

                const pageNum = pagesToProcess[index];

                setProgress(
                    (index / totalPages) * 100,
                    `Rendering page ${pageNum} of ${pdfDocument.numPages}...`
                );

                await renderPage(pageNum, operationId);

                if (operationId !== currentOperation) {
                    return;
                }

                progressStatus.textContent =
                    `Recognizing text on page ${pageNum} (${index + 1} of ${totalPages})...`;

                const recognition = await worker.recognize(pdfCanvas);

                if (operationId !== currentOperation) {
                    return;
                }

                const recognizedText = recognition.data.text || "";

                results.push({
                    page: pageNum,
                    text: recognizedText
                });

                const overallProgress = ((index + 1) / totalPages) * 100;

                setProgress(
                    overallProgress,
                    `Completed page ${pageNum} (${index + 1} of ${totalPages})`
                );

                showResults();
            }

            if (operationId !== currentOperation) {
                return;
            }

            setProgress(100, "OCR completed successfully.");
            showResults();

            const hasText = results.some(
                (result) => result.text.trim().length > 0
            );

            if (!hasText) {
                showError(
                    "OCR finished, but no text was recognized. Try a clearer scan or another OCR language."
                );
            }
        } catch (error) {
            console.error("OCR processing error:", error);

            if (operationId === currentOperation) {
                showError(
                    "OCR could not finish. Check your internet connection, try a supported language, or use a smaller PDF."
                );
            }
        } finally {
            if (operationId === currentOperation) {
                await terminateWorker();
                setProcessing(false);
            }
        }
    }

    async function copyText() {
        const text = ocrOutput.value;

        if (!text.trim()) {
            showError("There is no recognized text to copy.");
            return;
        }

        clearError();

        try {
            await navigator.clipboard.writeText(text);
            copyTextBtn.textContent = "Copied!";

            setTimeout(() => {
                copyTextBtn.textContent = "Copy Text";
            }, 1800);
        } catch (error) {
            // Fallback for browsers where Clipboard API is unavailable.
            ocrOutput.focus();
            ocrOutput.select();

            try {
                const copied = document.execCommand("copy");

                if (!copied) {
                    throw new Error("Clipboard copy failed.");
                }

                copyTextBtn.textContent = "Copied!";

                setTimeout(() => {
                    copyTextBtn.textContent = "Copy Text";
                }, 1800);
            } catch (copyError) {
                showError(
                    "Automatic copying is unavailable. Select the text and copy it manually."
                );
            }
        }
    }

    function downloadText() {
        const text = ocrOutput.value;

        if (!text.trim()) {
            showError("There is no recognized text to download.");
            return;
        }

        clearError();

        const blob = new Blob(
            ["\uFEFF", text],
            { type: "text/plain;charset=utf-8" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const baseName = currentFile
            ? currentFile.name.replace(/\.pdf$/i, "")
            : "ocr-document";

        link.href = url;
        link.download = `${baseName}-ocr.txt`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    pdfInput.addEventListener("change", (event) => {
        const file = event.target.files[0];

        if (file) {
            loadPDF(file);
        }
    });

    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();

        if (!isProcessing) {
            dropZone.classList.add("drag-over");
        }
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropZone.classList.remove("drag-over");

        if (isProcessing) {
            return;
        }

        const file = event.dataTransfer.files[0];

        if (file) {
            loadPDF(file);
        }
    });

    pageMode.addEventListener("change", () => {
        singlePageGroup.classList.toggle(
            "hidden",
            pageMode.value !== "single"
        );
    });

    pageNumber.addEventListener("change", async () => {
        if (!pdfDocument || isProcessing) {
            return;
        }

        clearError();

        const selectedPage = Number.parseInt(pageNumber.value, 10);

        if (
            !Number.isInteger(selectedPage) ||
            selectedPage < 1 ||
            selectedPage > pdfDocument.numPages
        ) {
            showError(
                `Enter a page number between 1 and ${pdfDocument.numPages}.`
            );
            return;
        }

        try {
            await renderPage(selectedPage, currentOperation);
        } catch (error) {
            console.error(error);
            showError("Could not render the selected PDF page.");
        }
    });

    startOcrBtn.addEventListener("click", startOCR);
    copyTextBtn.addEventListener("click", copyText);
    downloadTextBtn.addEventListener("click", downloadText);

    removeFileBtn.addEventListener("click", async () => {
        if (isProcessing) {
            return;
        }

        await resetForm();
    });
});