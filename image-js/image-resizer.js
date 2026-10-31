"use strict";

// DigiiFox Image Resizer
// Image processing is performed locally in the browser.

const imageInput = document.getElementById("imageInput");
const dropZone = document.getElementById("dropZone");
const chooseImageBtn = document.getElementById("chooseImageBtn");

const resizeMode = document.getElementById("resizeMode");
const dimensionControls = document.getElementById("dimensionControls");
const percentageControls = document.getElementById("percentageControls");

const imageWidth = document.getElementById("imageWidth");
const imageHeight = document.getElementById("imageHeight");
const lockRatio = document.getElementById("lockRatio");
const ratioHelp = document.getElementById("ratioHelp");

const scaleSlider = document.getElementById("scaleSlider");
const scaleValue = document.getElementById("scaleValue");
const scaleNumber = document.getElementById("scaleNumber");

const outputFormat = document.getElementById("outputFormat");
const formatHelp = document.getElementById("formatHelp");
const qualitySlider = document.getElementById("qualitySlider");
const qualityValue = document.getElementById("qualityValue");

const resizeBtn = document.getElementById("resizeBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadBtn = document.getElementById("downloadBtn");
const errorMessage = document.getElementById("errorMessage");

const previewGrid = document.getElementById("previewGrid");
const originalPreview = document.getElementById("originalPreview");
const resizedPreview = document.getElementById("resizedPreview");
const previewPlaceholder = document.getElementById("previewPlaceholder");

const originalDimensions = document.getElementById("originalDimensions");
const originalSize = document.getElementById("originalSize");
const resizedDimensions = document.getElementById("resizedDimensions");
const resizedSize = document.getElementById("resizedSize");

const resultsCard = document.getElementById("resultsCard");
const dimensionBadge = document.getElementById("dimensionBadge");
const resultOriginalDimensions = document.getElementById("resultOriginalDimensions");
const resultResizedDimensions = document.getElementById("resultResizedDimensions");
const resultOriginalSize = document.getElementById("resultOriginalSize");
const resultResizedSize = document.getElementById("resultResizedSize");
const resultNote = document.getElementById("resultNote");

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_DIMENSION = 12000;
const MIN_PERCENTAGE = 10;
const MAX_PERCENTAGE = 200;

let originalFile = null;
let originalImage = null;
let originalObjectUrl = null;

let resizedObjectUrl = null;
let resizedBlob = null;
let resizedFileName = "resized-image.webp";

let isProcessing = false;
let operationNumber = 0;

// --------------------------------------------------
// General helpers
// --------------------------------------------------

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

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function getExtension(mimeType) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  return extensions[mimeType] || "img";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}

function revokeResizedUrl() {
  if (resizedObjectUrl) {
    URL.revokeObjectURL(resizedObjectUrl);
    resizedObjectUrl = null;
  }
}

// --------------------------------------------------
// Result and preview management
// --------------------------------------------------

function clearResizedResult() {
  operationNumber++;

  revokeResizedUrl();

  resizedBlob = null;
  resizedFileName = "resized-image.webp";

  resizedPreview.removeAttribute("src");
  resizedPreview.classList.remove("is-visible");
  resizedPreview.style.display = "none";

  previewPlaceholder.hidden = false;
  previewPlaceholder.textContent =
    "Your resized image will appear here.";

  resizedDimensions.textContent = "Dimensions: —";
  resizedSize.textContent = "Size: —";

  resultsCard.hidden = true;
  dimensionBadge.textContent = "—";

  resultOriginalDimensions.textContent = "—";
  resultResizedDimensions.textContent = "—";
  resultOriginalSize.textContent = "—";
  resultResizedSize.textContent = "—";
  resultNote.textContent = "";

  downloadBtn.disabled = true;
}

// --------------------------------------------------
// Image upload and validation
// --------------------------------------------------

