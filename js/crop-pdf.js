document.addEventListener("DOMContentLoaded", () => {
    const pdfInput = document.getElementById("pdfInput");
    const chooseFileBtn = document.getElementById("chooseFileBtn");
    const changeFileBtn = document.getElementById("changeFileBtn");
    const fileSummary = document.getElementById("fileSummary");
    const fileName = document.getElementById("fileName");
    const fileSize = document.getElementById("fileSize");
    const cropWorkspace = document.getElementById("cropWorkspace");
    const canvas = document.getElementById("pdfCanvas");
    const canvasArea = document.getElementById("previewCanvasArea");
    const ctx = canvas.getContext("2d");

    const topInput = document.getElementById("topMargin");
    const rightInput = document.getElementById("rightMargin");
    const bottomInput = document.getElementById("bottomMargin");
    const leftInput = document.getElementById("leftMargin");
    const applyToSelect = document.getElementById("applyTo");

    const previousPageBtn = document.getElementById("previousPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");
    const currentPageLabel = document.getElementById("currentPageLabel");
    const pageCount = document.getElementById("pageCount");
    const resetMarginsBtn = document.getElementById("resetMarginsBtn");
    const cropDownloadBtn = document.getElementById("cropDownloadBtn");
    const statusMessage = document.getElementById("statusMessage");
    const menuToggle = document.getElementById("menuToggle");
    const mainNavigation = document.getElementById("mainNavigation");

    let selectedFile = null;
    let pdfJsDocument = null;
    let pdfJsLoadingTask = null;
    let currentPageNumber = 1;
    let isProcessing = false;
    let renderSequence = 0;

    const originalViewportInfo = new Map();

    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    if (menuToggle && mainNavigation) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNavigation.classList.toggle("open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });
    }

    chooseFileBtn.addEventListener("click", () => {
        if (!isProcessing) {
            pdfInput.click();
        }
    });

    changeFileBtn.addEventListener("click", () => {
        if (!isProcessing) {
            pdfInput.click();
        }
    });

    pdfInput.addEventListener("change", async () => {
        const file = pdfInput.files && pdfInput.files[0];

        if (!file) {
            return;
        }

        if (!file.name.toLowerCase().endsWith(".pdf") ||
            (file.type && file.type !== "application/pdf")) {
            showStatus("Please select a valid PDF file.", "error");
            pdfInput.value = "";
            return;
        }

        if (file.size === 0) {
            showStatus("This file is empty. Choose another PDF.", "error");
            pdfInput.value = "";
            return;
        }

        setProcessing(true);
        showStatus("Loading your PDF...", "info");

        try {
            await releasePreviousPdf();

            selectedFile = file;
            currentPageNumber = 1;
            originalViewportInfo.clear();

            if (!window.pdfjsLib || !window.PDFLib) {
                throw new Error(
                    "The PDF libraries could not be loaded. Check your internet connection and reload the page."
                );
            }

            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            fileSummary.hidden = false;

            const bytes = new Uint8Array(await file.arrayBuffer());

            pdfJsLoadingTask = window.pdfjsLib.getDocument({
                data: bytes
            });

            pdfJsDocument = await pdfJsLoadingTask.promise;

            if (pdfJsDocument.numPages < 1) {
                throw new Error("This PDF does not contain any pages.");
            }

            pageCount.textContent = `${pdfJsDocument.numPages} pages`;
            cropWorkspace.hidden = false;

            updateNavigationButtons();
            await renderCurrentPage();

            showStatus(
                "PDF loaded. Adjust the margins and preview the crop before downloading.",
                "success"
            );
        } catch (error) {
            console.error("PDF loading error:", error);

            await releasePreviousPdf();

            selectedFile = null;
            cropWorkspace.hidden = true;

            showStatus(
                getFriendlyError(
                    error,
                    "Could not open this PDF. It may be damaged, encrypted, or unsupported."
                ),
                "error"
            );
        } finally {
            setProcessing(false);
        }
    });

    [topInput, rightInput, bottomInput, leftInput].forEach((input) => {
        input.addEventListener("input", () => {
            validateMarginInput(input);
            renderCropOverlay();
        });

        input.addEventListener("change", () => {
            validateMarginInput(input);
            renderCropOverlay();
        });
    });

    applyToSelect.addEventListener("change", renderCropOverlay);

    previousPageBtn.addEventListener("click", async () => {
        if (!pdfJsDocument || isProcessing || currentPageNumber <= 1) {
            return;
        }

        currentPageNumber--;
        updateNavigationButtons();
        await renderCurrentPage();
    });

    nextPageBtn.addEventListener("click", async () => {
        if (!pdfJsDocument || isProcessing ||
            currentPageNumber >= pdfJsDocument.numPages) {
            return;
        }

        currentPageNumber++;
        updateNavigationButtons();
        await renderCurrentPage();
    });

    resetMarginsBtn.addEventListener("click", () => {
        topInput.value = "0";
        rightInput.value = "0";
        bottomInput.value = "0";
        leftInput.value = "0";

        renderCropOverlay();
        showStatus("All crop margins have been reset.", "info");
    });

    cropDownloadBtn.addEventListener("click", async () => {
        if (!selectedFile || !pdfJsDocument || isProcessing) {
            showStatus("Please select a PDF first.", "error");
            return;
        }

        let downloadUrl = null;

        try {
            setProcessing(true);
            showStatus("Applying crop settings...", "info");

            const margins = getMargins();

            if (applyToSelect.value === "current") {
                const page = await pdfJsDocument.getPage(currentPageNumber);
                const viewport = page.getViewport({ scale: 1 });
                validateCrop(margins, viewport.width, viewport.height);
            } else {
                for (let i = 1; i <= pdfJsDocument.numPages; i++) {
                    const page = await pdfJsDocument.getPage(i);
                    const viewport = page.getViewport({ scale: 1 });
                    validateCrop(margins, viewport.width, viewport.height);
                }
            }

            const fileBytes = await selectedFile.arrayBuffer();

            const pdfDocument = await window.PDFLib.PDFDocument.load(
                fileBytes,
                { updateMetadata: false }
            );

            const pages = pdfDocument.getPages();

            for (let index = 0; index < pages.length; index++) {
                const pageNumber = index + 1;

                if (applyToSelect.value === "current" &&
                    pageNumber !== currentPageNumber) {
                    continue;
                }

                const page = pages[index];
                const width = page.getWidth();
                const height = page.getHeight();

                const pageRotation = page.getRotation().angle;
                const rotated = Math.abs(pageRotation % 180) === 90;

                const effectiveMargins = rotated
                    ? {
                        top: margins.left,
                        right: margins.bottom,
                        bottom: margins.right,
                        left: margins.top
                    }
                    : margins;

                validateCrop(
                    effectiveMargins,
                    width,
                    height
                );

                page.setCropBox(
                    effectiveMargins.left,
                    effectiveMargins.bottom,
                    width - effectiveMargins.left - effectiveMargins.right,
                    height - effectiveMargins.top - effectiveMargins.bottom
                );
            }

            const outputBytes = await pdfDocument.save();

            const blob = new Blob([outputBytes], {
                type: "application/pdf"
            });

            downloadUrl = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = makeOutputFilename(selectedFile.name);

            document.body.appendChild(link);
            link.click();
            link.remove();

            const urlToRelease = downloadUrl;
            setTimeout(() => URL.revokeObjectURL(urlToRelease), 1000);
            downloadUrl = null;

            showStatus(
                "Your cropped PDF has been created and the download has started.",
                "success"
            );
        } catch (error) {
            console.error("PDF crop error:", error);

            showStatus(
                getFriendlyError(
                    error,
                    "Could not crop this PDF. Check the margins and try again."
                ),
                "error"
            );
        } finally {
            if (downloadUrl) {
                URL.revokeObjectURL(downloadUrl);
            }

            setProcessing(false);
        }
    });

    async function renderCurrentPage() {
        if (!pdfJsDocument) {
            return;
        }

        const thisRender = ++renderSequence;

        try {
            currentPageLabel.textContent =
                `Page ${currentPageNumber} of ${pdfJsDocument.numPages}`;

            const page = await pdfJsDocument.getPage(currentPageNumber);
            const baseViewport = page.getViewport({ scale: 1 });

            originalViewportInfo.set(currentPageNumber, {
                width: baseViewport.width,
                height: baseViewport.height
            });

            const availableWidth = Math.max(180, canvasArea.clientWidth - 44);
            const availableHeight = Math.max(220, canvasArea.clientHeight - 44);

            const scale = Math.min(
                availableWidth / baseViewport.width,
                availableHeight / baseViewport.height,
                1.4
            );

            const viewport = page.getViewport({ scale });

            if (thisRender !== renderSequence) {
                return;
            }

            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

            canvas.width = Math.floor(viewport.width * pixelRatio);
            canvas.height = Math.floor(viewport.height * pixelRatio);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            const renderContext = {
                canvasContext: ctx,
                viewport,
                transform: pixelRatio === 1
                    ? null
                    : [pixelRatio, 0, 0, pixelRatio, 0, 0]
            };

            await page.render(renderContext).promise;

            if (thisRender === renderSequence) {
                renderCropOverlay();
            }
        } catch (error) {
            if (error && error.name === "RenderingCancelledException") {
                return;
            }

            throw error;
        }
    }

    function renderCropOverlay() {
        if (!pdfJsDocument || canvas.width === 0 || canvas.height === 0) {
            return;
        }

        const margins = getMargins();
        const pageInfo = originalViewportInfo.get(currentPageNumber);

        if (!pageInfo) {
            return;
        }

        const cssWidth = parseFloat(canvas.style.width);
        const cssHeight = parseFloat(canvas.style.height);

        const scaleX = cssWidth / pageInfo.width;
        const scaleY = cssHeight / pageInfo.height;

        const left = margins.left * scaleX;
        const top = margins.top * scaleY;
        const right = margins.right * scaleX;
        const bottom = margins.bottom * scaleY;

        // Draw the crop overlay in CSS pixel coordinates.
        ctx.save();
        ctx.setTransform(
            canvas.width / cssWidth,
            0,
            0,
            canvas.height / cssHeight,
            0,
            0
        );

        ctx.fillStyle = "rgba(217, 67, 67, 0.18)";
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        const cropWidth = cssWidth - left - right;
        const cropHeight = cssHeight - top - bottom;

        if (cropWidth > 0 && cropHeight > 0) {
            ctx.clearRect(left, top, cropWidth, cropHeight);
        }

        // Restore the white page beneath the crop area.
        // The PDF is rendered again before any subsequent preview is displayed.
        ctx.strokeStyle = "#d94343";
        ctx.lineWidth = 2;
        ctx.strokeRect(
            left,
            top,
            Math.max(0, cropWidth),
            Math.max(0, cropHeight)
        );

        ctx.restore();
    }

    function getMargins() {
        return {
            top: readMargin(topInput),
            right: readMargin(rightInput),
            bottom: readMargin(bottomInput),
            left: readMargin(leftInput)
        };
    }

    function readMargin(input) {
        const value = Number(input.value);

        if (!Number.isFinite(value) || value < 0) {
            return 0;
        }

        return value;
    }

    function validateMarginInput(input) {
        const value = Number(input.value);

        if (input.value === "" || !Number.isFinite(value) || value < 0) {
            input.value = "0";
        }

        if (value > 10000) {
            input.value = "10000";
        }
    }

    function validateCrop(margins, width, height) {
        if (
            margins.left + margins.right >= width ||
            margins.top + margins.bottom >= height
        ) {
            throw new Error(
                "The crop margins are too large for one or more pages. Reduce the margins and try again."
            );
        }
    }

    function updateNavigationButtons() {
        const total = pdfJsDocument ? pdfJsDocument.numPages : 0;

        previousPageBtn.disabled =
            isProcessing || currentPageNumber <= 1;

        nextPageBtn.disabled =
            isProcessing || currentPageNumber >= total;
    }

    function setProcessing(processing) {
        isProcessing = processing;

        pdfInput.disabled = processing;
        chooseFileBtn.disabled = processing;
        changeFileBtn.disabled = processing;
        cropDownloadBtn.disabled = processing;
        resetMarginsBtn.disabled = processing;

        topInput.disabled = processing;
        rightInput.disabled = processing;
        bottomInput.disabled = processing;
        leftInput.disabled = processing;
        applyToSelect.disabled = processing;

        updateNavigationButtons();

        cropDownloadBtn.textContent = processing
            ? "Please wait..."
            : "Crop and Download PDF";
    }

    async function releasePreviousPdf() {
        renderSequence++;

        if (pdfJsDocument) {
            try {
                await pdfJsDocument.destroy();
            } catch (error) {
                console.warn("Could not release previous PDF document.", error);
            }
        }

        if (pdfJsLoadingTask) {
            try {
                await pdfJsLoadingTask.destroy();
            } catch (error) {
                console.warn("Could not release previous PDF loading task.", error);
            }
        }

        pdfJsDocument = null;
        pdfJsLoadingTask = null;
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.hidden = false;
    }

    function getFriendlyError(error, fallback) {
        const message = error && error.message ? error.message : "";

        if (/password|encrypted|decrypt/i.test(message)) {
            return "This PDF may be password-protected. Try an accessible, unencrypted PDF.";
        }

        if (/crop margins are too large/i.test(message)) {
            return message;
        }

        if (/PDF libraries could not be loaded/i.test(message)) {
            return message;
        }

        return fallback;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return `${bytes} bytes`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function makeOutputFilename(originalName) {
        return `${originalName.replace(/\.pdf$/i, "")}-cropped.pdf`;
    }

    // Keep the preview sized correctly when the viewport changes.
    let resizeTimer;

    window.addEventListener("resize", () => {
        if (!pdfJsDocument || cropWorkspace.hidden) {
            return;
        }

        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(() => {
            renderCurrentPage().catch(error => {
                console.error("Preview refresh error:", error);
            });
        }, 180);
    });
});