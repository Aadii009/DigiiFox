"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const documentTitle = document.getElementById("documentTitle");
    const documentEditor = document.getElementById("documentEditor");
    const paperSize = document.getElementById("paperSize");
    const orientation = document.getElementById("orientation");

    const previewTitle = document.getElementById("previewTitle");
    const previewContent = document.getElementById("previewContent");

    const wordCount = document.getElementById("wordCount");
    const characterCount = document.getElementById("characterCount");

    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    const clearDocumentBtn = document.getElementById("clearDocumentBtn");
    const clearFormattingBtn = document.getElementById("clearFormattingBtn");
    const statusMessage = document.getElementById("statusMessage");

    const editorToolbar = document.querySelector(".formatting-toolbar");

    let isGenerating = false;
    let statusTimer = null;

    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    function getPlainText() {
        return documentEditor.innerText ||
            documentEditor.textContent ||
            "";
    }

    function updatePreview() {
        const title = documentTitle.value.trim() || "Untitled Document";

        previewTitle.textContent = title;
        previewContent.innerHTML = documentEditor.innerHTML;

        updateCounts();
    }

    function updateCounts() {
        const text = getPlainText().trim();

        const words = text
            ? text.split(/\s+/).filter(Boolean).length
            : 0;

        const characters = getPlainText().length;

        wordCount.textContent =
            `${words} word${words === 1 ? "" : "s"}`;

        characterCount.textContent =
            `${characters} character${characters === 1 ? "" : "s"}`;
    }

    function showStatus(message, type = "success") {
        clearTimeout(statusTimer);

        statusMessage.textContent = message;
        statusMessage.classList.remove("hidden", "error");

        if (type === "error") {
            statusMessage.classList.add("error");
        }

        statusTimer = setTimeout(() => {
            statusMessage.classList.add("hidden");
        }, 5000);
    }

    function executeCommand(command) {
        documentEditor.focus();

        try {
            document.execCommand(command, false, null);
            updatePreview();
        } catch (error) {
            console.error("Formatting command failed:", error);
            showStatus(
                "This formatting action is not supported by your browser.",
                "error"
            );
        }
    }

    function applyBlockFormat(tagName) {
        documentEditor.focus();

        try {
            document.execCommand("formatBlock", false, tagName);
            updatePreview();
        } catch (error) {
            console.error("Block formatting failed:", error);
            showStatus("Unable to apply this text style.", "error");
        }
    }

    function clearFormatting() {
        documentEditor.focus();

        try {
            document.execCommand("removeFormat", false, null);
            document.execCommand("formatBlock", false, "p");
            updatePreview();
            showStatus("Text formatting cleared.");
        } catch (error) {
            console.error("Could not clear formatting:", error);
            showStatus("Unable to clear formatting.", "error");
        }
    }

    function clearDocument() {
        const confirmed = window.confirm(
            "Clear the entire document? This action cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        documentEditor.innerHTML = "<p></p>";
        updatePreview();
        documentEditor.focus();

        showStatus("Document cleared.");
    }

    function sanitizeFilename(value) {
        const cleaned = value
            .normalize("NFKC")
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^\.+|\.+$/g, "")
            .slice(0, 100);

        return cleaned || "digii-fox-document";
    }

    function getPaperDimensions() {
        const sizes = {
            a4: { width: 210, height: 297 },
            letter: { width: 215.9, height: 279.4 },
            legal: { width: 215.9, height: 355.6 }
        };

        const size = sizes[paperSize.value] || sizes.a4;

        if (orientation.value === "landscape") {
            return {
                width: size.height,
                height: size.width
            };
        }

        return size;
    }

    function createPdfSource() {
        const source = document.createElement("div");
        source.className = "pdf-export-source";

        const dimensions = getPaperDimensions();

        source.style.width = `${dimensions.width}mm`;
        source.style.padding = "0";
        source.style.margin = "0";
        source.style.boxSizing = "border-box";
        source.style.background = "#ffffff";
        source.style.color = "#252525";
        source.style.fontFamily = "Arial, Helvetica, sans-serif";
        source.style.fontSize = "12pt";
        source.style.lineHeight = "1.6";
        source.style.overflowWrap = "anywhere";
        source.style.wordBreak = "normal";

        const heading = document.createElement("h1");
        heading.textContent =
            documentTitle.value.trim() || "Untitled Document";

        heading.style.margin = "0 0 8mm";
        heading.style.paddingBottom = "4mm";
        heading.style.borderBottom = "1px solid #dddddd";
        heading.style.fontSize = "22pt";
        heading.style.lineHeight = "1.25";
        heading.style.overflowWrap = "anywhere";

        const content = document.createElement("div");
        content.innerHTML = documentEditor.innerHTML;

        content.querySelectorAll("script, iframe, object, embed, form").forEach(
            (element) => element.remove()
        );

        content.querySelectorAll("*").forEach((element) => {
            element.removeAttribute("contenteditable");
            element.removeAttribute("spellcheck");
            element.removeAttribute("onclick");
            element.removeAttribute("onerror");
            element.removeAttribute("onload");

            // Prevent pasted external images from being fetched during export.
            if (element.tagName === "IMG") {
                const src = element.getAttribute("src") || "";

                if (!src.startsWith("data:image/")) {
                    element.remove();
                    return;
                }

                element.style.maxWidth = "100%";
                element.style.height = "auto";
            }

            if (element.tagName === "A") {
                element.removeAttribute("onclick");
                element.setAttribute("rel", "noopener noreferrer");
            }
        });

        content.querySelectorAll("p").forEach((element) => {
            element.style.margin = "0 0 4mm";
        });

        content.querySelectorAll("h2").forEach((element) => {
            element.style.fontSize = "17pt";
            element.style.margin = "7mm 0 3mm";
            element.style.lineHeight = "1.3";
        });

        content.querySelectorAll("h3").forEach((element) => {
            element.style.fontSize = "14pt";
            element.style.margin = "5mm 0 2mm";
            element.style.lineHeight = "1.3";
        });

        content.querySelectorAll("ul, ol").forEach((element) => {
            element.style.paddingLeft = "8mm";
            element.style.margin = "2mm 0 5mm";
        });

        content.querySelectorAll("table").forEach((element) => {
            element.style.width = "100%";
            element.style.borderCollapse = "collapse";
        });

        content.querySelectorAll("td, th").forEach((element) => {
            element.style.padding = "2mm";
            element.style.border = "1px solid #cccccc";
        });

        source.appendChild(heading);
        source.appendChild(content);

        return source;
    }

    async function downloadPDF() {
        if (isGenerating) {
            return;
        }

        if (!getPlainText().trim()) {
            showStatus(
                "Please enter some text before creating your PDF.",
                "error"
            );
            documentEditor.focus();
            return;
        }

        if (!window.html2pdf) {
            showStatus(
                "The PDF library could not load. Check your internet connection and refresh the page.",
                "error"
            );
            return;
        }

        isGenerating = true;
        downloadPdfBtn.disabled = true;
        clearDocumentBtn.disabled = true;
        downloadPdfBtn.textContent = "Creating PDF...";

        let source = null;

        try {
            updatePreview();

            source = createPdfSource();

            // Keep the export source available for html2canvas while
            // avoiding any visible change to the page layout.
            source.style.position = "fixed";
            source.style.left = "-10000px";
            source.style.top = "0";
            source.style.zIndex = "-1";
            source.style.background = "#ffffff";

            document.body.appendChild(source);

            const options = {
                margin: [12, 12, 12, 12],
                filename: `${sanitizeFilename(
                    documentTitle.value.trim()
                )}.pdf`,
                image: {
                    type: "jpeg",
                    quality: 0.98
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
                    format: paperSize.value,
                    orientation: orientation.value,
                    compress: true
                },
                pagebreak: {
                    mode: ["css", "legacy"],
                    avoid: ["img", "table", "blockquote"]
                }
            };

            await window.html2pdf()
                .set(options)
                .from(source)
                .save();

            showStatus("Your PDF has been created and downloaded.");
        } catch (error) {
            console.error("PDF generation failed:", error);

            showStatus(
                "PDF generation failed. Try shorter content or refresh the page and try again.",
                "error"
            );
        } finally {
            if (source && source.parentNode) {
                source.parentNode.removeChild(source);
            }

            isGenerating = false;
            downloadPdfBtn.disabled = false;
            clearDocumentBtn.disabled = false;
            downloadPdfBtn.textContent = "Download PDF";
        }
    }

    // Keep the browser selection active when a toolbar button is clicked.
    editorToolbar.addEventListener("mousedown", (event) => {
        if (event.target.closest("button")) {
            event.preventDefault();
        }
    });

    editorToolbar.addEventListener("click", (event) => {
        const button = event.target.closest("button");

        if (!button) {
            return;
        }

        const command = button.dataset.command;
        const block = button.dataset.block;

        if (command) {
            executeCommand(command);
        } else if (block) {
            applyBlockFormat(block);
        }
    });

    clearFormattingBtn.addEventListener("click", clearFormatting);
    clearDocumentBtn.addEventListener("click", clearDocument);
    downloadPdfBtn.addEventListener("click", downloadPDF);

    documentEditor.addEventListener("input", updatePreview);

    documentTitle.addEventListener("input", updatePreview);

    paperSize.addEventListener("change", () => {
        showStatus(`Paper size changed to ${paperSize.value.toUpperCase()}.`);
    });

    orientation.addEventListener("change", () => {
        showStatus(`Orientation changed to ${orientation.value}.`);
    });

    // Initialize the preview and word counters.
    updatePreview();
});