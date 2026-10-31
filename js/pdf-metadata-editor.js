document.addEventListener("DOMContentLoaded", () => {
    const pdfInput = document.getElementById("pdfInput");
    const chooseFileBtn = document.getElementById("chooseFileBtn");
    const changeFileBtn = document.getElementById("changeFileBtn");
    const uploadArea = document.getElementById("uploadArea");
    const fileSummary = document.getElementById("fileSummary");
    const fileName = document.getElementById("fileName");
    const fileSize = document.getElementById("fileSize");
    const metadataForm = document.getElementById("metadataForm");
    const resetBtn = document.getElementById("resetBtn");
    const saveBtn = document.getElementById("saveBtn");
    const statusMessage = document.getElementById("statusMessage");
    const menuToggle = document.getElementById("menuToggle");
    const mainNavigation = document.getElementById("mainNavigation");

    const fields = {
        title: document.getElementById("title"),
        author: document.getElementById("author"),
        subject: document.getElementById("subject"),
        keywords: document.getElementById("keywords"),
        creator: document.getElementById("creator"),
        producer: document.getElementById("producer")
    };

    let selectedFile = null;
    let originalMetadata = null;
    let isProcessing = false;

    // Shared navigation behaviour.
    if (menuToggle && mainNavigation) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNavigation.classList.toggle("open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });
    }

    // Keep the copyright year current.
    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

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

        if (!isPdfFile(file)) {
            showStatus("Please select a valid PDF file.", "error");
            pdfInput.value = "";
            return;
        }

        if (file.size === 0) {
            showStatus("This file is empty. Please select another PDF.", "error");
            pdfInput.value = "";
            return;
        }

        selectedFile = file;
        originalMetadata = null;

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);

        fileSummary.hidden = false;
        metadataForm.hidden = true;

        setProcessing(true);
        showStatus("Reading PDF information...", "info");

        try {
            if (!window.PDFLib || !window.PDFLib.PDFDocument) {
                throw new Error(
                    "The PDF library could not be loaded. Check your internet connection and reload the page."
                );
            }

            const fileBytes = await file.arrayBuffer();

            const pdfDocument = await window.PDFLib.PDFDocument.load(
                fileBytes,
                {
                    updateMetadata: false
                }
            );

            const metadata = {
                title: pdfDocument.getTitle() || "",
                author: pdfDocument.getAuthor() || "",
                subject: pdfDocument.getSubject() || "",
                keywords: (pdfDocument.getKeywords() || []).join(", "),
                creator: pdfDocument.getCreator() || "",
                producer: pdfDocument.getProducer() || ""
            };

            originalMetadata = { ...metadata };

            fillForm(metadata);
            metadataForm.hidden = false;

            showStatus(
                "PDF loaded successfully. You can now edit its document properties.",
                "success"
            );
        } catch (error) {
            console.error("PDF metadata loading error:", error);

            metadataForm.hidden = true;

            showStatus(
                getFriendlyError(error, "Could not read this PDF. It may be encrypted, damaged, or unsupported."),
                "error"
            );
        } finally {
            setProcessing(false);
        }
    });

    resetBtn.addEventListener("click", () => {
        if (!originalMetadata || isProcessing) {
            return;
        }

        fillForm(originalMetadata);

        showStatus(
            "The original metadata values have been restored in the form. Save the PDF to download them.",
            "info"
        );
    });

    metadataForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!selectedFile || !originalMetadata || isProcessing) {
            showStatus("Please select a PDF before saving.", "error");
            return;
        }

        setProcessing(true);
        showStatus("Updating PDF metadata...", "info");

        let downloadUrl = null;

        try {
            const fileBytes = await selectedFile.arrayBuffer();

            const pdfDocument = await window.PDFLib.PDFDocument.load(
                fileBytes,
                {
                    updateMetadata: false
                }
            );

            const metadata = readForm();

            // Update standard PDF document information.
            pdfDocument.setTitle(metadata.title);
            pdfDocument.setAuthor(metadata.author);
            pdfDocument.setSubject(metadata.subject);

            const keywords = metadata.keywords
                .split(",")
                .map(keyword => keyword.trim())
                .filter(Boolean);

            pdfDocument.setKeywords(keywords);
            pdfDocument.setCreator(metadata.creator);
            pdfDocument.setProducer(metadata.producer);

            const updatedPdfBytes = await pdfDocument.save();

            const pdfBlob = new Blob([updatedPdfBytes], {
                type: "application/pdf"
            });

            downloadUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = makeOutputFilename(selectedFile.name);

            document.body.appendChild(link);
            link.click();
            link.remove();

            // Release the temporary download URL.
            const urlToRelease = downloadUrl;
            setTimeout(() => URL.revokeObjectURL(urlToRelease), 1000);
            downloadUrl = null;

            showStatus(
                "Your PDF metadata has been updated. The edited PDF download has started.",
                "success"
            );
        } catch (error) {
            console.error("PDF metadata save error:", error);

            showStatus(
                getFriendlyError(error, "Could not save the PDF. Please try another file."),
                "error"
            );
        } finally {
            if (downloadUrl) {
                URL.revokeObjectURL(downloadUrl);
            }

            setProcessing(false);
        }
    });

    function isPdfFile(file) {
        const nameLooksLikePdf = file.name.toLowerCase().endsWith(".pdf");
        const typeLooksLikePdf =
            file.type === "application/pdf" || file.type === "";

        return nameLooksLikePdf && typeLooksLikePdf;
    }

    function fillForm(metadata) {
        Object.keys(fields).forEach((key) => {
            fields[key].value = metadata[key] || "";
        });
    }

    function readForm() {
        const result = {};

        Object.keys(fields).forEach((key) => {
            result[key] = fields[key].value.trim();
        });

        return result;
    }

    function setProcessing(processing) {
        isProcessing = processing;

        pdfInput.disabled = processing;
        chooseFileBtn.disabled = processing;
        changeFileBtn.disabled = processing;
        resetBtn.disabled = processing;
        saveBtn.disabled = processing;

        saveBtn.textContent = processing
            ? "Please wait..."
            : "Save and Download PDF";
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.hidden = false;
    }

    function getFriendlyError(error, fallback) {
        const message = error && error.message ? error.message : "";

        if (/encrypted|password|decrypt/i.test(message)) {
            return "This PDF may be password-protected. This tool supports accessible, unencrypted PDFs.";
        }

        if (/library could not be loaded/i.test(message)) {
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
        const baseName = originalName.replace(/\.pdf$/i, "");
        return `${baseName}-metadata-edited.pdf`;
    }
});