/* =========================
   DIGIIFOX PROTECT PDF
   ========================= */

const pdfInput = document.getElementById("pdfInput");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const uploadBox = document.getElementById("uploadBox");

const filePanel = document.getElementById("filePanel");
const settingsPanel = document.getElementById("settingsPanel");

const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const pageCount = document.getElementById("pageCount");
const removeFileBtn = document.getElementById("removeFileBtn");

const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

const allowPrinting = document.getElementById("allowPrinting");
const allowCopying = document.getElementById("allowCopying");
const allowModifying = document.getElementById("allowModifying");

const protectBtn = document.getElementById("protectBtn");

const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const statusMessage = document.getElementById("statusMessage");

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PASSWORD_LENGTH = 128;

let selectedFile = null;
let pdfPageCount = 0;
let isProcessing = false;
let fileGeneration = 0;

/* =========================
   HELPERS
   ========================= */

function showStatus(message, type = "info") {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
}

function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "status-message hidden";
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

function safeBaseName(name) {
    return name
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .trim()
        .slice(0, 100) || "protected-document";
}

function setProgress(percent, message) {
    progressBar.style.width =
        `${Math.max(0, Math.min(100, percent))}%`;

    progressText.textContent = message;
}

function resetProgress() {
    progressBar.style.width = "0%";
    progressText.textContent = "Preparing encryption...";
}

/* =========================
   SHOW / HIDE PASSWORD
   ========================= */

document.querySelectorAll(".show-password").forEach((button) => {
    button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.target);

        if (!target) return;

        const shouldShow = target.type === "password";

        target.type = shouldShow ? "text" : "password";
        button.textContent = shouldShow ? "Hide" : "Show";
    });
});

/* =========================
   FILE SELECTION
   ========================= */

chooseFileBtn.addEventListener("click", () => {
    if (!isProcessing) {
        pdfInput.click();
    }
});

pdfInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (file) {
        loadPDF(file);
    }
});

uploadBox.addEventListener("dragover", (event) => {
    event.preventDefault();

    if (!isProcessing) {
        uploadBox.classList.add("drag-active");
    }
});

uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("drag-active");
});

uploadBox.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadBox.classList.remove("drag-active");

    if (isProcessing) return;

    const file = event.dataTransfer.files[0];

    if (file) {
        loadPDF(file);
    }
});

/* =========================
   LOAD AND VALIDATE PDF
   ========================= */

async function loadPDF(file) {
    if (isProcessing) return;

    clearStatus();

    const isPDF =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
        showStatus("Please select a valid PDF file.", "error");
        pdfInput.value = "";
        return;
    }

    if (file.size === 0) {
        showStatus("The selected file is empty.", "error");
        pdfInput.value = "";
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showStatus("The file exceeds the 50 MB size limit.", "error");
        pdfInput.value = "";
        return;
    }

    resetTool();

    const generation = fileGeneration;
    selectedFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    pageCount.textContent = "Checking PDF...";

    filePanel.classList.remove("hidden");
    uploadBox.classList.add("hidden");

    try {
        const buffer = await file.arrayBuffer();

        if (generation !== fileGeneration) return;

        // This step checks that PDF-Lib can read the source PDF.
        // It does not encrypt the document.
        const pdfDoc = await PDFLib.PDFDocument.load(
            new Uint8Array(buffer),
            {
                updateMetadata: false
            }
        );

        if (generation !== fileGeneration) return;

        pdfPageCount = pdfDoc.getPageCount();

        if (pdfPageCount < 1) {
            throw new Error("The PDF does not contain any pages.");
        }

        pageCount.textContent =
            `${pdfPageCount} page${pdfPageCount === 1 ? "" : "s"}`;

        settingsPanel.classList.remove("hidden");

    } catch (error) {
        console.error("PDF loading error:", error);

        if (generation !== fileGeneration) return;

        resetTool();
        uploadBox.classList.remove("hidden");

        showStatus(
            "Could not read this PDF. It may be damaged, encrypted, or unsupported. If it is already password-protected, use an unlocked copy.",
            "error"
        );
    }
}

/* =========================
   RESET TOOL
   ========================= */

