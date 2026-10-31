"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("powerpointFile");
    const fileInfo = document.getElementById("fileInfo");
    const conversionPanel = document.getElementById("conversionPanel");
    const slideCount = document.getElementById("slideCount");
    const slidePreview = document.getElementById("slidePreview");
    const pageSizeSelect = document.getElementById("pageSize");
    const orientationSelect = document.getElementById("orientation");
    const fontSizeSelect = document.getElementById("fontSize");
    const statusMessage = document.getElementById("statusMessage");
    const convertBtn = document.getElementById("convertBtn");
    const resetBtn = document.getElementById("resetBtn");
    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const MAX_SLIDES = 500;
    const MAX_TEXT_LENGTH = 200000;

    let currentFile = null;
    let slides = [];

    function setStatus(message, type = "") {
        statusMessage.textContent = message;
        statusMessage.className = "status-message";

        if (type) {
            statusMessage.classList.add(type);
        }
    }

    function resetTool() {
        currentFile = null;
        slides = [];

        fileInput.value = "";
        fileInfo.textContent = "No file selected.";
        slideCount.textContent = "0";
        slidePreview.replaceChildren();

        conversionPanel.hidden = true;
        convertBtn.disabled = false;

        setStatus("");
    }

    function parseXml(xmlText, description) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "application/xml");

        if (
            xml.getElementsByTagName("parsererror").length > 0 ||
            !xml.documentElement
        ) {
            throw new Error(
                `The presentation contains invalid ${description} XML.`
            );
        }

        return xml;
    }

    function resolvePackagePath(basePath, target) {
        const combined = target.startsWith("/")
            ? target.slice(1)
            : `${basePath}/${target}`;

        const parts = [];

        combined.split("/").forEach(part => {
            if (!part || part === ".") {
                return;
            }

            if (part === "..") {
                parts.pop();
            } else {
                parts.push(part);
            }
        });

        return parts.join("/");
    }

    function getRelationshipId(element) {
        return (
            element.getAttributeNS(
                "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
                "id"
            ) ||
            element.getAttribute("r:id") ||
            element.getAttribute("id")
        );
    }

    function extractSlideText(slideXml) {
        const shapeElements = Array.from(
            slideXml.getElementsByTagNameNS(
                "http://schemas.openxmlformats.org/presentationml/2006/main",
                "sp"
            )
        );

        const shapeTexts = [];

        for (const shape of shapeElements) {
            const paragraphElements = Array.from(
                shape.getElementsByTagNameNS(
                    "http://schemas.openxmlformats.org/drawingml/2006/main",
                    "p"
                )
            );

            const paragraphs = paragraphElements.map(paragraph => {
                const textNodes = Array.from(
                    paragraph.getElementsByTagNameNS(
                        "http://schemas.openxmlformats.org/drawingml/2006/main",
                        "t"
                    )
                );

                return textNodes.map(node => node.textContent || "").join("");
            });

            const text = paragraphs
                .map(paragraph => paragraph.trim())
                .filter(Boolean)
                .join("\n");

            if (text) {
                shapeTexts.push(text);
            }
        }

        return shapeTexts.join("\n\n").slice(0, MAX_TEXT_LENGTH);
    }

    async function readPresentation(file) {
        if (typeof JSZip === "undefined") {
            throw new Error(
                "The presentation library did not load. Check your internet connection and reload the page."
            );
        }

        const zip = await JSZip.loadAsync(file, {
            checkCRC32: false
        });

        const presentationPath = "ppt/presentation.xml";
        const relationshipsPath = "ppt/_rels/presentation.xml.rels";

        const presentationFile = zip.file(presentationPath);
        const relationshipsFile = zip.file(relationshipsPath);

        if (!presentationFile || !relationshipsFile) {
            throw new Error(
                "This file does not appear to be a valid PPTX presentation."
            );
        }

        const [presentationText, relationshipsText] = await Promise.all([
            presentationFile.async("text"),
            relationshipsFile.async("text")
        ]);

        const presentationXml = parseXml(
            presentationText,
            "presentation"
        );

        const relationshipsXml = parseXml(
            relationshipsText,
            "relationship"
        );

        const relationshipMap = new Map();

        const relationships = Array.from(
            relationshipsXml.getElementsByTagNameNS(
                "http://schemas.openxmlformats.org/package/2006/relationships",
                "Relationship"
            )
        );

        relationships.forEach(relationship => {
            const id = relationship.getAttribute("Id");
            const target = relationship.getAttribute("Target");
            const type = relationship.getAttribute("Type") || "";
            const targetMode = relationship.getAttribute("TargetMode");

            if (
                id &&
                target &&
                targetMode !== "External"
            ) {
                relationshipMap.set(id, {
                    target,
                    type
                });
            }
        });

        const slideIds = Array.from(
            presentationXml.getElementsByTagNameNS(
                "http://schemas.openxmlformats.org/presentationml/2006/main",
                "sldId"
            )
        );

        if (slideIds.length === 0) {
            throw new Error("No slides were found in this presentation.");
        }

        if (slideIds.length > MAX_SLIDES) {
            throw new Error(
                `This presentation contains more than ${MAX_SLIDES} slides. Please use a smaller presentation.`
            );
        }

        const results = [];

        for (let index = 0; index < slideIds.length; index++) {
            const relationshipId = getRelationshipId(slideIds[index]);
            const relationship = relationshipMap.get(relationshipId);

            if (!relationship) {
                results.push({
                    number: index + 1,
                    text: "",
                    warning: "The slide could not be located."
                });
                continue;
            }

            if (
                relationship.type &&
                !relationship.type.endsWith("/slide")
            ) {
                results.push({
                    number: index + 1,
                    text: "",
                    warning: "This slide reference is not supported."
                });
                continue;
            }

            const slidePath = resolvePackagePath(
                "ppt",
                relationship.target
            );

            const slideFile = zip.file(slidePath);

            if (!slideFile) {
                results.push({
                    number: index + 1,
                    text: "",
                    warning: "The slide file could not be found."
                });
                continue;
            }

            const slideText = await slideFile.async("text");
            const slideXml = parseXml(slideText, "slide");
            const text = extractSlideText(slideXml);

            results.push({
                number: index + 1,
                text,
                warning: ""
            });
        }

        return results;
    }

    function renderSlides() {
        slidePreview.replaceChildren();

        slides.forEach(slide => {
            const card = document.createElement("article");
            card.className = "slide-card";

            const header = document.createElement("div");
            header.className = "slide-card-header";

            const title = document.createElement("h4");
            title.textContent = `Slide ${slide.number}`;

            const number = document.createElement("span");
            number.className = "slide-number";
            number.textContent = `SLIDE ${slide.number}`;

            header.append(title, number);

            const content = document.createElement("p");
            content.className = "slide-text";

            if (slide.text) {
                content.textContent = slide.text;
            } else {
                content.classList.add("empty");
                content.textContent = slide.warning ||
                    "No readable text was found on this slide.";
            }

            card.append(header, content);
            slidePreview.appendChild(card);
        });
    }

    async function handleFileSelection(event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        resetTool();
        currentFile = file;

        const extension = file.name.split(".").pop().toLowerCase();

        if (extension !== "pptx") {
            resetTool();
            fileInfo.textContent = "Unsupported file format.";
            setStatus(
                "Please select a PowerPoint PPTX file. Older PPT files are not supported.",
                "error"
            );
            return;
        }

        if (file.size === 0) {
            resetTool();
            fileInfo.textContent = "The selected file is empty.";
            setStatus("Please select a non-empty PPTX file.", "error");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            resetTool();
            fileInfo.textContent = "File is too large.";
            setStatus(
                "Please select a presentation smaller than 50 MB.",
                "error"
            );
            return;
        }

        fileInfo.textContent =
            `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;

        conversionPanel.hidden = false;
        convertBtn.disabled = true;
        setStatus("Reading your PowerPoint presentation...");

        try {
            slides = await readPresentation(file);

            if (!slides.length) {
                throw new Error("No readable slides were found.");
            }

            slideCount.textContent = String(slides.length);
            renderSlides();

            setStatus(
                "Presentation loaded. Review the extracted text before converting.",
                "success"
            );

            convertBtn.disabled = false;
        } catch (error) {
            console.error("PowerPoint reading error:", error);

            currentFile = null;
            slides = [];

            conversionPanel.hidden = true;
            fileInfo.textContent = "Could not read this presentation.";

            setStatus(
                error.message ||
                "Could not read the presentation. It may be damaged or encrypted.",
                "error"
            );
        }
    }

    function getSafeFilename() {
        const name = currentFile.name.replace(/\.[^.]+$/, "");

        const safeName = name
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
            .trim()
            .slice(0, 100) || "presentation";

        return `${safeName}.pdf`;
    }

    function addWrappedText(doc, text, x, y, maxWidth, lineHeight, bottomLimit) {
        const paragraphs = String(text).split("\n");
        let currentY = y;

        for (const paragraph of paragraphs) {
            const wrappedLines = paragraph
                ? doc.splitTextToSize(paragraph, maxWidth)
                : [""];

            for (const line of wrappedLines) {
                if (currentY + lineHeight > bottomLimit) {
                    doc.addPage();
                    currentY = 18;
                }

                if (line) {
                    doc.text(line, x, currentY);
                }

                currentY += lineHeight;
            }

            currentY += lineHeight * 0.35;
        }

        return currentY;
    }

    async function convertToPdf() {
        if (!currentFile || slides.length === 0) {
            setStatus("Please upload a valid presentation first.", "error");
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

            const fontSize = Number(fontSizeSelect.value);
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const marginX = 15;
            const topMargin = 17;
            const bottomMargin = 15;
            const contentWidth = pageWidth - marginX * 2;
            const bottomLimit = pageHeight - bottomMargin;

            slides.forEach((slide, index) => {
                if (index > 0) {
                    doc.addPage();
                }

                doc.setFont("helvetica", "bold");
                doc.setFontSize(17);

                doc.text(
                    `Slide ${slide.number}`,
                    marginX,
                    topMargin
                );

                doc.setDrawColor(217, 54, 54);
                doc.setLineWidth(0.6);
                doc.line(
                    marginX,
                    topMargin + 4,
                    pageWidth - marginX,
                    topMargin + 4
                );

                doc.setFont("helvetica", "normal");
                doc.setFontSize(fontSize);

                const text = slide.text ||
                    slide.warning ||
                    "No readable text was found on this slide.";

                const lineHeight = Math.max(5, fontSize * 0.42);

                addWrappedText(
                    doc,
                    text,
                    marginX,
                    topMargin + 13,
                    contentWidth,
                    lineHeight,
                    bottomLimit
                );
            });

            doc.save(getSafeFilename());

            setStatus(
                `PDF downloaded successfully with ${slides.length} slide pages.`,
                "success"
            );
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
    convertBtn.addEventListener("click", convertToPdf);
    resetBtn.addEventListener("click", resetTool);
});