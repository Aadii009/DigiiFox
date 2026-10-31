"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  const uploadBox = document.getElementById("uploadBox");
  const chooseImageButton = document.getElementById("chooseImageButton");
  const editor = document.getElementById("editor");

  const originalPreview = document.getElementById("originalPreview");
  const convertedPreview = document.getElementById("convertedPreview");
  const previewPlaceholder = document.getElementById("previewPlaceholder");

  const originalSize = document.getElementById("originalSize");
  const originalDimensions = document.getElementById("originalDimensions");
  const originalFormat = document.getElementById("originalFormat");

  const convertedSize = document.getElementById("convertedSize");
  const convertedDimensions = document.getElementById("convertedDimensions");
  const convertedFormat = document.getElementById("convertedFormat");

  const formatSelect = document.getElementById("formatSelect");
  const formatDescription = document.getElementById("formatDescription");
  const qualitySetting = document.getElementById("qualitySetting");
  const qualitySlider = document.getElementById("qualitySlider");
  const qualityValue = document.getElementById("qualityValue");
  const transparencyNote = document.getElementById("transparencyNote");

  const summaryTitle = document.getElementById("summaryTitle");
  const summaryText = document.getElementById("summaryText");

  const convertButton = document.getElementById("convertButton");
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

  const SUPPORTED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  let selectedFile = null;
  let originalUrl = null;
  let convertedUrl = null;
  let originalImage = null;
  let isConverting = false;
  let operationId = 0;

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  function showStatus(message, type = "error") {
    statusMessage.textContent = message;
    statusMessage.className =
      "ifc-status" + (type === "success" ? " success" : "");
  }

  function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.className = "ifc-status";
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDimensions(width, height) {
    return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
  }

  function getExtension(mimeType) {
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/webp") return "webp";
    return "png";
  }

  function getFormatLabel(mimeType) {
    if (mimeType === "image/jpeg") return "JPG";
    if (mimeType === "image/webp") return "WEBP";
    if (mimeType === "image/png") return "PNG";
    return "Unknown";
  }

  function inferTypeFromName(filename) {
    const name = filename.toLowerCase();

    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
      return "image/jpeg";
    }

    if (name.endsWith(".webp")) {
      return "image/webp";
    }

    if (name.endsWith(".png")) {
      return "image/png";
    }

    return "";
  }

  function revokeUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => {
        reject(
          new Error("The image could not be opened. Please choose a valid JPG, PNG, or WebP image.")
        );
      };

      image.src = url;
    });
  }

  function clearConvertedImage() {
    operationId++;

    revokeUrl(convertedUrl);
    convertedUrl = null;

    convertedPreview.removeAttribute("src");
    convertedPreview.hidden = true;
    previewPlaceholder.hidden = false;

    convertedSize.textContent = "—";
    convertedDimensions.textContent = "—";
    convertedFormat.textContent = "—";

    downloadButton.removeAttribute("href");
    downloadButton.hidden = true;

    summaryTitle.textContent = "Ready to convert";
    summaryText.textContent =
      "Choose an output format and click Convert Image.";
  }

  function resetTool() {
    operationId++;

    selectedFile = null;
    originalImage = null;
    isConverting = false;

    revokeUrl(originalUrl);
    revokeUrl(convertedUrl);

    originalUrl = null;
    convertedUrl = null;

    imageInput.value = "";

    originalPreview.removeAttribute("src");
    convertedPreview.removeAttribute("src");

    originalSize.textContent = "—";
    originalDimensions.textContent = "—";
    originalFormat.textContent = "—";

    convertedSize.textContent = "—";
    convertedDimensions.textContent = "—";
    convertedFormat.textContent = "—";

    convertedPreview.hidden = true;
    previewPlaceholder.hidden = false;

    editor.hidden = true;
    uploadBox.hidden = false;

    convertButton.disabled = false;
    convertButton.textContent = "Convert Image";

    clearStatus();
    updateFormatSettings();
  }

  function updateFormatSettings() {
    const format = formatSelect.value;
    const supportsQuality =
      format === "image/jpeg" || format === "image/webp";

    qualitySetting.hidden = !supportsQuality;

    qualityValue.textContent = supportsQuality
      ? `${qualitySlider.value}%`
      : "Not applicable";

    if (format === "image/jpeg") {
      formatDescription.textContent =
        "JPG is widely supported and suitable for photographs.";

      transparencyNote.hidden = false;
      transparencyNote.textContent =
        "JPG does not support transparency. Transparent areas will be filled with white.";
    } else if (format === "image/png") {
      formatDescription.textContent =
        "PNG supports transparency and is suitable for graphics.";

      transparencyNote.hidden = false;
      transparencyNote.textContent =
        "PNG supports transparency. Transparent areas will be preserved where supported by the browser.";
    } else {
      formatDescription.textContent =
        "WebP supports transparency and efficient image compression.";

      transparencyNote.hidden = false;
      transparencyNote.textContent =
        "WebP supports transparency. Transparent areas will be preserved where supported by the browser.";
    }

    if (selectedFile) {
      clearConvertedImage();
    }
  }

  async function handleFile(file) {
    if (!file) return;

    if (isConverting) {
      showStatus("Please wait for the current conversion to finish.");
      return;
    }

    clearStatus();

    if (file.size > MAX_FILE_SIZE) {
      showStatus("The file is larger than 25 MB. Please choose a smaller image.");
      return;
    }

    const inferredType = inferTypeFromName(file.name);
    const inputType = SUPPORTED_TYPES.includes(file.type)
      ? file.type
      : inferredType;

    if (!SUPPORTED_TYPES.includes(inputType)) {
      showStatus("Please select a JPG, PNG, or WebP image.");
      return;
    }

    const temporaryUrl = URL.createObjectURL(file);

    try {
      const image = await loadImage(temporaryUrl);
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (!width || !height) {
        throw new Error("The image has invalid dimensions.");
      }

      if (
        width > MAX_DIMENSION ||
        height > MAX_DIMENSION ||
        width * height > MAX_PIXELS
      ) {
        throw new Error(
          "This image is too large to process safely. Maximum: 12,000 pixels per side and 40 megapixels."
        );
      }

      resetTool();

      selectedFile = file;
      originalImage = image;
      originalUrl = temporaryUrl;

      originalPreview.src = originalUrl;
      originalSize.textContent = formatBytes(file.size);
      originalDimensions.textContent = formatDimensions(width, height);
      originalFormat.textContent = getFormatLabel(inputType);

      editor.hidden = false;
      uploadBox.hidden = true;

      showStatus(
        "Image loaded successfully. Choose your output format.",
        "success"
      );
    } catch (error) {
      revokeUrl(temporaryUrl);
      showStatus(error.message || "Unable to load this image.");
    }
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error("Conversion failed. Your browser may not have enough memory.")
            );
            return;
          }

          // Some browsers may fall back to PNG if a requested format
          // is not supported. Do not label a fallback file incorrectly.
          if (blob.type !== mimeType) {
            reject(
              new Error(
                `Your browser could not create ${getFormatLabel(mimeType)} output. Try PNG or another supported format.`
              )
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

  async function convertImage() {
    if (!selectedFile || !originalImage || isConverting) return;

    isConverting = true;
    const thisOperation = ++operationId;

    convertButton.disabled = true;
    convertButton.textContent = "Converting...";
    clearStatus();

    let canvas = null;

    try {
      const outputType = formatSelect.value;
      const quality = Number(qualitySlider.value) / 100;

      canvas = document.createElement("canvas");
      canvas.width = originalImage.naturalWidth;
      canvas.height = originalImage.naturalHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Your browser could not start the image converter.");
      }

      context.clearRect(0, 0, canvas.width, canvas.height);

      // JPG does not support transparency. Fill the canvas white first.
      if (outputType === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.drawImage(originalImage, 0, 0);

      const blob = await canvasToBlob(
        canvas,
        outputType,
        quality
      );

      if (thisOperation !== operationId) return;

      revokeUrl(convertedUrl);
      convertedUrl = URL.createObjectURL(blob);

      convertedPreview.onload = () => {
        if (thisOperation !== operationId) return;

        previewPlaceholder.hidden = true;
        convertedPreview.hidden = false;
      };

      convertedPreview.src = convertedUrl;

      convertedSize.textContent = formatBytes(blob.size);
      convertedDimensions.textContent = formatDimensions(
        originalImage.naturalWidth,
        originalImage.naturalHeight
      );
      convertedFormat.textContent = getFormatLabel(blob.type);

      const extension = getExtension(blob.type);
      const originalBaseName = selectedFile.name.replace(/\.[^.]+$/, "");

      downloadButton.href = convertedUrl;
      downloadButton.download =
        `${originalBaseName || "digifox-converted"}.${extension}`;
      downloadButton.hidden = false;

      const difference = blob.size - selectedFile.size;

      summaryTitle.textContent = "Conversion complete!";

      if (difference < 0) {
        summaryText.textContent =
          `The converted file is ${formatBytes(Math.abs(difference))} smaller than the original. Results depend on the image and selected format.`;
      } else if (difference > 0) {
        summaryText.textContent =
          `The converted file is ${formatBytes(difference)} larger than the original. This is normal for some formats, especially PNG.`;
      } else {
        summaryText.textContent =
          "The original and converted files have the same file size.";
      }

      showStatus("Your converted image is ready to download.", "success");
    } catch (error) {
      if (thisOperation === operationId) {
        showStatus(error.message || "Something went wrong during conversion.");
      }
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }

      isConverting = false;
      convertButton.disabled = false;
      convertButton.textContent = "Convert Image";
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

  formatSelect.addEventListener("change", updateFormatSettings);

  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = `${qualitySlider.value}%`;

    if (selectedFile) {
      clearConvertedImage();
    }
  });

  convertButton.addEventListener("click", convertImage);

  changeImageButton.addEventListener("click", () => {
    if (isConverting) return;

    imageInput.value = "";
    imageInput.click();
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
    revokeUrl(convertedUrl);
  });

  updateFormatSettings();
});