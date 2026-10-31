"use strict";

(() => {
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_INPUT_PIXELS = 40_000_000;
  const MAX_DIMENSION = 12_000;
  const MAX_OUTPUT_PIXELS = 40_000_000;
  const MAX_PREVIEW_DIMENSION = 1200;
  const MAX_PREVIEW_PIXELS = 1_500_000;

  const $ = (id) => document.getElementById(id);

  const imageInput = $("imageInput");
  const uploadBox = $("uploadBox");
  const editor = $("editor");
  const chooseImageButton = $("chooseImageButton");
  const changeImageButton = $("changeImageButton");
  const imagePreview = $("imagePreview");
  const originalDimensions = $("originalDimensions");
  const originalSize = $("originalSize");
  const angleBadge = $("angleBadge");

  const rotateLeftButton = $("rotateLeftButton");
  const rotateRightButton = $("rotateRightButton");
  const flipHorizontalButton = $("flipHorizontalButton");
  const flipVerticalButton = $("flipVerticalButton");
  const resetEditsButton = $("resetEditsButton");

  const outputFormat = $("outputFormat");
  const qualityGroup = $("qualityGroup");
  const qualitySlider = $("qualitySlider");
  const qualityValue = $("qualityValue");
  const saveImageButton = $("saveImageButton");
  const statusMessage = $("statusMessage");

  const resultPanel = $("resultPanel");
  const resultPreview = $("resultPreview");
  const resultDimensions = $("resultDimensions");
  const resultSize = $("resultSize");
  const resultFormat = $("resultFormat");
  const resultSummary = $("resultSummary");
  const downloadButton = $("downloadButton");
  const startOverButton = $("startOverButton");

  const menuToggle = $("menuToggle");
  const mainNav = $("mainNav");

  let currentFile = null;
  let sourceImage = null;
  let originalObjectUrl = null;
  let previewObjectUrl = null;
  let resultObjectUrl = null;

  let originalWidth = 0;
  let originalHeight = 0;
  let rotation = 0;
  let flipHorizontal = false;
  let flipVertical = false;

  let operationNumber = 0;
  let isLoading = false;
  let isSaving = false;

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDimensions(width, height) {
    return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
  }

  function formatType(type) {
    const formats = {
      "image/jpeg": "JPG",
      "image/png": "PNG",
      "image/webp": "WebP"
    };

    return formats[type] || "Image";
  }

  function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "rot-status";

    if (type) {
      statusMessage.classList.add(`rot-${type}`);
    }
  }

  function revokeUrl(property) {
    if (property === "originalObjectUrl" && originalObjectUrl) {
      URL.revokeObjectURL(originalObjectUrl);
      originalObjectUrl = null;
    }

    if (property === "previewObjectUrl" && previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }

    if (property === "resultObjectUrl" && resultObjectUrl) {
      URL.revokeObjectURL(resultObjectUrl);
      resultObjectUrl = null;
    }
  }

  function clearResult() {
    revokeUrl("resultObjectUrl");
    resultPanel.hidden = true;
    resultPreview.removeAttribute("src");
    downloadButton.removeAttribute("href");
  }

  function getOutputDimensions() {
    const quarterTurn = rotation === 90 || rotation === 270;

    return quarterTurn
      ? { width: originalHeight, height: originalWidth }
      : { width: originalWidth, height: originalHeight };
  }

  function resetTransform() {
    rotation = 0;
    flipHorizontal = false;
    flipVertical = false;
    updateAngleBadge();
    clearResult();
    renderPreview();
  }

  function updateAngleBadge() {
    angleBadge.textContent = `${rotation}°`;

    document.querySelectorAll(".rot-quick-angles button").forEach((button) => {
      const active = Number(button.dataset.angle) === rotation;
      button.classList.toggle("rot-angle-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateQualityVisibility() {
    qualityGroup.hidden = outputFormat.value === "image/png";
  }

  function createOutputCanvas(width, height, isPreview = false) {
    let canvasWidth = width;
    let canvasHeight = height;
    let drawScale = 1;

    if (isPreview) {
      drawScale = Math.min(
        1,
        MAX_PREVIEW_DIMENSION / Math.max(width, height),
        Math.sqrt(MAX_PREVIEW_PIXELS / (width * height))
      );

      canvasWidth = Math.max(1, Math.round(width * drawScale));
      canvasHeight = Math.max(1, Math.round(height * drawScale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const context = canvas.getContext("2d", { alpha: true });

    if (!context) {
      throw new Error("Your browser could not start image processing.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const mimeType = outputFormat.value;

    if (mimeType === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    context.save();
    context.translate(canvasWidth / 2, canvasHeight / 2);
    context.rotate((rotation * Math.PI) / 180);

    context.scale(
      flipHorizontal ? -1 : 1,
      flipVertical ? -1 : 1
    );

    const drawWidth = originalWidth * drawScale;
    const drawHeight = originalHeight * drawScale;

    context.drawImage(
      sourceImage,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    context.restore();

    return canvas;
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("The browser could not create the output image."));
              return;
            }

            resolve(blob);
          },
          mimeType,
          mimeType === "image/png" ? undefined : quality
        );
      } catch {
        reject(new Error("Image export failed. Try another format."));
      }
    });
  }

  async function renderPreview() {
    if (!sourceImage || !currentFile) return;

    const requestId = operationNumber;
    let canvas;

    try {
      canvas = createOutputCanvas(
        getOutputDimensions().width,
        getOutputDimensions().height,
        true
      );

      const blob = await canvasToBlob(
        canvas,
        outputFormat.value,
        Number(qualitySlider.value) / 100
      );

      if (requestId !== operationNumber) return;

      if (blob.type !== outputFormat.value) {
        throw new Error("Your browser does not support this output format.");
      }

      const newPreviewUrl = URL.createObjectURL(blob);
      const oldPreviewUrl = previewObjectUrl;

      previewObjectUrl = newPreviewUrl;
      imagePreview.src = newPreviewUrl;

      if (oldPreviewUrl) URL.revokeObjectURL(oldPreviewUrl);

      updateAngleBadge();
    } catch (error) {
      if (requestId === operationNumber) {
        setStatus(
          error instanceof Error ? error.message : "Could not update the preview.",
          "error"
        );
      }
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  }

  function updateTransform(change) {
    if (!sourceImage || isLoading || isSaving) return;

    change();
    clearResult();
    updateAngleBadge();
    renderPreview();
    setStatus("Preview updated. Prepare the download when you're ready.", "ok");
  }

  function clearCurrentImage() {
    operationNumber++;

    currentFile = null;
    sourceImage = null;
    originalWidth = 0;
    originalHeight = 0;
    rotation = 0;
    flipHorizontal = false;
    flipVertical = false;
    isLoading = false;
    isSaving = false;

    revokeUrl("originalObjectUrl");
    revokeUrl("previewObjectUrl");
    clearResult();

    imagePreview.removeAttribute("src");
    imageInput.value = "";

    chooseImageButton.disabled = false;
    changeImageButton.disabled = false;
    saveImageButton.disabled = false;

    [
      rotateLeftButton,
      rotateRightButton,
      flipHorizontalButton,
      flipVerticalButton,
      resetEditsButton
    ].forEach((button) => {
      button.disabled = false;
    });

    setStatus("");
    updateAngleBadge();
  }

  function startOver() {
    clearCurrentImage();
    editor.hidden = true;
    uploadBox.hidden = false;
    imageInput.value = "";
  }

  function loadImage(file) {
    if (!file) return;

    if (isLoading || isSaving) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setStatus("Please select a JPG, PNG or WebP image.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("This image exceeds the 25 MB file size limit.", "error");
      return;
    }

    clearCurrentImage();

    const requestId = ++operationNumber;
    isLoading = true;

    chooseImageButton.disabled = true;
    changeImageButton.disabled = true;
    setStatus("Loading your image…");

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (requestId !== operationNumber) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (!width || !height) {
        URL.revokeObjectURL(objectUrl);
        isLoading = false;
        chooseImageButton.disabled = false;
        changeImageButton.disabled = false;
        setStatus("The selected image could not be read.", "error");
        return;
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        URL.revokeObjectURL(objectUrl);
        isLoading = false;
        chooseImageButton.disabled = false;
        changeImageButton.disabled = false;
        setStatus("Each original image dimension must be 12,000 pixels or less.", "error");
        return;
      }

      if (width * height > MAX_INPUT_PIXELS) {
        URL.revokeObjectURL(objectUrl);
        isLoading = false;
        chooseImageButton.disabled = false;
        changeImageButton.disabled = false;
        setStatus("The original image exceeds the 40-megapixel limit.", "error");
        return;
      }

      currentFile = file;
      sourceImage = image;
      originalObjectUrl = objectUrl;
      originalWidth = width;
      originalHeight = height;
      rotation = 0;
      flipHorizontal = false;
      flipVertical = false;
      isLoading = false;

      originalDimensions.textContent = formatDimensions(width, height);
      originalSize.textContent = formatBytes(file.size);

      uploadBox.hidden = true;
      editor.hidden = false;

      chooseImageButton.disabled = false;
      changeImageButton.disabled = false;

      updateAngleBadge();
      updateQualityVisibility();

      renderPreview();
      setStatus("Image loaded. Rotate or flip it using the controls.", "ok");
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      if (requestId !== operationNumber) return;

      isLoading = false;
      chooseImageButton.disabled = false;
      changeImageButton.disabled = false;
      setStatus("The image could not be opened. Try another file.", "error");
    };

    image.src = objectUrl;
  }

  async function saveImage() {
    if (!sourceImage || !currentFile || isSaving || isLoading) {
      if (!sourceImage) {
        setStatus("Please upload an image first.", "error");
      }
      return;
    }

    const dimensions = getOutputDimensions();

    if (
      dimensions.width > MAX_DIMENSION ||
      dimensions.height > MAX_DIMENSION
    ) {
      setStatus("The output dimensions exceed the 12,000-pixel limit.", "error");
      return;
    }

    if (dimensions.width * dimensions.height > MAX_OUTPUT_PIXELS) {
      setStatus("The output exceeds the 40-megapixel limit.", "error");
      return;
    }

    const requestId = operationNumber;
    let canvas;

    isSaving = true;
    saveImageButton.disabled = true;
    changeImageButton.disabled = true;
    setStatus("Preparing your rotated image…");

    clearResult();

    try {
      canvas = createOutputCanvas(
        dimensions.width,
        dimensions.height,
        false
      );

      const blob = await canvasToBlob(
        canvas,
        outputFormat.value,
        Number(qualitySlider.value) / 100
      );

      if (requestId !== operationNumber) return;

      if (blob.type !== outputFormat.value) {
        throw new Error("Your browser does not support this output format.");
      }

      const newResultUrl = URL.createObjectURL(blob);
      resultObjectUrl = newResultUrl;

      resultPreview.src = newResultUrl;
      resultDimensions.textContent = formatDimensions(
        dimensions.width,
        dimensions.height
      );
      resultSize.textContent = formatBytes(blob.size);
      resultFormat.textContent = formatType(blob.type);

      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
      }[blob.type];

      downloadButton.href = newResultUrl;
      downloadButton.download = `digifox-rotated-image.${extension}`;

      const changes = [];

      if (rotation !== 0) {
        changes.push(`rotated ${rotation}°`);
      }

      if (flipHorizontal) {
        changes.push("flipped horizontally");
      }

      if (flipVertical) {
        changes.push("flipped vertically");
      }

      if (changes.length === 0) {
        changes.push("exported without rotation or flipping");
      }

      resultSummary.textContent =
        `Image ${changes.join(" and ")}. Output size: ${formatBytes(blob.size)}. ` +
        "The downloaded file contains the applied changes.";

      resultPanel.hidden = false;
      setStatus("Your image is ready to download.", "ok");

      resultPanel.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    } catch (error) {
      if (requestId === operationNumber) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Could not prepare the image. Try another format or image.",
          "error"
        );
      }
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }

      if (requestId === operationNumber) {
        isSaving = false;
        saveImageButton.disabled = false;
        changeImageButton.disabled = false;
      }
    }
  }

  chooseImageButton.addEventListener("click", () => {
    if (!isLoading && !isSaving) imageInput.click();
  });

  changeImageButton.addEventListener("click", () => {
    if (!isLoading && !isSaving) imageInput.click();
  });

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadImage(file);
  });

  rotateLeftButton.addEventListener("click", () => {
    updateTransform(() => {
      rotation = (rotation + 270) % 360;
    });
  });

  rotateRightButton.addEventListener("click", () => {
    updateTransform(() => {
      rotation = (rotation + 90) % 360;
    });
  });

  document.querySelectorAll(".rot-quick-angles button").forEach((button) => {
    button.addEventListener("click", () => {
      const angle = Number(button.dataset.angle);

      if (![0, 90, 180, 270].includes(angle)) return;

      updateTransform(() => {
        rotation = angle;
      });
    });
  });

  flipHorizontalButton.addEventListener("click", () => {
    updateTransform(() => {
      flipHorizontal = !flipHorizontal;
      flipHorizontalButton.setAttribute(
        "aria-pressed",
        String(flipHorizontal)
      );
    });
  });

  flipVerticalButton.addEventListener("click", () => {
    updateTransform(() => {
      flipVertical = !flipVertical;
      flipVerticalButton.setAttribute(
        "aria-pressed",
        String(flipVertical)
      );
    });
  });

  resetEditsButton.addEventListener("click", () => {
    if (!sourceImage || isLoading || isSaving) return;

    rotation = 0;
    flipHorizontal = false;
    flipVertical = false;

    flipHorizontalButton.setAttribute("aria-pressed", "false");
    flipVerticalButton.setAttribute("aria-pressed", "false");

    clearResult();
    updateAngleBadge();
    renderPreview();
    setStatus("Rotation and flips have been reset.", "ok");
  });

  outputFormat.addEventListener("change", () => {
    updateQualityVisibility();
    clearResult();

    if (sourceImage) renderPreview();
  });

  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
    clearResult();

    if (sourceImage && outputFormat.value !== "image/png") {
      renderPreview();
    }
  });

  saveImageButton.addEventListener("click", saveImage);
  startOverButton.addEventListener("click", startOver);

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      uploadBox.classList.add("rot-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      uploadBox.classList.remove("rot-dragging");
    });
  });

  uploadBox.addEventListener("drop", (event) => {
    if (isLoading || isSaving) return;

    const file = event.dataTransfer?.files?.[0];
    if (file) loadImage(file);
  });

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("rot-nav-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  $("currentYear").textContent = new Date().getFullYear();

  updateQualityVisibility();
  updateAngleBadge();
})();