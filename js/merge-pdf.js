const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const dropArea = document.getElementById("dropArea");
const fileSection = document.getElementById("fileSection");
const fileList = document.getElementById("fileList");
const fileCount = document.getElementById("fileCount");
const clearBtn = document.getElementById("clearBtn");
const mergeBtn = document.getElementById("mergeBtn");
const statusMessage = document.getElementById("statusMessage");

const selectedFiles = [];

let isMerging = false;

/* Set footer year */

document.getElementById("year").textContent = new Date().getFullYear();

/* Format file sizes */

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/* Show status messages */

function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

/* Check whether a file is a PDF */

function isPdfFile(file) {
    return (
        file.name.toLowerCase().endsWith(".pdf") &&
        (
            file.type === "application/pdf" ||
            file.type === "" ||
            file.type === "application/x-pdf"
        )
    );
}

/* Open file picker */

browseBtn.addEventListener("click", () => {
    if (!isMerging) {
        fileInput.click();
    }
});

dropArea.addEventListener("click", (event) => {
    if (
        !isMerging &&
        !event.target.closest("button") &&
        event.target.id !== "fileInput"
    ) {
        fileInput.click();
    }
});

dropArea.addEventListener("keydown", (event) => {
    if (
        !isMerging &&
        (event.key === "Enter" || event.key === " ")
    ) {
        event.preventDefault();
        fileInput.click();
    }
});

/* Add selected files */

fileInput.addEventListener("change", (event) => {
    addFiles(event.target.files);

    // Allow the same file to be selected again later.
    fileInput.value = "";
});

/* Drag and drop */

["dragenter", "dragover"].forEach((eventName) => {
    dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!isMerging) {
            dropArea.classList.add("drag-over");
        }
    });
});

["dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();

        dropArea.classList.remove("drag-over");
    });
});

dropArea.addEventListener("drop", (event) => {
    if (!isMerging) {
        addFiles(event.dataTransfer.files);
    }
});

/* Add files to the selected list */

function addFiles(files) {
    if (isMerging) {
        return;
    }

    let addedCount = 0;
    let rejectedCount = 0;

    for (const file of files) {
        if (!isPdfFile(file)) {
            rejectedCount++;
            continue;
        }

        // Avoid adding the same File object twice.
        const alreadyAdded = selectedFiles.some(
            (item) =>
                item.file.name === file.name &&
                item.file.size === file.size &&
                item.file.lastModified === file.lastModified
        );

        if (alreadyAdded) {
            continue;
        }

        selectedFiles.push({
            file,
            id: crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()) + Math.random()
        });

        addedCount++;
    }

    renderFiles();

    if (rejectedCount > 0) {
        showStatus(
            `${rejectedCount} file(s) were skipped. Please select PDF files only.`,
            "error"
        );
    } else if (addedCount > 0) {
        showStatus(`${addedCount} PDF file(s) added.`, "success");
    } else if (files.length > 0) {
        showStatus("No new PDF files were added.", "info");
    }
}

/* Render the file list */

function renderFiles() {
    fileList.replaceChildren();

    fileSection.hidden = selectedFiles.length === 0;

    fileCount.textContent =
        selectedFiles.length +
        (selectedFiles.length === 1 ? " file selected" : " files selected");

    selectedFiles.forEach((item, index) => {
        const file = item.file;

        const row = document.createElement("div");
        row.className = "file-item";

        const icon = document.createElement("div");
        icon.className = "file-icon";
        icon.textContent = "PDF";
        icon.setAttribute("aria-hidden", "true");

        const details = document.createElement("div");
        details.className = "file-details";

        const name = document.createElement("div");
        name.className = "file-name";
        name.textContent = file.name;

        const size = document.createElement("div");
        size.className = "file-size";
        size.textContent =
            `${formatFileSize(file.size)} · Position ${index + 1}`;

        details.append(name, size);

        const actions = document.createElement("div");
        actions.className = "file-actions";

        const upBtn = createActionButton(
            "↑",
            `Move ${file.name} up`,
            index === 0,
            () => moveFile(index, -1)
        );

        const downBtn = createActionButton(
            "↓",
            `Move ${file.name} down`,
            index === selectedFiles.length - 1,
            () => moveFile(index, 1)
        );

        const removeBtn = createActionButton(
            "×",
            `Remove ${file.name}`,
            false,
            () => removeFile(index)
        );

        removeBtn.classList.add("remove-btn");

        actions.append(upBtn, downBtn, removeBtn);

        row.append(icon, details, actions);
        fileList.appendChild(row);
    });

    mergeBtn.disabled = selectedFiles.length < 2 || isMerging;
    clearBtn.disabled = isMerging;
    browseBtn.disabled = isMerging;

    mergeBtn.textContent = isMerging
        ? "Merging PDFs..."
        : "Merge PDF Files";
}