function resetTool() {
    fileGeneration++;

    selectedFile = null;
    pdfPageCount = 0;

    pdfInput.value = "";
    passwordInput.value = "";
    confirmPasswordInput.value = "";

    passwordInput.type = "password";
    confirmPasswordInput.type = "password";

    document.querySelectorAll(".show-password").forEach((button) => {
        button.textContent = "Show";
    });

    filePanel.classList.add("hidden");
    settingsPanel.classList.add("hidden");
    progressArea.classList.add("hidden");

    clearStatus();
    resetProgress();
}

/* =========================
   VALIDATE PASSWORDS
   ========================= */

function validatePasswords() {
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (password.length < 8) {
        throw new Error("Your password must contain at least 8 characters.");
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
        throw new Error(
            `Your password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`
        );
    }

    if (password !== confirmPassword) {
        throw new Error("The passwords do not match.");
    }

    if (!/\S/.test(password)) {
        throw new Error("Your password cannot contain only spaces.");
    }

    return password;
}

/* =========================
   ENCRYPT PDF WITH AES-256
   ========================= */

protectBtn.addEventListener("click", protectPDF);

async function protectPDF() {
    if (isProcessing) return;

    if (!selectedFile) {
        showStatus("Please select a PDF file first.", "error");
        return;
    }

    let password;

    try {
        password = validatePasswords();
    } catch (error) {
        showStatus(error.message, "error");
        return;
    }

    // AES-256 requires the browser's Web Crypto API.
    // localhost and HTTPS are secure contexts in modern browsers.
    if (!window.isSecureContext || !window.crypto?.subtle) {
        showStatus(
            "Secure encryption requires HTTPS or localhost. Open this project using VS Code Live Server, or deploy it over HTTPS.",
            "error"
        );
        return;
    }

    if (typeof PDFEncrypt === "undefined" ||
        typeof PDFEncrypt.encryptPDF !== "function") {
        showStatus(
            "The PDF encryption library could not load. Check your internet connection and try again.",
            "error"
        );
        return;
    }

    const sourceFile = selectedFile;
    const generation = fileGeneration;

    isProcessing = true;

    protectBtn.disabled = true;
    chooseFileBtn.disabled = true;
    removeFileBtn.disabled = true;

    progressArea.classList.remove("hidden");
    setProgress(10, "Reading your PDF...");

    try {
        const buffer = await sourceFile.arrayBuffer();

        if (generation !== fileGeneration) return;

        const pdfBytes = new Uint8Array(buffer);

        setProgress(30, "Encrypting with AES-256...");

        /*
         * PDFEncrypt is provided by:
         * @pdfsmaller/pdf-encrypt
         *
         * AES-256 is the default algorithm.
         * The user password is required to open the result.
         */
        const encryptedBytes = await PDFEncrypt.encryptPDF(
            pdfBytes,
            password,
            {
                algorithm: "AES-256",
                allowPrinting: allowPrinting.checked,
                allowCopying: allowCopying.checked,
                allowModifying: allowModifying.checked
            }
        );

        if (generation !== fileGeneration) return;

        setProgress(90, "Preparing your protected PDF...");

        const outputBlob = new Blob(
            [encryptedBytes],
            { type: "application/pdf" }
        );

        const outputName =
            `${safeBaseName(sourceFile.name)}-protected.pdf`;

        downloadBlob(outputBlob, outputName);

        setProgress(100, "Encryption complete!");

        // Clear the password fields after successful encryption.
        passwordInput.value = "";
        confirmPasswordInput.value = "";

        showStatus(
            "Success! Your PDF has been encrypted with AES-256 and downloaded. Open it in a PDF reader to verify that it asks for your password.",
            "success"
        );

    } catch (error) {
        console.error("PDF encryption error:", error);

        showStatus(
            error?.message ||
            "Encryption failed. The PDF may be unsupported or damaged. Please try another PDF.",
            "error"
        );

    } finally {
        isProcessing = false;

        protectBtn.disabled = false;
        chooseFileBtn.disabled = false;
        removeFileBtn.disabled = false;
    }
}

/* =========================
   DOWNLOAD FILE
   ========================= */

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* =========================
   REMOVE FILE
   ========================= */

removeFileBtn.addEventListener("click", () => {
    if (isProcessing) return;

    resetTool();
    uploadBox.classList.remove("hidden");
});

/* =========================
   FOOTER YEAR
   ========================= */

document.getElementById("currentYear").textContent =
    new Date().getFullYear();