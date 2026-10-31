"use strict";

// DigiiFox Image Compressor
// Image processing takes place locally in the browser.

const imageInput = document.getElementById("imageInput");
const dropZone = document.getElementById("dropZone");
const chooseImageBtn = document.getElementById("chooseImageBtn");
const qualitySlider = document.getElementById("qualitySlider");
const qualityValue = document.getElementById("qualityValue");
const outputFormat = document.getElementById("outputFormat");
const formatHelp = document.getElementById("formatHelp");
const maxWidthInput = document.getElementById("maxWidth");
const maxHeightInput = document.getElementById("maxHeight");
const compressBtn = document.getElementById("compressBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadBtn = document.getElementById("downloadBtn");
const errorMessage = document.getElementById("errorMessage");

const previewGrid = document.getElementById("previewGrid");
const originalPreview = document.getElementById("originalPreview");
const compressedPreview = document.getElementById("compressedPreview");
const previewPlaceholder = document.getElementById("previewPlaceholder");

const originalDimensions = document.getElementById("originalDimensions");
const originalSize = document.getElementById("originalSize");
const compressedDimensions = document.getElementById("compressedDimensions");
const compressedSize = document.getElementById("compressedSize");

const resultsCard = document.getElementById("resultsCard");
const resultOriginalSize = document.getElementById("resultOriginalSize");
const resultCompressedSize = document.getElementById("resultCompressedSize");
const savingsBadge = document.getElementById("savingsBadge");
const sizeProgress = document.getElementById("sizeProgress");
const resultNote = document.getElementById("resultNote");
const outputStatus = document.getElementById("outputStatus");

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_DIMENSION = 12000;

let originalFile = null;
let originalImage = null;
let originalObjectUrl = null;
let compressedObjectUrl = null;
let compressedBlob = null;
let compressedFileName = "compressed-image.webp";
let isProcessing = false;
let operationNumber = 0;

// Format bytes into a readable file size.
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }

  if (bytes === 0) {
    return "0 Bytes";
  }

  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);
  const digits = index === 0 ? 0 : 2;

  return `${value.toFixed(digits)} ${units[index]}`;
}

// Convert MIME type into a safe file extension.
function getExtension(mimeType) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  return extensions[mimeType] || "img";
}

// Show an error message.
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

// Clear an error message.
function clearError() {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}

// Manage object URLs to prevent unnecessary memory usage.
function revokeCompressedUrl() {
  if (compressedObjectUrl) {
    URL.revokeObjectURL(compressedObjectUrl);
    compressedObjectUrl = null;
  }
}

// Clear the previous compressed result.
function clearCompressedResult() {
  operationNumber++;

  revokeCompressedUrl();

  compressedBlob = null;
  compressedFileName = "compressed-image.webp";

  compressedPreview.removeAttribute("src");
  compressedPreview.classList.remove("is-visible");
  compressedPreview.style.display = "none";

  previewPlaceholder.hidden = false;
  previewPlaceholder.textContent =
    "Adjust the settings and click Compress Image to generate a preview.";

  compressedDimensions.textContent = "Dimensions: —";
  compressedSize.textContent = "Size: —";

  resultsCard.hidden = true;

  savingsBadge.classList.remove("is-larger");
  sizeProgress.style.width = "0%";

  outputStatus.textContent = "Preview";
  downloadBtn.disabled = true;
}

// Read and validate an uploaded image.
function loadImage(file) {
  clearError();

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    showError("Please choose an image file.");
    return;
  }

  const supportedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!supportedTypes.includes(file.type)) {
    showError("Please upload a JPG, PNG, or WebP image.");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showError("This image exceeds the 25 MB limit. Please choose a smaller file.");
    return;
  }

  if (file.size === 0) {
    showError("The selected file is empty. Please choose another image.");
    return;
  }

  const newObjectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = function () {
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      URL.revokeObjectURL(newObjectUrl);
      showError("This image could not be read. Please choose another file.");
      return;
    }

    if (width * height > MAX_PIXELS) {
      URL.revokeObjectURL(newObjectUrl);
      showError(
        "This image exceeds the 40-megapixel limit. Please use a smaller image."
      );
      return;
    }

    // Only replace the current image after the new one passes validation.
    if (originalObjectUrl) {
      URL.revokeObjectURL(originalObjectUrl);
    }

    originalFile = file;
    originalImage = image;
    originalObjectUrl = newObjectUrl;

    clearCompressedResult();

    originalPreview.src = originalObjectUrl;
    originalPreview.classList.add("is-visible");
    originalPreview.style.display = "block";

    previewGrid.hidden = false;

    originalDimensions.textContent = `Dimensions: ${width} × ${height} px`;
    originalSize.textContent = `Size: ${formatBytes(file.size)}`;

    compressBtn.disabled = false;

    // Start with dimensions blank, preserving the original size by default.
    maxWidthInput.value = "";
    maxHeightInput.value = "";

    clearError();

    // Remove the file from the input so selecting the same file again works.
    imageInput.value = "";
  };

  image.onerror = function () {
    URL.revokeObjectURL(newObjectUrl);
    showError("We couldn't open this image. Please choose a valid image file.");
  };

  image.src = newObjectUrl;
}