/* Create accessible action buttons */

function createActionButton(label, ariaLabel, disabled, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "file-action";
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.disabled = disabled || isMerging;

    button.addEventListener("click", callback);

    return button;
}

/* Move a file up or down */

function moveFile(index, direction) {
    if (isMerging) {
        return;
    }

    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= selectedFiles.length) {
        return;
    }

    [
        selectedFiles[index],
        selectedFiles[newIndex]
    ] = [
        selectedFiles[newIndex],
        selectedFiles[index]
    ];

    renderFiles();
    showStatus("File order updated.", "success");
}

/* Remove an individual file */

function removeFile(index) {
    if (isMerging) {
        return;
    }

    selectedFiles.splice(index, 1);

    renderFiles();
    showStatus("File removed from the merge list.");
}

/* Clear the entire list */

clearBtn.addEventListener("click", () => {
    if (isMerging) {
        return;
    }

    selectedFiles.length = 0;

    renderFiles();
    showStatus("All files have been removed.");
});

/* Merge the PDFs */

mergeBtn.addEventListener("click", mergePdfs);

async function mergePdfs() {
    if (isMerging || selectedFiles.length < 2) {
        return;
    }

    if (!window.PDFLib) {
        showStatus(
            "The PDF library could not load. Check your internet connection and reload the page.",
            "error"
        );

        return;
    }

    isMerging = true;
    renderFiles();

    showStatus("Preparing your PDF files. Please wait.", "info");

    let downloadUrl = null;
    let downloadLink = null;

    try {
        const { PDFDocument } = window.PDFLib;

        const mergedPdf = await PDFDocument.create();

        for (let index = 0; index < selectedFiles.length; index++) {
            const file = selectedFiles[index].file;

            showStatus(
                `Processing file ${index + 1} of ${selectedFiles.length}: ${file.name}`,
                "info"
            );

            const fileBuffer = await file.arrayBuffer();

            const sourcePdf = await PDFDocument.load(fileBuffer);

            const pageIndices = sourcePdf.getPageIndices();

            const copiedPages = await mergedPdf.copyPages(
                sourcePdf,
                pageIndices
            );

            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
            });
        }

        showStatus("Creating your merged PDF...", "info");

        const mergedBytes = await mergedPdf.save();

        const mergedBlob = new Blob(
            [mergedBytes],
            { type: "application/pdf" }
        );

        downloadUrl = URL.createObjectURL(mergedBlob);

        downloadLink = document.createElement("a");
        downloadLink.href = downloadUrl;
        downloadLink.download = "digiiFox-merged.pdf";
        downloadLink.textContent = "Download merged PDF";
        downloadLink.className = "merge-btn";
        downloadLink.style.display = "block";
        downloadLink.style.textAlign = "center";
        downloadLink.style.marginTop = "12px";

        mergeBtn.insertAdjacentElement("afterend", downloadLink);

        showStatus(
            "Success! Your PDF is ready. Select the download button below.",
            "success"
        );

    } catch (error) {
        console.error("PDF merge error:", error);

        showStatus(
            "Could not merge these PDFs. A file may be damaged, encrypted, or unsupported. Try opening each PDF first and then retry.",
            "error"
        );

    } finally {
        isMerging = false;
        renderFiles();

        if (downloadUrl) {
            /*
             * Keep the download link available until the user
             * downloads the file or starts another merge.
             */
            downloadLink.addEventListener(
                "click",
                () => {
                    setTimeout(() => {
                        URL.revokeObjectURL(downloadUrl);
                    }, 60000);
                },
                { once: true }
            );
        }
    }
}

/* Remove any previous download link when the list changes */

function removeOldDownloadLink() {
    const oldLink = document.querySelector(".merge-card > .merge-btn");

    if (oldLink) {
        oldLink.remove();
    }
}

/* Clear an earlier result before a new selection */

fileInput.addEventListener("click", removeOldDownloadLink);

clearBtn.addEventListener("click", removeOldDownloadLink);

fileList.addEventListener("click", removeOldDownloadLink);