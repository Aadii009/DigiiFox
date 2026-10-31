(() => {
  "use strict";

  const fileInput = document.getElementById("ibcFileInput");
  const dropZone = document.getElementById("ibcDropZone");
  const editor = document.getElementById("ibcEditor");
  const canvas = document.getElementById("ibcCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const sourceColorInput = document.getElementById("ibcSourceColor");
  const targetColorInput = document.getElementById("ibcTargetColor");
  const hexColorInput = document.getElementById("ibcHexColor");
  const toleranceInput = document.getElementById("ibcTolerance");
  const toleranceValue = document.getElementById("ibcToleranceValue");
  const connectedInput = document.getElementById("ibcConnectedOnly");
  const softEdgesInput = document.getElementById("ibcSoftEdges");

  const selectionStatus = document.getElementById("ibcSelectionStatus");
  const status = document.getElementById("ibcStatus");
  const imageInfo = document.getElementById("ibcImageInfo");
  const resetButton = document.getElementById("ibcReset");
  const reselectButton = document.getElementById("ibcReselect");

  const formatSelect = document.getElementById("ibcFormat");
  const qualityField = document.getElementById("ibcQualityField");
  const qualityInput = document.getElementById("ibcQuality");
  const qualityValue = document.getElementById("ibcQualityValue");
  const downloadButton = document.getElementById("ibcDownload");

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_PIXELS = 12_000_000;
  const MAX_DIMENSION = 12_000;

  let originalImage = null;
  let originalPixels = null;
  let originalFileName = "edited-image";
  let objectUrl = null;
  let selectedSeed = null;
  let isBusy = false;
  let loadVersion = 0;
  let renderVersion = 0;
  let selectionVersion = 0;
  let isChoosingColor = false;

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "ibc-status";

    if (type) {
      status.classList.add(`ibc-${type}`);
    }
  }

  function setBusy(value) {
    isBusy = value;
    downloadButton.disabled = value;
    resetButton.disabled = value;
    fileInput.disabled = value;
    dropZone.setAttribute("aria-busy", String(value));
  }

  function updateSelectionMessage(message) {
    selectionStatus.lastElementChild.textContent = message;
  }

  function updateQualityControl() {
    const lossy = formatSelect.value === "image/jpeg" ||
      formatSelect.value === "image/webp";

    qualityField.hidden = !lossy;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function normalizeHex(value) {
    let hex = value.trim();

    if (!hex.startsWith("#")) {
      hex = `#${hex}`;
    }

    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      hex = "#" + hex.slice(1).split("").map(char => char + char).join("");
    }

    return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : null;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHex(hex);

    if (!normalized) return null;

    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16)
    };
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b]
      .map(value => Math.round(value).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  function pixelDistance(data, index, color) {
    const dr = data[index] - color.r;
    const dg = data[index + 1] - color.g;
    const db = data[index + 2] - color.b;

    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function getToleranceThreshold() {
    return Number(toleranceInput.value) * Math.sqrt(3);
  }

  function releaseImage() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    originalImage = null;
    originalPixels = null;
    selectedSeed = null;

    canvas.width = 0;
    canvas.height = 0;
  }

  async function loadImage(file) {
    if (isBusy || !file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Please choose a valid image file.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("The selected image exceeds 25 MB. Please choose a smaller file.", "error");
      return;
    }

    const version = ++loadVersion;

    setBusy(true);
    setStatus("Loading your image...");

    // Invalidate any background selection or preview work in progress.
    renderVersion++;
    selectionVersion++;
    releaseImage();

    try {
      const nextUrl = URL.createObjectURL(file);
      objectUrl = nextUrl;

      const image = new Image();
      image.decoding = "async";

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("The image could not be opened."));
        image.src = nextUrl;
      });

      if (version !== loadVersion) {
        URL.revokeObjectURL(nextUrl);

        if (objectUrl === nextUrl) objectUrl = null;
        return;
      }

      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (!width || !height) {
        throw new Error("The selected image has invalid dimensions.");
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error("The maximum supported image dimension is 12,000 pixels.");
      }

      if (width * height > MAX_PIXELS) {
        throw new Error("This image exceeds the 12-megapixel limit. Please choose a smaller image.");
      }

      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      // Save the original pixels once. Every preview is built from these
      // pixels so repeated adjustments do not accumulate image damage.
      originalPixels = ctx.getImageData(0, 0, width, height);
      originalImage = image;
      originalFileName = file.name.replace(/\.[^.]+$/, "") || "edited-image";

      editor.hidden = false;
      imageInfo.textContent =
        `${width.toLocaleString()} × ${height.toLocaleString()} pixels · ${formatFileSize(file.size)}`;

      sourceColorInput.value = "#FFFFFF";
      targetColorInput.value = "#2878D4";
      hexColorInput.value = "#2878D4";
      toleranceInput.value = "35";
      toleranceValue.value = "35";
      connectedInput.checked = true;
      softEdgesInput.checked = true;

      updateSelectionMessage(
        "No background color selected yet. Click the image background to select it."
      );

      await renderPreview();

      setStatus("Image loaded. Click its background to select a color to replace.", "success");

    } catch (error) {
      if (version === loadVersion) {
        releaseImage();
        editor.hidden = true;
        setStatus(error.message || "Unable to load this image.", "error");
      }
    } finally {
      if (version === loadVersion) {
        setBusy(false);
      }
    }
  }

  function getCanvasPixel(event) {
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return null;

    const x = Math.floor((event.clientX - rect.left) * canvas.width / rect.width);
    const y = Math.floor((event.clientY - rect.top) * canvas.height / rect.height);

    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
      return null;
    }

    return { x, y, index: y * canvas.width + x };
  }

  function selectBackgroundAt(event) {
    if (!originalPixels || isBusy) return;

    const point = getCanvasPixel(event);
    if (!point) return;

    const data = originalPixels.data;
    const i = point.index * 4;

    if (data[i + 3] === 0) {
      setStatus(
        "That pixel is already transparent. Choose a visible background pixel instead.",
        "error"
      );
      return;
    }

    selectedSeed = point.index;

    const hex = rgbToHex(data[i], data[i + 1], data[i + 2]);
    sourceColorInput.value = hex;

    updateSelectionMessage(
      `Selected ${hex} at position (${point.x + 1}, ${point.y + 1}). Adjust tolerance if needed.`
    );

    setStatus("Background color selected. Previewing the replacement...", "");
    renderPreview();
  }

  function buildSelectionMask(sourceColor, version) {
    const data = originalPixels.data;
    const pixelCount = canvas.width * canvas.height;
    const threshold = getToleranceThreshold();
    const mask = new Uint8Array(pixelCount);

    if (connectedInput.checked && selectedSeed !== null) {
      // Breadth-first search: only visit similar-colored pixels connected
      // to the selected background point.
      const queue = new Int32Array(pixelCount);
      let head = 0;
      let tail = 0;

      const seedIndex = selectedSeed;
      const seedDataIndex = seedIndex * 4;

      if (
        data[seedDataIndex + 3] > 0 &&
        pixelDistance(data, seedDataIndex, sourceColor) <= threshold
      ) {
        mask[seedIndex] = 1;
        queue[tail++] = seedIndex;
      }

      const width = canvas.width;
      const height = canvas.height;

      while (head < tail) {
        if (version !== selectionVersion) {
          return null;
        }

        const index = queue[head++];
        const x = index % width;
        const y = Math.floor(index / width);

        // Visit the four directly adjacent pixels.
        const neighbors = [];

        if (x > 0) neighbors.push(index - 1);
        if (x + 1 < width) neighbors.push(index + 1);
        if (y > 0) neighbors.push(index - width);
        if (y + 1 < height) neighbors.push(index + width);

        for (const neighbor of neighbors) {
          if (mask[neighbor]) continue;

          const pixelIndex = neighbor * 4;

          if (data[pixelIndex + 3] === 0) {
            mask[neighbor] = 1;
            continue;
          }

          if (pixelDistance(data, pixelIndex, sourceColor) <= threshold) {
            mask[neighbor] = 1;
            queue[tail++] = neighbor;
          }
        }
      }
    } else {
      // Global replacement: identify matching colors anywhere in the image.
      for (let pixel = 0; pixel < pixelCount; pixel++) {
        if (version !== selectionVersion) return null;

        const i = pixel * 4;

        if (
          data[i + 3] > 0 &&
          pixelDistance(data, i, sourceColor) <= threshold
        ) {
          mask[pixel] = 1;
        }
      }
    }

    return mask;
  }

  async function renderPreview() {
    if (!originalPixels || isBusy) return;

    const sourceColor = hexToRgb(sourceColorInput.value);
    const targetColor = hexToRgb(targetColorInput.value);

    if (!sourceColor || !targetColor) return;

    const thisVersion = ++selectionVersion;
    const original = originalPixels;
    const width = canvas.width;
    const height = canvas.height;

    // Yield to the browser before processing so status updates can display.
    await new Promise(resolve => setTimeout(resolve, 0));

    if (thisVersion !== selectionVersion || original !== originalPixels) return;

    let mask;

    try {
      mask = buildSelectionMask(sourceColor, thisVersion);
    } catch (error) {
      setStatus("The image could not be processed. Try a smaller image.", "error");
      return;
    }

    if (!mask || thisVersion !== selectionVersion) return;

    const output = new ImageData(
      new Uint8ClampedArray(original.data),
      width,
      height
    );

    const inputData = original.data;
    const outputData = output.data;
    const threshold = getToleranceThreshold();
    const softEdges = softEdgesInput.checked;
    let replacedPixels = 0;

    for (let pixel = 0; pixel < mask.length; pixel++) {
      if (!mask[pixel]) continue;

      const i = pixel * 4;
      const distance = pixelDistance(inputData, i, sourceColor);

      let amount = 1;

      if (softEdges && threshold > 0) {
        // Blend boundary shades smoothly into the new background color.
        const lower = threshold * 0.72;
        amount = Math.max(
          0,
          Math.min(1, (threshold - distance) / Math.max(1, threshold - lower))
        );
      }

      if (amount <= 0) continue;

      outputData[i] = inputData[i] * (1 - amount) + targetColor.r * amount;
      outputData[i + 1] = inputData[i + 1] * (1 - amount) + targetColor.g * amount;
      outputData[i + 2] = inputData[i + 2] * (1 - amount) + targetColor.b * amount;

      // Preserve the original alpha, including transparent pixels.
      outputData[i + 3] = inputData[i + 3];

      replacedPixels++;
    }

    if (thisVersion !== selectionVersion) return;

    try {
      ctx.putImageData(output, 0, 0);

      if (selectedSeed === null) {
        updateSelectionMessage(
          "Choose a background color by clicking a visible point in the image."
        );
      } else {
        updateSelectionMessage(
          `${rgbToHex(sourceColor.r, sourceColor.g, sourceColor.b)} → ` +
          `${rgbToHex(targetColor.r, targetColor.g, targetColor.b)} · ` +
          `${replacedPixels.toLocaleString()} pixels affected.`
        );
      }
    } catch (error) {
      setStatus("Could not update the preview. Try a smaller image.", "error");
    }
  }

  function schedulePreview() {
    if (!originalPixels || isBusy) return;

    // Cancel an older preview while the user is moving a slider.
    selectionVersion++;
    renderPreview();
  }

  function resetEditor() {
    if (!originalPixels || isBusy) return;

    selectedSeed = null;
    sourceColorInput.value = "#FFFFFF";
    targetColorInput.value = "#2878D4";
    hexColorInput.value = "#2878D4";
    toleranceInput.value = "35";
    toleranceValue.value = "35";
    connectedInput.checked = true;
    softEdgesInput.checked = true;

    document.querySelectorAll(".ibc-swatch").forEach(button => {
      button.removeAttribute("aria-pressed");
    });

    ctx.putImageData(originalPixels, 0, 0);

    updateSelectionMessage(
      "Adjustments reset. Click the image background to select a color to replace."
    );

    setStatus("Image reset to its original appearance.", "success");
  }

  function updateTargetColor(hex) {
    const normalized = normalizeHex(hex);

    if (!normalized) {
      hexColorInput.setAttribute("aria-invalid", "true");
      return false;
    }

    hexColorInput.removeAttribute("aria-invalid");
    targetColorInput.value = normalized;
    hexColorInput.value = normalized;

    document.querySelectorAll(".ibc-swatch").forEach(button => {
      if (button.dataset.color.toUpperCase() === normalized) {
        button.setAttribute("aria-pressed", "true");
      } else {
        button.removeAttribute("aria-pressed");
      }
    });

    schedulePreview();
    return true;
  }

  function getExtension(mimeType) {
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/webp") return "webp";
    return "png";
  }

  function downloadImage() {
    if (!originalPixels || isBusy) {
      setStatus("Please upload an image first.", "error");
      return;
    }

    const version = selectionVersion;

    setBusy(true);
    setStatus("Preparing your image for download...");

    window.setTimeout(() => {
      try {
        // Use the current preview so the exported image matches the screen.
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;

        const exportCtx = exportCanvas.getContext("2d");

        if (!exportCtx) {
          throw new Error("Your browser could not prepare the export.");
        }

        const mimeType = formatSelect.value;
        const quality = Number(qualityInput.value) / 100;

        // JPG has no alpha channel, so flatten transparent pixels to white.
        if (mimeType === "image/jpeg") {
          exportCtx.fillStyle = "#ffffff";
          exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        }

        exportCtx.drawImage(canvas, 0, 0);

        exportCanvas.toBlob((blob) => {
          try {
            if (!blob) {
              setStatus("Could not export the image. Try a smaller image.", "error");
              return;
            }

            // If the browser cannot encode a requested format, it may return PNG.
            const actualMimeType = blob.type || "image/png";
            const extension = getExtension(actualMimeType);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = `${originalFileName}-background-changed.${extension}`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            setStatus(
              `Your image has been downloaded as ${extension.toUpperCase()}.`,
              "success"
            );
          } finally {
            exportCanvas.width = 0;
            exportCanvas.height = 0;
            setBusy(false);
          }
        }, mimeType, mimeType === "image/png" ? undefined : quality);

      } catch (error) {
        setStatus(error.message || "Could not export the image.", "error");
        setBusy(false);
      }
    }, 30);
  }

  // Upload by file picker.
  fileInput.addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];

    if (file) loadImage(file);

    // Allow selecting the same file again.
    fileInput.value = "";
  });

  // Drag and drop support.
  ["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
      event.preventDefault();

      if (!isBusy) dropZone.classList.add("ibc-dragging");
    });
  });

  ["dragleave", "dragend"].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove("ibc-dragging");
    });
  });

  dropZone.addEventListener("drop", event => {
    event.preventDefault();
    dropZone.classList.remove("ibc-dragging");

    if (isBusy) return;

    const file = event.dataTransfer.files && event.dataTransfer.files[0];

    if (file) loadImage(file);
  });

  // Select the original background color directly from the preview.
  canvas.addEventListener("click", selectBackgroundAt);

  reselectButton.addEventListener("click", () => {
    isChoosingColor = !isChoosingColor;

    canvas.style.cursor = isChoosingColor ? "crosshair" : "crosshair";

    if (isChoosingColor) {
      setStatus("Click a point on the image background to select its color.");
      canvas.focus();
    } else {
      setStatus("Click the image to select its background color.");
    }
  });

  sourceColorInput.addEventListener("input", () => {
    // A manually entered source color is used for matching; in connected mode,
    // a clicked seed is still needed to identify which connected area to edit.
    schedulePreview();
  });

  // Replacement color and hexadecimal input.
  targetColorInput.addEventListener("input", () => {
    hexColorInput.value = targetColorInput.value.toUpperCase();

    document.querySelectorAll(".ibc-swatch").forEach(button => {
      if (button.dataset.color.toUpperCase() === hexColorInput.value) {
        button.setAttribute("aria-pressed", "true");
      } else {
        button.removeAttribute("aria-pressed");
      }
    });

    schedulePreview();
  });

  hexColorInput.addEventListener("input", () => {
    const normalized = normalizeHex(hexColorInput.value);

    if (normalized) {
      updateTargetColor(normalized);
    } else {
      hexColorInput.setAttribute("aria-invalid", "true");
    }
  });

  hexColorInput.addEventListener("change", () => {
    const normalized = normalizeHex(hexColorInput.value);

    if (normalized) {
      updateTargetColor(normalized);
    } else {
      hexColorInput.value = targetColorInput.value.toUpperCase();
      hexColorInput.removeAttribute("aria-invalid");
    }
  });

  // Preset color swatches.
  document.querySelectorAll(".ibc-swatch").forEach(button => {
    button.addEventListener("click", () => {
      updateTargetColor(button.dataset.color);
    });
  });

  // Tolerance and selection options.
  toleranceInput.addEventListener("input", () => {
    toleranceValue.value = toleranceInput.value;
    schedulePreview();
  });

  connectedInput.addEventListener("change", schedulePreview);
  softEdgesInput.addEventListener("change", schedulePreview);

  // Export options.
  formatSelect.addEventListener("change", updateQualityControl);

  qualityInput.addEventListener("input", () => {
    qualityValue.value = `${qualityInput.value}%`;
  });

  resetButton.addEventListener("click", resetEditor);
  downloadButton.addEventListener("click", downloadImage);

  document.getElementById("ibcYear").textContent = new Date().getFullYear();

  updateQualityControl();
  qualityValue.value = `${qualityInput.value}%`;
})();