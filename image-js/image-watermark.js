"use strict";

(() => {
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_PIXELS = 40_000_000;
  const MAX_DIMENSION = 12_000;
  const PREVIEW_MAX_DIMENSION = 1100;
  const $ = (id) => document.getElementById(id);

  const imageInput = $("imageInput");
  const uploadBox = $("uploadBox");
  const editor = $("editor");
  const chooseImageButton = $("chooseImageButton");
  const changeImageButton = $("changeImageButton");

  const previewCanvas = $("previewCanvas");
  const watermarkText = $("watermarkText");
  const fontFamily = $("fontFamily");
  const fontSize = $("fontSize");
  const fontSizeValue = $("fontSizeValue");
  const watermarkColor = $("watermarkColor");
  const colorValue = $("colorValue");
  const opacity = $("opacity");
  const opacityValue = $("opacityValue");
  const rotation = $("rotation");
  const rotationValue = $("rotationValue");
  const position = $("position");
  const margin = $("margin");
  const marginValue = $("marginValue");
  const boldText = $("boldText");
  const outputFormat = $("outputFormat");
  const qualityGroup = $("qualityGroup");
  const quality = $("quality");
  const qualityValue = $("qualityValue");
  const downloadButton = $("downloadButton");
  const resetButton = $("resetButton");
  const statusMessage = $("statusMessage");
  const originalDimensions = $("originalDimensions");
  const originalSize = $("originalSize");
  const menuToggle = $("menuToggle");
  const mainNav = $("mainNav");

  let currentFile = null;
  let sourceImage = null;
  let sourceUrl = null;
  let isLoading = false;
  let isExporting = false;
  let operationId = 0;

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDimensions(width, height) {
    return `${width.toLocaleString()} × ${height.toLocaleString()} px`;
  }

  function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "iw-status";
    if (type) statusMessage.classList.add(`iw-${type}`);
  }

  function getSettings() {
    return {
      text: watermarkText.value.trim(),
      font: fontFamily.value,
      fontPercent: Number(fontSize.value),
      color: watermarkColor.value,
      opacity: Number(opacity.value) / 100,
      rotation: Number(rotation.value),
      position: position.value,
      marginPercent: Number(margin.value),
      bold: boldText.checked,
      format: outputFormat.value,
      quality: Number(quality.value) / 100
    };
  }

  function updateLabels() {
    fontSizeValue.textContent = `${fontSize.value}% of image width`;
    colorValue.textContent = watermarkColor.value.toUpperCase();
    opacityValue.textContent = `${opacity.value}%`;
    rotationValue.textContent = `${rotation.value}°`;
    marginValue.textContent = `${margin.value}%`;
    qualityValue.textContent = `${quality.value}%`;
    qualityGroup.hidden = outputFormat.value === "image/png";
  }

  function getPreviewSize(width, height) {
    const scale = Math.min(
      1,
      PREVIEW_MAX_DIMENSION / Math.max(width, height)
    );

    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      scale
    };
  }

  function getWatermarkAnchor(ctx, width, height, settings, fontSizePx) {
    const marginPx = Math.min(
      width,
      height
    ) * settings.marginPercent / 100;

    const metrics = ctx.measureText(settings.text);
    const textWidth = metrics.width;
    const textHeight = fontSizePx;

    const anchors = {
      "top-left": {
        x: marginPx, y: marginPx + textHeight,
        align: "left", baseline: "alphabetic"
      },
      "top-center": {
        x: width / 2, y: marginPx + textHeight,
        align: "center", baseline: "alphabetic"
      },
      "top-right": {
        x: width - marginPx, y: marginPx + textHeight,
        align: "right", baseline: "alphabetic"
      },
      "middle-left": {
        x: marginPx, y: height / 2,
        align: "left", baseline: "middle"
      },
      "center": {
        x: width / 2, y: height / 2,
        align: "center", baseline: "middle"
      },
      "middle-right": {
        x: width - marginPx, y: height / 2,
        align: "right", baseline: "middle"
      },
      "bottom-left": {
        x: marginPx, y: height - marginPx,
        align: "left", baseline: "alphabetic"
      },
      "bottom-center": {
        x: width / 2, y: height - marginPx,
        align: "center", baseline: "alphabetic"
      },
      "bottom-right": {
        x: width - marginPx, y: height - marginPx,
        align: "right", baseline: "alphabetic"
      }
    };

    const anchor = anchors[settings.position] || anchors["bottom-right"];

    // Keep the anchor away from the edge when text is rotated.
    const rotatedRadius = Math.sqrt(
      (textWidth / 2) ** 2 + (textHeight / 2) ** 2
    );

    const safeMargin = Math.max(marginPx, Math.min(rotatedRadius, Math.min(width, height) / 3));

    if (anchor.align === "left") {
      anchor.x = Math.min(anchor.x, width - safeMargin);
    } else if (anchor.align === "right") {
      anchor.x = Math.max(anchor.x, safeMargin);
    }

    if (anchor.baseline === "alphabetic") {
      if (anchor.y < safeMargin) anchor.y = safeMargin;
      if (anchor.y > height - safeMargin) anchor.y = height - safeMargin;
    } else {
      anchor.y = Math.max(safeMargin, Math.min(height - safeMargin, anchor.y));
    }

    return anchor;
  }

  function drawWatermark(ctx, width, height, settings) {
    if (!settings.text) return;

    const fontSizePx = Math.max(1, width * settings.fontPercent / 100);

    ctx.save();
    ctx.globalAlpha = settings.opacity;
    ctx.fillStyle = settings.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${settings.bold ? "700" : "400"} ${fontSizePx}px ${settings.font}`;

    const anchor = getWatermarkAnchor(
      ctx,
      width,
      height,
      settings,
      fontSizePx
    );

    ctx.translate(anchor.x, anchor.y);
    ctx.rotate(settings.rotation * Math.PI / 180);
    ctx.textAlign = anchor.align;
    ctx.textBaseline = anchor.baseline;
    ctx.fillText(settings.text, 0, 0);

    ctx.restore();
  }

  function drawImageWithWatermark(canvas, settings, isPreview = false) {
    const width = sourceImage.naturalWidth;
    const height = sourceImage.naturalHeight;
    const preview = isPreview ? getPreviewSize(width, height) : { width, height, scale: 1 };

    canvas.width = preview.width;
    canvas.height = preview.height;

    const ctx = canvas.getContext("2d", { alpha: settings.format !== "image/jpeg" });

    if (!ctx) {
      throw new Error("Your browser could not start image processing.");
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (settings.format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

    // The watermark is proportional to the image width, including in preview.
    drawWatermark(ctx, canvas.width, canvas.height, settings);
  }

  function renderPreview() {
    if (!sourceImage) return;

    try {
      const settings = getSettings();
      drawImageWithWatermark(previewCanvas, settings, true);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not update the preview.",
        "error"
      );
    }
  }

  function clearImage() {
    operationId++;
    currentFile = null;
    sourceImage = null;
    isLoading = false;
    isExporting = false;

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
      sourceUrl = null;
    }

    imageInput.value = "";
    previewCanvas.width = 0;
    previewCanvas.height = 0;

    originalDimensions.textContent = "—";
    originalSize.textContent = "—";

    chooseImageButton.disabled = false;
    changeImageButton.disabled = false;
    downloadButton.disabled = false;
    resetButton.disabled = false;
  }

  function loadImage(file) {
    if (!file || isLoading || isExporting) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setStatus("Please select a JPG, PNG or WebP image.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("This image exceeds the 25 MB file size limit.", "error");
      return;
    }

    clearImage();

    const requestId = ++operationId;
    isLoading = true;

    chooseImageButton.disabled = true;
    changeImageButton.disabled = true;
    setStatus("Loading your image…");

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (requestId !== operationId) {
        URL.revokeObjectURL(url);
        return;
      }

      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (
        !width || !height ||
        width > MAX_DIMENSION ||
        height > MAX_DIMENSION ||
        width * height > MAX_PIXELS
      ) {
        URL.revokeObjectURL(url);
        isLoading = false;
        chooseImageButton.disabled = false;
        changeImageButton.disabled = false;
        setStatus(
          "This image exceeds the supported dimensions (maximum 12,000 px per side and 40 megapixels).",
          "error"
        );
        return;
      }

      currentFile = file;
      sourceImage = image;
      sourceUrl = url;
      isLoading = false;

      originalDimensions.textContent = formatDimensions(width, height);
      originalSize.textContent = formatBytes(file.size);

      uploadBox.hidden = true;
      editor.hidden = false;

      chooseImageButton.disabled = false;
      changeImageButton.disabled = false;

      updateLabels();
      renderPreview();
      setStatus("Image loaded. Customize your watermark.", "ok");
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);

      if (requestId !== operationId) return;

      isLoading = false;
      chooseImageButton.disabled = false;
      changeImageButton.disabled = false;
      setStatus("The selected image could not be opened. Try another file.", "error");
    };

    image.src = url;
  }

  function resetSettings() {
    watermarkText.value = "© Your Brand Name";
    fontFamily.value = "Arial, Helvetica, sans-serif";
    fontSize.value = "5";
    watermarkColor.value = "#ffffff";
    opacity.value = "55";
    rotation.value = "-25";
    position.value = "bottom-right";
    margin.value = "4";
    boldText.checked = true;
    outputFormat.value = "image/png";
    quality.value = "92";

    updateLabels();

    if (sourceImage) {
      renderPreview();
      setStatus("Watermark settings have been reset.", "ok");
    }
  }

  async function exportImage() {
    if (!sourceImage || !currentFile || isLoading || isExporting) {
      if (!sourceImage) setStatus("Please upload an image first.", "error");
      return;
    }

    const settings = getSettings();

    if (!settings.text) {
      setStatus("Enter the text you want to use as a watermark.", "error");
      watermarkText.focus();
      return;
    }

    const requestId = operationId;
    const canvas = document.createElement("canvas");

    isExporting = true;
    downloadButton.disabled = true;
    changeImageButton.disabled = true;
    resetButton.disabled = true;

    setStatus("Applying watermark and preparing your download…");

    try {
      drawImageWithWatermark(canvas, settings, false);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error("The browser could not create the output image."));
              return;
            }

            resolve(result);
          },
          settings.format,
          settings.format === "image/png" ? undefined : settings.quality
        );
      });

      if (requestId !== operationId) return;

      if (blob.type !== settings.format) {
        throw new Error("Your browser could not export that format. Please choose another.");
      }

      const downloadUrl = URL.createObjectURL(blob);
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
      }[blob.type];

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `digifox-watermarked-image.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setStatus(
        `Watermarked image downloaded. Output dimensions: ${formatDimensions(canvas.width, canvas.height)}. File size: ${formatBytes(blob.size)}.`,
        "ok"
      );

      // Give the browser time to begin the download before releasing the URL.
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch (error) {
      if (requestId === operationId) {
        setStatus(
          error instanceof Error ? error.message : "Could not export the image.",
          "error"
        );
      }
    } finally {
      canvas.width = 0;
      canvas.height = 0;

      if (requestId === operationId) {
        isExporting = false;
        downloadButton.disabled = false;
        changeImageButton.disabled = false;
        resetButton.disabled = false;
      }
    }
  }

  chooseImageButton.addEventListener("click", () => {
    if (!isLoading && !isExporting) imageInput.click();
  });

  changeImageButton.addEventListener("click", () => {
    if (!isLoading && !isExporting) imageInput.click();
  });

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadImage(file);
  });

  [
    watermarkText,
    fontFamily,
    fontSize,
    watermarkColor,
    opacity,
    rotation,
    position,
    margin,
    boldText
  ].forEach((control) => {
    control.addEventListener("input", () => {
      updateLabels();
      renderPreview();
    });

    control.addEventListener("change", () => {
      updateLabels();
      renderPreview();
    });
  });

  outputFormat.addEventListener("change", () => {
    updateLabels();
    renderPreview();
  });

  quality.addEventListener("input", () => {
    updateLabels();
  });

  downloadButton.addEventListener("click", exportImage);

  resetButton.addEventListener("click", () => {
    if (!isLoading && !isExporting) resetSettings();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      uploadBox.classList.add("iw-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadBox.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      uploadBox.classList.remove("iw-dragging");
    });
  });

  uploadBox.addEventListener("drop", (event) => {
    if (isLoading || isExporting) return;

    const file = event.dataTransfer?.files?.[0];
    if (file) loadImage(file);
  });

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("iw-nav-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  $("currentYear").textContent = new Date().getFullYear();

  updateLabels();
})();