function loadImage(file) {
  if (!file) {
    return;
  }

  clearError();

  const supportedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!supportedTypes.includes(file.type)) {
    showError("Please upload a JPG, PNG, or WebP image.");
    return;
  }

  if (file.size === 0) {
    showError("The selected file is empty. Please choose another image.");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showError("The image exceeds the 25 MB file-size limit.");
    return;
  }

  const newObjectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = function () {
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      URL.revokeObjectURL(newObjectUrl);
      showError("The image dimensions could not be read.");
      return;
    }

    if (width * height > MAX_PIXELS) {
      URL.revokeObjectURL(newObjectUrl);
      showError(
        "This image exceeds the 40-megapixel limit. Please select a smaller image."
      );
      return;
    }

    // Replace the current image only after successful validation.
    if (originalObjectUrl) {
      URL.revokeObjectURL(originalObjectUrl);
    }

    originalFile = file;
    originalImage = image;
    originalObjectUrl = newObjectUrl;

    clearResizedResult();

    originalPreview.src = originalObjectUrl;
    originalPreview.classList.add("is-visible");
    originalPreview.style.display = "block";

    previewGrid.hidden = false;

    originalDimensions.textContent =
      `Dimensions: ${width} × ${height} px`;

    originalSize.textContent =
      `Size: ${formatBytes(file.size)}`;

    // Set the default exact dimensions to the source image.
    imageWidth.value = width;
    imageHeight.value = height;

    resizeBtn.disabled = false;

    updateRatioHelp();
    clearError();

    // Allow the same image to be selected again later.
    imageInput.value = "";
  };

  image.onerror = function () {
    URL.revokeObjectURL(newObjectUrl);
    showError("Unable to open this image. Please choose another file.");
  };

  image.src = newObjectUrl;
}

// --------------------------------------------------
// Dimension and aspect-ratio calculations
// --------------------------------------------------

function readDimension(value, label) {
  const number = Number(value);

  if (
    value === "" ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > MAX_DIMENSION
  ) {
    throw new Error(
      `${label} must be a whole number between 1 and ${MAX_DIMENSION}.`
    );
  }

  return number;
}

function getOriginalRatio() {
  if (!originalImage) {
    return 1;
  }

  return originalImage.naturalWidth / originalImage.naturalHeight;
}

function updateRatioHelp() {
  if (!originalImage) {
    ratioHelp.textContent =
      "Upload an image to calculate its original aspect ratio.";
    return;
  }

  if (lockRatio.checked) {
    ratioHelp.textContent =
      "Aspect ratio is locked. Changing one dimension automatically updates the other.";
  } else {
    ratioHelp.textContent =
      "Aspect ratio is unlocked. You can change width and height independently; the image may stretch.";
  }
}

// Update height when width changes.
imageWidth.addEventListener("input", () => {
  if (originalImage && lockRatio.checked && imageWidth.value !== "") {
    const width = Number(imageWidth.value);

    if (Number.isFinite(width) && width > 0) {
      imageHeight.value = Math.max(
        1,
        Math.round(width / getOriginalRatio())
      );
    }
  }

  clearResizedResult();
  clearError();
});

// Update width when height changes.
imageHeight.addEventListener("input", () => {
  if (originalImage && lockRatio.checked && imageHeight.value !== "") {
    const height = Number(imageHeight.value);

    if (Number.isFinite(height) && height > 0) {
      imageWidth.value = Math.max(
        1,
        Math.round(height * getOriginalRatio())
      );
    }
  }

  clearResizedResult();
  clearError();
});

lockRatio.addEventListener("change", () => {
  updateRatioHelp();

  // When the user enables the lock, preserve the current width
  // and recalculate height to match the original ratio.
  if (
    lockRatio.checked &&
    originalImage &&
    imageWidth.value !== ""
  ) {
    const width = Number(imageWidth.value);

    if (Number.isFinite(width) && width > 0) {
      imageHeight.value = Math.max(
        1,
        Math.round(width / getOriginalRatio())
      );
    }
  }

  clearResizedResult();
});

// --------------------------------------------------
// Resize mode: dimensions or percentage
// --------------------------------------------------

function updateResizeMode() {
  const percentageMode = resizeMode.value === "percentage";

  dimensionControls.hidden = percentageMode;
  percentageControls.hidden = !percentageMode;

  clearResizedResult();
  clearError();
}

resizeMode.addEventListener("change", updateResizeMode);

function normalizePercentage(value) {
  const percentage = Number(value);

  if (
    !Number.isFinite(percentage) ||
    percentage < MIN_PERCENTAGE ||
    percentage > MAX_PERCENTAGE
  ) {
    throw new Error(
      `Percentage must be between ${MIN_PERCENTAGE}% and ${MAX_PERCENTAGE}%.`
    );
  }

  return percentage;
}

function updatePercentageControls(value) {
  const percentage = Number(value);

  scaleSlider.value = percentage;
  scaleNumber.value = percentage;
  scaleValue.textContent = `${percentage}%`;

  clearResizedResult();
  clearError();
}

scaleSlider.addEventListener("input", () => {
  updatePercentageControls(scaleSlider.value);
});

