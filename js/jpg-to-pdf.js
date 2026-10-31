const imageInput = document.getElementById("imageInput");
const browseBtn = document.getElementById("browseBtn");
const addMoreBtn = document.getElementById("addMoreBtn");
const dropZone = document.getElementById("dropZone");

const workspace = document.getElementById("workspace");
const imageList = document.getElementById("imageList");
const imageCount = document.getElementById("imageCount");

const pageSizeSelect = document.getElementById("pageSize");
const orientationSelect = document.getElementById("pageOrientation");

const convertBtn = document.getElementById("convertBtn");
const removeBtn = document.getElementById("removeBtn");
const statusMessage = document.getElementById("statusMessage");

const resultSection = document.getElementById("resultSection");
const resultDetails = document.getElementById("resultDetails");
const downloadBtn = document.getElementById("downloadBtn");
const startAgainBtn = document.getElementById("startAgainBtn");

const MAX_IMAGES = 20;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

let images = [];
let nextImageId = 1;
let isProcessing = false;
let downloadUrl = null;

browseBtn.addEventListener("click", () => imageInput.click());
addMoreBtn.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", async (event) => {
    await addImages(event.target.files);
    imageInput.value = "";
});

dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");

    await addImages(event.dataTransfer.files);
});

convertBtn.addEventListener("click", createPdf);
startAgainBtn.addEventListener("click", resetTool);

function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSupportedImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    return (
        ["jpg", "jpeg", "png"].includes(extension) &&
        ["image/jpeg", "image/png"].includes(file.type)
    );
}

async function addImages(fileList) {
    if (isProcessing) {
        return;
    }

    const files = Array.from(fileList);

    if (!files.length) {
        return;
    }

    let addedCount = 0;
    const errors = [];

    for (const file of files) {
        if (images.length >= MAX_IMAGES) {
            errors.push(`You can add up to ${MAX_IMAGES} images.`);
            break;
        }

        if (!isSupportedImage(file)) {
            errors.push(`${file.name}: Choose a JPG, JPEG, or PNG image.`);
            continue;
        }

        if (file.size === 0) {
            errors.push(`${file.name}: This file is empty.`);
            continue;
        }

        if (file.size > MAX_FILE_SIZE) {
            errors.push(`${file.name}: Maximum image size is 15 MB.`);
            continue;
        }

        try {
            const buffer = await file.arrayBuffer();

            // Verify that the browser can decode the selected image.
            const bitmap = await createImageBitmap(file);

            if (!bitmap.width || !bitmap.height) {
                bitmap.close();
                throw new Error("Invalid image dimensions.");
            }

            const width = bitmap.width;
            const height = bitmap.height;

            bitmap.close();

            images.push({
                id: nextImageId++,
                file,
                buffer,
                width,
                height,
                url: URL.createObjectURL(file)
            });

            addedCount++;
        } catch (error) {
            console.error(error);
            errors.push(`${file.name}: This image could not be opened.`);
        }
    }

    if (images.length > 0) {
        workspace.classList.remove("hidden");
        dropZone.classList.add("hidden");
        resultSection.classList.add("hidden");
        renderImageList();
    }

    if (errors.length) {
        setStatus(errors.join(" "), "error");
    } else if (addedCount > 0) {
        setStatus(
            `${addedCount} image(s) added successfully.`,
            "success"
        );
    }

    if (images.length === 0 && errors.length === 0) {
        setStatus("Choose at least one image.", "error");
    }
}

function renderImageList() {
    imageList.replaceChildren();

    imageCount.textContent =
        `${images.length} image${images.length === 1 ? "" : "s"} selected`;

    images.forEach((image, index) => {
        const item = document.createElement("article");
        item.className = "image-item";

        const preview = document.createElement("img");
        preview.src = image.url;
        preview.alt = `Preview of ${image.file.name}`;

        const info = document.createElement("div");
        info.className = "image-item-info";

        const title = document.createElement("h3");
        title.textContent = `${index + 1}. ${image.file.name}`;

        const details = document.createElement("p");
        details.textContent =
            `${formatBytes(image.file.size)} · ${image.width} × ${image.height} px`;

        info.append(title, details);

        const actions = document.createElement("div");
        actions.className = "image-actions";

        const upButton = createActionButton("↑", "Move image up", () => {
            moveImage(index, -1);
        });

        upButton.disabled = index === 0;

        const downButton = createActionButton("↓", "Move image down", () => {
            moveImage(index, 1);
        });

        downButton.disabled = index === images.length - 1;

        const deleteButton = createActionButton("✕", "Remove image", () => {
            removeImage(image.id);
        });

        deleteButton.classList.add("delete-image");

        actions.append(upButton, downButton, deleteButton);
        item.append(preview, info, actions);

        imageList.appendChild(item);
    });

    addMoreBtn.disabled = images.length >= MAX_IMAGES;
}

function createActionButton(text, label, onClick) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);

    return button;
}