// Calculate output dimensions while preserving the aspect ratio.
function calculateDimensions(width, height, maxWidth, maxHeight) {
  const hasMaxWidth = maxWidth !== null;
  const hasMaxHeight = maxHeight !== null;

  if (!hasMaxWidth && !hasMaxHeight) {
    return { width, height };
  }

  let scale = 1;

  if (hasMaxWidth) {
    scale = Math.min(scale, maxWidth / width);
  }

  if (hasMaxHeight) {
    scale = Math.min(scale, maxHeight / height);
  }

  // Never enlarge an image.
  scale = Math.min(scale, 1);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

// Read and validate optional resize fields.
function readDimensionInput(input, label) {
  const rawValue = input.value.trim();

  if (rawValue === "") {
    return null;
  }

  const value = Number(rawValue);

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_DIMENSION
  ) {
    throw new Error(
      `${label} must be a whole number between 1 and ${MAX_DIMENSION}.`
    );
  }

  return value;
}

// Update the output format guidance.
function updateFormatHelp() {
  const type = outputFormat.value;

  if (type === "image/webp") {
    formatHelp.textContent =
      "WebP often offers a good balance between image quality and file size.";
  } else if (type === "image/jpeg") {
    formatHelp.textContent =
      "JPEG is useful for photographs. Transparent areas become white.";
  } else {
    formatHelp.textContent =
      "PNG supports transparency, but the quality slider does not control PNG compression.";
  }

  if (originalFile) {
    clearCompressedResult();
  }
}

// Compress an image using the browser canvas.
async function compressImage() {
  if (!originalFile || !originalImage || isProcessing) {
    return;
  }

  clearError();

  let maxWidth;
  let maxHeight;

  try {
    maxWidth = readDimensionInput(maxWidthInput, "Maximum width");
    maxHeight = readDimensionInput(maxHeightInput, "Maximum height");
  } catch (error) {
    showError(error.message);
    return;
  }

  const currentOperation = ++operationNumber;

  isProcessing = true;
  compressBtn.disabled = true;
  compressBtn.textContent = "Compressing...";

  try {
    const sourceWidth = originalImage.naturalWidth;
    const sourceHeight = originalImage.naturalHeight;

    const dimensions = calculateDimensions(
      sourceWidth,
      sourceHeight,
      maxWidth,
      maxHeight
    );

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Your browser could not start the image processor.");
    }

    const selectedFormat = outputFormat.value;
    const quality = Number(qualitySlider.value) / 100;

    // JPEG does not support transparency. Flatten it onto a white background.
    if (selectedFormat === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(
      originalImage,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(
              new Error("The browser could not create the compressed image.")
            );
          }
        },
        selectedFormat,
        quality
      );
    });

    // A browser may fall back to PNG if a requested format is unsupported.
    if (!blob.type.startsWith("image/")) {
      throw new Error("The browser returned an unsupported image format.");
    }

    if (currentOperation !== operationNumber) {
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(blob.type)
    ) {
      throw new Error(
        "This browser does not support the selected output format. Try another format."
      );
    }

    compressedBlob = blob;
    compressedObjectUrl = URL.createObjectURL(blob);

    const actualExtension = getExtension(blob.type);
    const baseName = originalFile.name.replace(/\.[^.]+$/, "");

    compressedFileName = `${baseName}-compressed.${actualExtension}`;

    compressedPreview.src = compressedObjectUrl;
    compressedPreview.classList.add("is-visible");
    compressedPreview.style.display = "block";

    previewPlaceholder.hidden = true;

    compressedDimensions.textContent =
      `Dimensions: ${canvas.width} × ${canvas.height} px`;

    compressedSize.textContent = `Size: ${formatBytes(blob.size)}`;

    updateResults(originalFile.size, blob.size);

    outputStatus.textContent = "Ready";
    resultsCard.hidden = false;
    downloadBtn.disabled = false;

    clearError();

    // Release the canvas pixel buffer.
    canvas.width = 1;
    canvas.height = 1;
  } catch (error) {
    if (currentOperation === operationNumber) {
      showError(
        error.message || "Something went wrong while compressing the image."
      );
    }
  } finally {
    if (currentOperation === operationNumber) {
      isProcessing = false;
      compressBtn.disabled = !originalFile;
      compressBtn.textContent = "Compress Image";
    }
  }
}

