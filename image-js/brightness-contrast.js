(() => {
  "use strict";

  const fileInput = document.getElementById("bcFileInput");
  const dropZone = document.getElementById("bcDropZone");
  const editor = document.getElementById("bcEditor");
  const canvas = document.getElementById("bcCanvas");
  const ctx = canvas.getContext("2d");

  const brightnessInput = document.getElementById("bcBrightness");
  const contrastInput = document.getElementById("bcContrast");
  const brightnessValue = document.getElementById("bcBrightnessValue");
  const contrastValue = document.getElementById("bcContrastValue");

  const formatSelect = document.getElementById("bcFormat");
  const qualityInput = document.getElementById("bcQuality");
  const qualityValue = document.getElementById("bcQualityValue");
  const qualityField = document.getElementById("bcQualityField");

  const resetButton = document.getElementById("bcReset");
  const downloadButton = document.getElementById("bcDownload");
  const status = document.getElementById("bcStatus");
  const imageInfo = document.getElementById("bcImageInfo");

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_PIXELS = 40_000_000;
  const MAX_DIMENSION = 12_000;

  let sourceImage = null;
  let sourceObjectUrl = null;
  let originalFileName = "edited-image";
  let loadVersion = 0;
  let isBusy = false;

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "bc-status";

    if (type) {
      status.classList.add(`bc-${type}`);
    }
  }

  function setBusy(busy) {
    isBusy = busy;
    downloadButton.disabled = busy;
    resetButton.disabled = busy;
    fileInput.disabled = busy;
    dropZone.setAttribute("aria-busy", String(busy));
  }

  function updateQualityControl() {
    const isLossy = formatSelect.value === "image/jpeg" ||
      formatSelect.value === "image/webp";

    qualityField.hidden = !isLossy;
  }

  function getDimensions(image) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height
    };
  }

  function renderPreview() {
    if (!sourceImage || isBusy) return;

    const { width, height } = getDimensions(sourceImage);

    if (!width || !height) return;

    const brightness = Number(brightnessInput.value);
    const contrast = Number(contrastInput.value);

    brightnessValue.value = `${brightness}%`;
    contrastValue.value = `${contrast}%`;

    // Draw at original dimensions to preserve image resolution.
    canvas.width = width;
    canvas.height = height;

    // Clear any previous filter state.
    ctx.filter = "none";
    ctx.clearRect(0, 0, width, height);

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(sourceImage, 0, 0, width, height);
    ctx.filter = "none";
  }

  function resetAdjustments() {
    brightnessInput.value = "100";
    contrastInput.value = "100";

    document.querySelectorAll(".bc-preset").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
    });

    renderPreview();
    setStatus("Adjustments reset to the original brightness and contrast.", "success");
  }

  function selectPreset(button) {
    brightnessInput.value = button.dataset.brightness;
    contrastInput.value = button.dataset.contrast;

    document.querySelectorAll(".bc-preset").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });

    renderPreview();

    setStatus(`${button.textContent.trim()} preset applied.`, "success");
  }

  function releasePreviousImage() {
    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
      sourceObjectUrl = null;
    }

    sourceImage = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  }

  async function loadImage(file) {
    if (isBusy) return;

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Please choose a valid image file.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("This file is larger than 25 MB. Please choose a smaller image.", "error");
      return;
    }

    const version = ++loadVersion;

    setBusy(true);
    setStatus("Loading your image...");

    // Clear the previous image only after a new selection is made.
    releasePreviousImage();

    try {
      const objectUrl = URL.createObjectURL(file);
      sourceObjectUrl = objectUrl;

      const image = new Image();

      image.decoding = "async";

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("The image could not be opened."));
        image.src = objectUrl;
      });

      // Ignore an obsolete load if another file was selected.
      if (version !== loadVersion) {
        URL.revokeObjectURL(objectUrl);
        if (sourceObjectUrl === objectUrl) sourceObjectUrl = null;
        return;
      }

      const { width, height } = getDimensions(image);
      const pixels = width * height;

      if (!width || !height) {
        throw new Error("The image has invalid dimensions.");
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error("The maximum supported image dimension is 12,000 pixels.");
      }

      if (pixels > MAX_PIXELS) {
        throw new Error("This image exceeds the 40-megapixel limit. Please choose a smaller image.");
      }

      sourceImage = image;
      originalFileName = file.name.replace(/\.[^.]+$/, "") || "edited-image";

      editor.hidden = false;
      imageInfo.textContent =
        `${width.toLocaleString()} × ${height.toLocaleString()} pixels · ${formatFileSize(file.size)}`;

      resetAdjustments();
      setStatus("Image loaded successfully. Adjust the sliders to edit it.", "success");

    } catch (error) {
      if (version === loadVersion) {
        releasePreviousImage();
        editor.hidden = true;
        setStatus(error.message || "Something went wrong while loading the image.", "error");
      }
    } finally {
      if (version === loadVersion) {
        setBusy(false);
      }
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function getExtension(mimeType) {
    switch (mimeType) {
      case "image/jpeg":
        return "jpg";
      case "image/webp":
        return "webp";
      default:
        return "png";
    }
  }

  function downloadImage() {
    if (!sourceImage || isBusy) {
      setStatus("Please upload an image before downloading.", "error");
      return;
    }

    const mimeType = formatSelect.value;
    const quality = Number(qualityInput.value) / 100;

    setBusy(true);
    setStatus("Preparing your edited image...");

    // Defer export slightly so the browser can update the UI.
    window.setTimeout(() => {
      try {
        renderPreview();

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;

        const exportCtx = exportCanvas.getContext("2d");

        if (!exportCtx) {
          throw new Error("Your browser could not prepare the export.");
        }

        // JPEG cannot store transparency, so use a white background.
        if (mimeType === "image/jpeg") {
          exportCtx.fillStyle = "#ffffff";
          exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        }

        exportCtx.drawImage(canvas, 0, 0);

        exportCanvas.toBlob((blob) => {
          try {
            if (!blob) {
              setStatus("The image could not be exported. Try a smaller image.", "error");
              return;
            }

            // Browsers may fall back to PNG if a requested encoder is unsupported.
            const actualMimeType = blob.type || "image/png";
            const extension = getExtension(actualMimeType);

            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = downloadUrl;
            link.download = `${originalFileName}-adjusted.${extension}`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

            setStatus(
              `Your edited image has been downloaded as ${extension.toUpperCase()}.`,
              "success"
            );
          } finally {
            exportCanvas.width = 0;
            exportCanvas.height = 0;
            setBusy(false);
          }
        }, mimeType, mimeType === "image/png" ? undefined : quality);

      } catch (error) {
        setStatus(error.message || "Could not export the image. Please try again.", "error");
        setBusy(false);
      }
    }, 30);
  }

  // File selection.
  fileInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];

    if (file) {
      loadImage(file);
    }

    // Allow selecting the same file again.
    fileInput.value = "";
  });

  // Drag and drop.
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();

      if (!isBusy) {
        dropZone.classList.add("bc-dragging");
      }
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove("bc-dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("bc-dragging");

    if (isBusy) return;

    const file = event.dataTransfer.files && event.dataTransfer.files[0];

    if (file) {
      loadImage(file);
    }
  });

  // Live adjustments.
  brightnessInput.addEventListener("input", renderPreview);
  contrastInput.addEventListener("input", renderPreview);

  // Reset and quick presets.
  resetButton.addEventListener("click", resetAdjustments);

  document.querySelectorAll(".bc-preset").forEach((button) => {
    button.addEventListener("click", () => selectPreset(button));
  });

  // Export options.
  formatSelect.addEventListener("change", updateQualityControl);

  qualityInput.addEventListener("input", () => {
    qualityValue.value = `${qualityInput.value}%`;
  });

  downloadButton.addEventListener("click", downloadImage);

  // Current year in the footer.
  document.getElementById("bcYear").textContent = new Date().getFullYear();

  // Initial state.
  updateQualityControl();
  qualityValue.value = `${qualityInput.value}%`;
})();