function moveImage(index, direction) {
    const newIndex = index + direction;

    if (
        newIndex < 0 ||
        newIndex >= images.length ||
        isProcessing
    ) {
        return;
    }

    [images[index], images[newIndex]] = [
        images[newIndex],
        images[index]
    ];

    renderImageList();
    setStatus("Image order updated.");
}

function removeImage(id) {
    if (isProcessing) {
        return;
    }

    const index = images.findIndex((image) => image.id === id);

    if (index === -1) {
        return;
    }

    URL.revokeObjectURL(images[index].url);
    images.splice(index, 1);

    renderImageList();
    resultSection.classList.add("hidden");

    if (images.length === 0) {
        workspace.classList.add("hidden");
        dropZone.classList.remove("hidden");
    }

    setStatus("Image removed.");
}

function getPageDimensions(image) {
    const pageSize = pageSizeSelect.value;
    const orientation = orientationSelect.value;

    if (pageSize === "original") {
        return {
            width: image.width,
            height: image.height,
            fitToPage: true
        };
    }

    let width;
    let height;

    if (pageSize === "letter") {
        width = 612;
        height = 792;
    } else {
        // A4 dimensions in PDF points.
        width = 595.28;
        height = 841.89;
    }

    if (orientation === "landscape") {
        [width, height] = [Math.max(width, height), Math.min(width, height)];
    } else if (orientation === "portrait") {
        [width, height] = [Math.min(width, height), Math.max(width, height)];
    } else {
        // Automatic orientation follows the image.
        if (image.width > image.height) {
            [width, height] = [Math.max(width, height), Math.min(width, height)];
        }
    }

    return { width, height, fitToPage: false };
}

async function createPdf() {
    if (isProcessing) {
        return;
    }

    if (!images.length) {
        setStatus("Please choose at least one image.", "error");
        return;
    }

    if (!window.PDFLib) {
        setStatus(
            "The PDF library could not load. Check your internet connection and reload the page.",
            "error"
        );
        return;
    }

    isProcessing = true;
    convertBtn.disabled = true;
    addMoreBtn.disabled = true;
    convertBtn.textContent = "Creating PDF...";
    setStatus("Preparing your PDF...");

    try {
        const pdfDoc = await PDFLib.PDFDocument.create();

        for (let index = 0; index < images.length; index++) {
            const image = images[index];

            setStatus(
                `Adding image ${index + 1} of ${images.length}...`
            );

            let embeddedImage;

            if (image.file.type === "image/jpeg") {
                embeddedImage = await pdfDoc.embedJpg(image.buffer);
            } else {
                embeddedImage = await pdfDoc.embedPng(image.buffer);
            }

            const pageDimensions = getPageDimensions(image);

            const page = pdfDoc.addPage([
                pageDimensions.width,
                pageDimensions.height
            ]);

            let drawWidth;
            let drawHeight;

            if (pageDimensions.fitToPage) {
                drawWidth = pageDimensions.width;
                drawHeight = pageDimensions.height;
            } else {
                const margin = 18;

                const availableWidth = pageDimensions.width - margin * 2;
                const availableHeight = pageDimensions.height - margin * 2;

                const scale = Math.min(
                    availableWidth / embeddedImage.width,
                    availableHeight / embeddedImage.height
                );

                drawWidth = embeddedImage.width * scale;
                drawHeight = embeddedImage.height * scale;
            }

            page.drawImage(embeddedImage, {
                x: (pageDimensions.width - drawWidth) / 2,
                y: (pageDimensions.height - drawHeight) / 2,
                width: drawWidth,
                height: drawHeight
            });
        }

        setStatus("Finalizing your PDF...");

        const pdfBytes = await pdfDoc.save();

        const pdfBlob = new Blob([pdfBytes], {
            type: "application/pdf"
        });

        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
        }

        downloadUrl = URL.createObjectURL(pdfBlob);

        downloadBtn.href = downloadUrl;
        downloadBtn.download = "digiiFox-images.pdf";

        resultDetails.textContent =
            `${images.length} image(s) combined into one PDF · ${formatBytes(pdfBlob.size)}`;

        resultSection.classList.remove("hidden");
        setStatus("Your PDF has been created successfully.", "success");

        resultSection.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    } catch (error) {
        console.error(error);

        setStatus(
            "Could not create the PDF. Check that the images are valid and try again.",
            "error"
        );
    } finally {
        isProcessing = false;
        convertBtn.disabled = false;
        addMoreBtn.disabled = images.length >= MAX_IMAGES;
        convertBtn.textContent = "📄 Create PDF";
    }
}

function resetTool() {
    if (isProcessing) {
        return;
    }

    images.forEach((image) => URL.revokeObjectURL(image.url));
    images = [];

    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
    }

    imageInput.value = "";
    imageList.replaceChildren();

    pageSizeSelect.value = "a4";
    orientationSelect.value = "auto";

    workspace.classList.add("hidden");
    resultSection.classList.add("hidden");
    dropZone.classList.remove("hidden");

    imageCount.textContent = "0 images selected";
    setStatus("");
}