scaleNumber.addEventListener("input", () => {
  if (scaleNumber.value === "") {
    clearResizedResult();
    return;
  }

  const percentage = Number(scaleNumber.value);

  if (
    Number.isFinite(percentage) &&
    percentage >= MIN_PERCENTAGE &&
    percentage <= MAX_PERCENTAGE
  ) {
    scaleSlider.value = percentage;
    scaleValue.textContent = `${percentage}%`;
  }

  clearResizedResult();
});

// --------------------------------------------------
// Output format and quality
// --------------------------------------------------

function updateFormatHelp() {
  const format = outputFormat.value;

  if (format === "image/webp") {
    formatHelp.textContent =
      "WebP often offers a good balance between image quality and file size.";
  } else if (format === "image/jpeg") {
    formatHelp.textContent =
      "JPEG works well for photographs. Transparent areas become white.";
  } else {
    formatHelp.textContent =
      "PNG supports transparency. The quality slider does not control PNG compression.";
  }

  if (originalImage) {
    clearResizedResult();
  }
}

outputFormat.addEventListener("change", updateFormatHelp);

qualitySlider.addEventListener("input", () => {
  qualityValue.textContent = `${qualitySlider.value}%`;

  if (originalImage) {
    clearResizedResult();
  }
});

// --------------------------------------------------
// Calculate final dimensions
// --------------------------------------------------

function calculateTargetDimensions() {
  if (!originalImage) {
    throw new Error("Please upload an image first.");
  }

  const originalWidth = originalImage.naturalWidth;
  const originalHeight = originalImage.naturalHeight;

  let width;
  let height;

  if (resizeMode.value === "percentage") {
    const percentage = normalizePercentage(scaleNumber.value);
    const scale = percentage / 100;

    width = Math.max(1, Math.round(originalWidth * scale));
    height = Math.max(1, Math.round(originalHeight * scale));
  } else {
    width = readDimension(imageWidth.value, "Width");
    height = readDimension(imageHeight.value, "Height");
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(
      `The output dimensions cannot exceed ${MAX_DIMENSION} pixels on either side.`
    );
  }

  if (width * height > MAX_PIXELS) {
    throw new Error(
      "The output would exceed 40 megapixels. Please choose smaller dimensions."
    );
  }

  return { width, height };
}

// --------------------------------------------------
// Resize image
// --------------------------------------------------

async function resizeImage() {
  if (!originalFile || !originalImage || isProcessing) {
    return;
  }

  clearError();

  let target;

  try {
    target = calculateTargetDimensions();
  } catch (error) {
    showError(error.message);
    return;
  }

  const currentOperation = ++operationNumber;

  isProcessing = true;
  resizeBtn.disabled = true;
  resizeBtn.textContent = "Resizing...";

  try {
    const canvas = document.createElement("canvas");

    canvas.width = target.width;
    canvas.height = target.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Your browser could not start the image processor.");
    }

    // Choose a high-quality resampling method.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const selectedFormat = outputFormat.value;
    const quality = Number(qualitySlider.value) / 100;

    // JPEG cannot contain transparency.
    if (selectedFormat === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, target.width, target.height);
    }

    context.drawImage(
      originalImage,
      0,
      0,
      target.width,
      target.height
    );

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(
              new Error("The browser could not create the resized image.")
            );
          }
        },
        selectedFormat,
        quality
      );
    });

    if (currentOperation !== operationNumber) {
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(blob.type)
    ) {
      throw new Error(
        "Your browser could not export this format. Please try another output format."
      );
    }

    resizedBlob = blob;
    resizedObjectUrl = URL.createObjectURL(blob);

    const baseName = originalFile.name.replace(/\.[^.]+$/, "");
    const extension = getExtension(blob.type);

    resizedFileName = `${baseName}-resized.${extension}`;

    resizedPreview.src = resizedObjectUrl;
    resizedPreview.classList.add("is-visible");
    resizedPreview.style.display = "block";

    previewPlaceholder.hidden = true;

    resizedDimensions.textContent =
      `Dimensions: ${target.width} × ${target.height} px`;

    resizedSize.textContent = `Size: ${formatBytes(blob.size)}`;

    updateResults(
      originalImage.naturalWidth,
      originalImage.naturalHeight,
      target.width,
      target.height,
      originalFile.size,
      blob.size
    );

    resultsCard.hidden = false;
    downloadBtn.disabled = false;

    clearError();

    // Release the temporary pixel buffer.
    canvas.width = 1;
    canvas.height = 1;
  } catch (error) {
    if (currentOperation === operationNumber) {
      showError(
        error.message || "Something went wrong while resizing the image."
      );
    }
  } finally {
    if (currentOperation === operationNumber) {
      isProcessing = false;
      resizeBtn.disabled = !originalFile;
      resizeBtn.textContent = "Resize Image";
    }
  }
}