// Display the original and output sizes and calculate the size change.
function updateResults(originalBytes, outputBytes) {
  resultOriginalSize.textContent = formatBytes(originalBytes);
  resultCompressedSize.textContent = formatBytes(outputBytes);

  const difference = originalBytes - outputBytes;
  const percentage = originalBytes > 0
    ? (difference / originalBytes) * 100
    : 0;

  if (difference > 0) {
    savingsBadge.textContent = `${percentage.toFixed(1)}% smaller`;
    savingsBadge.classList.remove("is-larger");

    resultNote.textContent =
      `You saved ${formatBytes(difference)} compared with the original file.`;

    sizeProgress.style.width = `${Math.max(0, Math.min(100, (outputBytes / originalBytes) * 100))}%`;
  } else if (difference < 0) {
    savingsBadge.textContent = `${Math.abs(percentage).toFixed(1)}% larger`;
    savingsBadge.classList.add("is-larger");

    resultNote.textContent =
      "The output is larger than the original. Try a lower quality setting, smaller dimensions, or another format.";

    sizeProgress.style.width = "100%";
  } else {
    savingsBadge.textContent = "Same size";
    savingsBadge.classList.remove("is-larger");

    resultNote.textContent =
      "The output has approximately the same file size as the original.";

    sizeProgress.style.width = "100%";
  }

  // A PNG export may not respond to the quality slider.
  if (outputFormat.value === "image/png") {
    resultNote.textContent +=
      " PNG output does not use the quality slider; try WebP or JPEG if you need a smaller file.";
  }
}

// Download the output image.
function downloadCompressedImage() {
  if (!compressedBlob || !compressedObjectUrl) {
    showError("Please compress an image before downloading.");
    return;
  }

  const link = document.createElement("a");

  link.href = compressedObjectUrl;
  link.download = compressedFileName;

  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Reset the tool.
function resetTool() {
  operationNumber++;
  isProcessing = false;

  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
    originalObjectUrl = null;
  }

  revokeCompressedUrl();

  originalFile = null;
  originalImage = null;
  compressedBlob = null;

  imageInput.value = "";
  qualitySlider.value = "75";
  qualityValue.textContent = "75%";
  outputFormat.value = "image/webp";
  maxWidthInput.value = "";
  maxHeightInput.value = "";

  originalPreview.removeAttribute("src");
  originalPreview.classList.remove("is-visible");
  originalPreview.style.display = "none";

  compressedPreview.removeAttribute("src");
  compressedPreview.classList.remove("is-visible");
  compressedPreview.style.display = "none";

  previewGrid.hidden = true;
  resultsCard.hidden = true;

  originalDimensions.textContent = "Dimensions: —";
  originalSize.textContent = "Size: —";
  compressedDimensions.textContent = "Dimensions: —";
  compressedSize.textContent = "Size: —";

  previewPlaceholder.hidden = false;
  previewPlaceholder.textContent =
    "Adjust the settings to generate your preview.";

  savingsBadge.classList.remove("is-larger");
  savingsBadge.textContent = "—";
  sizeProgress.style.width = "0%";

  resultOriginalSize.textContent = "—";
  resultCompressedSize.textContent = "—";
  resultNote.textContent = "";

  outputStatus.textContent = "Preview";

  compressBtn.disabled = true;
  compressBtn.textContent = "Compress Image";
  downloadBtn.disabled = true;

  clearError();
  updateFormatHelp();
}

// File picker.
chooseImageBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  imageInput.click();
});

dropZone.addEventListener("click", (event) => {
  if (event.target.closest("button")) {
    return;
  }

  imageInput.click();
});

// Keyboard support for the upload area.
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    imageInput.click();
  }
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files && imageInput.files[0];

  if (file) {
    loadImage(file);
  }
});

// Drag and drop.
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove("is-dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];

  if (file) {
    loadImage(file);
  }
});

// Quality slider.
qualitySlider.addEventListener("input", () => {
  qualityValue.textContent = `${qualitySlider.value}%`;

  if (originalFile) {
    clearCompressedResult();
  }
});

// Output format.
outputFormat.addEventListener("change", updateFormatHelp);

// Resize fields invalidate the previous output.
[maxWidthInput, maxHeightInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (originalFile) {
      clearCompressedResult();
    }
  });
});

// Main actions.
compressBtn.addEventListener("click", compressImage);
downloadBtn.addEventListener("click", downloadCompressedImage);
resetBtn.addEventListener("click", resetTool);

// Mobile navigation.
if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");

    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

// Footer year.
document.getElementById("currentYear").textContent =
  new Date().getFullYear();

// Initial state.
updateFormatHelp();