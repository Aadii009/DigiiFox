"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  const uploadBox = document.getElementById("uploadBox");
  const chooseImageButton = document.getElementById("chooseImageButton");
  const editor = document.getElementById("editor");
  const originalPreview = document.getElementById("originalPreview");
  const upscaledPreview = document.getElementById("upscaledPreview");
  const previewPlaceholder = document.getElementById("previewPlaceholder");

  const originalSize = document.getElementById("originalSize");
  const originalDimensions = document.getElementById("originalDimensions");
  const originalFormat = document.getElementById("originalFormat");
  const upscaledSize = document.getElementById("upscaledSize");
  const upscaledDimensions = document.getElementById("upscaledDimensions");
  const upscaledFormat = document.getElementById("upscaledFormat");

  const scaleSelect = document.getElementById("scaleSelect");
  const formatSelect = document.getElementById("formatSelect");
  const qualitySetting = document.getElementById("qualitySetting");
  const qualitySlider = document.getElementById("qualitySlider");
  const qualityValue = document.getElementById("qualityValue");
  const dimensionNote = document.getElementById("dimensionNote");

  const summaryTitle = document.getElementById("summaryTitle");
  const summaryText = document.getElementById("summaryText");
  const upscaleButton = document.getElementById("upscaleButton");
  const changeImageButton = document.getElementById("changeImageButton");
  const resetButton = document.getElementById("resetButton");
  const downloadButton = document.getElementById("downloadButton");
  const statusMessage = document.getElementById("statusMessage");

  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const currentYear = document.getElementById("currentYear");

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_PIXELS = 40_000_000;
  const MAX_DIMENSION = 12000;
  const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  let selectedFile = null;
  let originalUrl = null;
  let outputUrl = null;
  let originalImage = null;
  let isProcessing = false;
  let conversionNumber = 0;

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  function showStatus(message, type = "error") {
    statusMessage.textContent = message;
    statusMessage.className =
      "iu-status" + (type === "success" ? " success" : "");
  }

  function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "iu-status";
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDimensions(width, height) {
    return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
  }

  function getFormatLabel(mimeType) {
    if (mimeType === "image/jpeg") return "JPG";
    if (mimeType === "image/webp") return "WEBP";
    return "PNG";
  }

  function revokeUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("The image could not be opened. Please try another file."));

      image.src = url;
    });
  }

  function clearOutput() {
    conversionNumber++;

    revokeUrl(outputUrl);
    outputUrl = null;

    upscaledPreview.removeAttribute("src");
    upscaledPreview.hidden = true;
    previewPlaceholder.hidden = false;

    upscaledSize.textContent = "—";
    upscaledDimensions.textContent = "—";
    upscaledFormat.textContent = "—";

    downloadButton.removeAttribute("href");
    downloadButton.hidden = true;

    summaryTitle.textContent = "Ready to upscale";
    summaryText.textContent = "Choose your settings, then click Upscale Image.";
  }

  function resetTool() {
    conversionNumber++;
    selectedFile = null;
    originalImage = null;
    isProcessing = false;

    revokeUrl(originalUrl);
    revokeUrl(outputUrl);

    originalUrl = null;
    outputUrl = null;

    imageInput.value = "";

    originalPreview.removeAttribute("src");
    upscaledPreview.removeAttribute("src");

    originalSize.textContent = "—";
    originalDimensions.textContent = "—";
    originalFormat.textContent = "—";

    upscaledSize.textContent = "—";
    upscaledDimensions.textContent = "—";
    upscaledFormat.textContent = "—";

    upscaledPreview.hidden = true;
    previewPlaceholder.hidden = false;

    editor.hidden = true;
    uploadBox.hidden = false;

    upscaleButton.disabled = false;
    upscaleButton.textContent = "Upscale Image";

    clearStatus();
    updateDimensionNote();
  }

  function updateDimensionNote() {
    if (!originalImage) {
      dimensionNote.textContent =
        "Select an upscale level to calculate the output dimensions.";
      return;
    }

    const scale = Number(scaleSelect.value);
    const width = originalImage.naturalWidth * scale;
    const height = originalImage.naturalHeight * scale;
    const pixels = width * height;

    if (
      width > MAX_DIMENSION ||
      height > MAX_DIMENSION ||
      pixels > MAX_PIXELS
    ) {
      dimensionNote.textContent =
        `Estimated output: ${formatDimensions(width, height)} (${(pixels / 1_000_000).toFixed(1)} megapixels). This exceeds the tool's output limits. Choose a lower scale.`;

      dimensionNote.classList.add("iu-dimension-warning");
      upscaleButton.disabled = true;
      return;
    }

    dimensionNote.textContent =
      `Estimated output: ${formatDimensions(width, height)} · ${(pixels / 1_000_000).toFixed(1)} megapixels.`;

    dimensionNote.classList.remove("iu-dimension-warning");
    upscaleButton.disabled = false;
  }

  function updateFormatSettings() {
    const format = formatSelect.value;
    const supportsQuality = format === "image/jpeg" || format === "image/webp";

    qualitySetting.hidden = !supportsQuality;

    if (format === "image/png") {
      qualityValue.textContent = "Not applicable";
    } else {
      qualityValue.textContent = `${qualitySlider.value}%`;
    }

    clearOutput();
    updateDimensionNote();
  }

  async function handleFile(file) {
    if (!file) return;

    if (isProcessing) {
      showStatus("Please wait for the current upscaling operation to finish.");
      return;
    }

    clearStatus();

    if (file.size > MAX_FILE_SIZE) {
      showStatus("The file is larger than 25 MB. Please choose a smaller image.");
      return;
    }

    const validType =
      SUPPORTED_TYPES.includes(file.type) ||
      /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!validType) {
      showStatus("Please select a JPG, PNG, or WebP image.");
      return;
    }

    const temporaryUrl = URL.createObjectURL(file);

    try {
      const image = await loadImage(temporaryUrl);
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (!width || !height) {
        throw new Error("This image has invalid dimensions.");
      }

      if (
        width > MAX_DIMENSION ||
        height > MAX_DIMENSION ||
        width * height > MAX_PIXELS
      ) {
        throw new Error(
          "The original image exceeds the supported dimensions. Maximum: 12,000 pixels per side and 40 megapixels."
        );
      }

      resetTool();

      selectedFile = file;
      originalImage = image;
      originalUrl = temporaryUrl;

      originalPreview.src = originalUrl;
      originalSize.textContent = formatBytes(file.size);
      originalDimensions.textContent = formatDimensions(width, height);
      originalFormat.textContent =
        getFormatLabel(file.type || inferTypeFromName(file.name));

      editor.hidden = false;
      uploadBox.hidden = true;

      updateDimensionNote();

      showStatus("Image loaded successfully. Choose your upscale settings.", "success");
    } catch (error) {
      revokeUrl(temporaryUrl);
      showStatus(error.message || "Unable to load this image.");
    }
  }

  function inferTypeFromName(filename) {
    const name = filename.toLowerCase();

    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".webp")) return "image/webp";
    return "image/png";
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error("Image processing failed. Your browser may not have enough memory.")
            );
            return;
          }

          resolve(blob);
        },
        mimeType,
        quality
      );
    });
  }

  async function upscaleImage() {
    if (!selectedFile || !originalImage || isProcessing) return;

    const scale = Number(scaleSelect.value);
    const outputWidth = originalImage.naturalWidth * scale;
    const outputHeight = originalImage.naturalHeight * scale;
    const outputPixels = outputWidth * outputHeight;

    if (
      outputWidth > MAX_DIMENSION ||
      outputHeight > MAX_DIMENSION ||
      outputPixels > MAX_PIXELS
    ) {
      showStatus(
        "This upscale setting exceeds the output limits. Choose a lower scale."
      );
      return;
    }

    isProcessing = true;
    const thisConversion = ++conversionNumber;

    upscaleButton.disabled = true;
    upscaleButton.textContent = "Upscaling...";
    clearStatus();

    let canvas = null;

    try {
      canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Your browser could not start the image processor.");
      }

      // Higher-quality interpolation for ordinary canvas resizing.
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const selectedFormat = formatSelect.value;

      // JPEG cannot preserve transparency. Fill with white before drawing.
      if (selectedFormat === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, outputWidth, outputHeight);
      }

      context.drawImage(originalImage, 0, 0, outputWidth, outputHeight);

      const quality = Number(qualitySlider.value) / 100;
      const blob = await canvasToBlob(
        canvas,
        selectedFormat,
        quality
      );

      if (thisConversion !== conversionNumber) return;

      const actualFormat = blob.type || selectedFormat;

      revokeUrl(outputUrl);
      outputUrl = URL.createObjectURL(blob);

      upscaledPreview.onload = () => {
        if (thisConversion !== conversionNumber) return;
        previewPlaceholder.hidden = true;
        upscaledPreview.hidden = false;
      };

      upscaledPreview.src = outputUrl;

      upscaledSize.textContent = formatBytes(blob.size);
      upscaledDimensions.textContent =
        formatDimensions(outputWidth, outputHeight);
      upscaledFormat.textContent = getFormatLabel(actualFormat);

      const extension =
        actualFormat === "image/jpeg"
          ? "jpg"
          : actualFormat === "image/webp"
            ? "webp"
            : "png";

      downloadButton.href = outputUrl;
      downloadButton.download = `digifox-upscaled-${scale}x.${extension}`;
      downloadButton.hidden = false;

      summaryTitle.textContent = `${scale}× upscaling complete`;

      summaryText.textContent =
        `Dimensions increased from ${formatDimensions(originalImage.naturalWidth, originalImage.naturalHeight)} to ${formatDimensions(outputWidth, outputHeight)}. The output file is ${formatBytes(blob.size)}. This is standard image resizing, not AI detail reconstruction.`;

      showStatus("Your upscaled image is ready to download.", "success");
    } catch (error) {
      showStatus(error.message || "Something went wrong while upscaling.");
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }

      isProcessing = false;

      if (thisConversion === conversionNumber) {
        upscaleButton.textContent = "Upscale Image";
        updateDimensionNote();
      }
    }
  }

  chooseImageButton.addEventListener("click", (event) => {
    event.stopPropagation();
    imageInput.click();
  });

  uploadBox.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    imageInput.click();
  });

  uploadBox.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      imageInput.click();
    }
  });

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) handleFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadBox.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadBox.classList.remove("dragover");
    });
  });

  uploadBox.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  scaleSelect.addEventListener("change", () => {
    clearOutput();
    updateDimensionNote();
  });

  formatSelect.addEventListener("change", updateFormatSettings);

  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
    clearOutput();
  });

  upscaleButton.addEventListener("click", upscaleImage);

  changeImageButton.addEventListener("click", () => {
    if (!isProcessing) {
      imageInput.value = "";
      imageInput.click();
    }
  });

  resetButton.addEventListener("click", resetTool);

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  window.addEventListener("beforeunload", () => {
    revokeUrl(originalUrl);
    revokeUrl(outputUrl);
  });

  updateFormatSettings();
});