// --------------------------------------------------
// Show output results
// --------------------------------------------------

function updateResults(
  originalWidth,
  originalHeight,
  newWidth,
  newHeight,
  originalBytes,
  newBytes
) {
  resultOriginalDimensions.textContent =
    `${originalWidth} × ${originalHeight} px`;

  resultResizedDimensions.textContent =
    `${newWidth} × ${newHeight} px`;

  resultOriginalSize.textContent = formatBytes(originalBytes);
  resultResizedSize.textContent = formatBytes(newBytes);

  const widthChanged = originalWidth !== newWidth;
  const heightChanged = originalHeight !== newHeight;

  if (!widthChanged && !heightChanged) {
    dimensionBadge.textContent = "Same dimensions";
    resultNote.textContent =
      "The output dimensions match the original. Changing the output format may still change the file size.";
  } else if (newWidth <= originalWidth && newHeight <= originalHeight) {
    dimensionBadge.textContent = "Image reduced";
    resultNote.textContent =
      "The image dimensions have been reduced. The final file size depends on the selected output format and quality.";
  } else {
    dimensionBadge.textContent = "Image enlarged";
    resultNote.textContent =
      "The image has been enlarged. Enlarging cannot restore detail that was not present in the original image.";
  }

  if (outputFormat.value === "image/png") {
    resultNote.textContent +=
      " PNG output preserves transparency, but its file size may be larger than the original.";
  }
}

// --------------------------------------------------
// Download result
// --------------------------------------------------

function downloadResizedImage() {
  if (!resizedBlob || !resizedObjectUrl) {
    showError("Please resize an image before downloading.");
    return;
  }

  const link = document.createElement("a");

  link.href = resizedObjectUrl;
  link.download = resizedFileName;

  document.body.appendChild(link);
  link.click();
  link.remove();
}

// --------------------------------------------------
// Reset the tool
// --------------------------------------------------

function resetTool() {
  operationNumber++;
  isProcessing = false;

  if (originalObjectUrl) {
    URL.revokeObjectURL(originalObjectUrl);
    originalObjectUrl = null;
  }

  revokeResizedUrl();

  originalFile = null;
  originalImage = null;
  resizedBlob = null;

  imageInput.value = "";

  resizeMode.value = "dimensions";

  imageWidth.value = "";
  imageHeight.value = "";
  lockRatio.checked = true;

  scaleSlider.value = "50";
  scaleNumber.value = "50";
  scaleValue.textContent = "50%";

  outputFormat.value = "image/webp";
  qualitySlider.value = "92";
  qualityValue.textContent = "92%";

  originalPreview.removeAttribute("src");
  originalPreview.classList.remove("is-visible");
  originalPreview.style.display = "none";

  resizedPreview.removeAttribute("src");
  resizedPreview.classList.remove("is-visible");
  resizedPreview.style.display = "none";

  previewGrid.hidden = true;
  resultsCard.hidden = true;

  originalDimensions.textContent = "Dimensions: —";
  originalSize.textContent = "Size: —";
  resizedDimensions.textContent = "Dimensions: —";
  resizedSize.textContent = "Size: —";

  previewPlaceholder.hidden = false;
  previewPlaceholder.textContent =
    "Your resized image will appear here.";

  dimensionBadge.textContent = "—";

  resultOriginalDimensions.textContent = "—";
  resultResizedDimensions.textContent = "—";
  resultOriginalSize.textContent = "—";
  resultResizedSize.textContent = "—";
  resultNote.textContent = "";

  resizeBtn.disabled = true;
  resizeBtn.textContent = "Resize Image";
  downloadBtn.disabled = true;

  updateResizeMode();
  updateRatioHelp();
  updateFormatHelp();

  clearError();
}

// --------------------------------------------------
// Upload controls
// --------------------------------------------------

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

// Drag and drop support.
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

// Main action buttons.
resizeBtn.addEventListener("click", resizeImage);
downloadBtn.addEventListener("click", downloadResizedImage);
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
updateResizeMode();
updateRatioHelp();
updateFormatHelp();