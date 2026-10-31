import { removeBackground } from "https://esm.sh/@imgly/background-removal@1.5.5";

(() => {
  "use strict";

  const fileInput = document.getElementById("brFileInput");
  const dropZone = document.getElementById("brDropZone");
  const editor = document.getElementById("brEditor");
  const status = document.getElementById("brStatus");
  const imageInfo = document.getElementById("brImageInfo");

  const originalPreview = document.getElementById("brOriginalPreview");
  const resultPreview = document.getElementById("brResultPreview");
  const resultStage = document.getElementById("brResultStage");

  const progressPanel = document.getElementById("brProgress");
  const progressLabel = document.getElementById("brProgressLabel");
  const progressPercent = document.getElementById("brProgressPercent");
  const progressBar = document.getElementById("brProgressBar");
  const progressHint = document.getElementById("brProgressHint");

  const resetButton = document.getElementById("brReset");
  const downloadButton = document.getElementById("brDownload");

  const formatSelect = document.getElementById("brFormat");
  const qualityField = document.getElementById("brQualityField");
  const qualityInput = document.getElementById("brQuality");
  const qualityValue = document.getElementById("brQualityValue");
  const exportNote = document.getElementById("brExportNote");
  const previewColor = document.getElementById("brPreviewColor");

  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const MAX_DIMENSION = 6000;
  const MAX_PIXELS = 16_000_000;

  let originalObjectUrl = null;
  let resultObjectUrl = null;
  let resultBlob = null;
  let originalFileName = "background-removed";
  let currentFile = null;
  let isBusy = false;
  let jobId = 0;
  let previewBackground = "transparent";

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "br-status";

    if (type) {
      status.classList.add(`br-${type}`);
    }
  }

  function setBusy(value) {
    isBusy = value;
    fileInput.disabled = value;
    resetButton.disabled = value;
    downloadButton.disabled = value;
    dropZone.setAttribute("aria-busy", String(value));
  }

  function showProgress(visible) {
    progressPanel.hidden = !visible;
  }

  function updateProgress(percent, label, hint) {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));

    progressBar.style.width = `${safePercent}%`;
    progressPercent.textContent = `${safePercent}%`;

    if (label) progressLabel.textContent = label;
    if (hint) progressHint.textContent = hint;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function releaseUrl(url) {
    if (url) URL.revokeObjectURL(url);
  }

  function clearResult() {
    releaseUrl(resultObjectUrl);

    resultObjectUrl = null;
    resultBlob = null;
    resultPreview.removeAttribute("src");
  }

  function clearImages() {
    releaseUrl(originalObjectUrl);
    originalObjectUrl = null;

    clearResult();

    originalPreview.removeAttribute("src");
    currentFile = null;
  }

  function getImageDimensions(image) {
    return {
      width: image.naturalWidth,
      height: image.naturalHeight
    };
  }

  async function validateImage(file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please choose a valid image file.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("The file exceeds 15 MB. Please choose a smaller image.");
    }

    const testUrl = URL.createObjectURL(file);

    try {
      const image = new Image();
      image.decoding = "async";

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(
          new Error("This image format could not be opened by your browser.")
        );
        image.src = testUrl;
      });

      const { width, height } = getImageDimensions(image);

      if (!width || !height) {
        throw new Error("The selected image has invalid dimensions.");
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error("The maximum supported image dimension is 6,000 pixels.");
      }

      if (width * height > MAX_PIXELS) {
        throw new Error("This image exceeds 16 megapixels. Please choose a smaller image.");
      }

      return { width, height };
    } finally {
      URL.revokeObjectURL(testUrl);
    }
  }

  async function processImage(file) {
    if (isBusy || !file) return;

    const thisJob = ++jobId;

    setBusy(true);
    showProgress(true);
    updateProgress(
      2,
      "Checking your image...",
      "Preparing the image for local processing."
    );
    setStatus("Preparing your image...");

    try {
      const dimensions = await validateImage(file);

      if (thisJob !== jobId) return;

      clearImages();
      currentFile = file;
      originalFileName = file.name.replace(/\.[^.]+$/, "") || "background-removed";

      originalObjectUrl = URL.createObjectURL(file);
      originalPreview.src = originalObjectUrl;

      editor.hidden = false;

      imageInfo.textContent =
        `${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} pixels · ${formatFileSize(file.size)}`;

      resultStage.style.backgroundColor = "";
      setPreviewBackground("transparent");

      updateProgress(
        5,
        "Loading AI model...",
        "The first run may take longer while the library and model files download."
      );

      setStatus(
        "The AI model is loading. Please keep this tab open while processing."
      );

      /*
       * The library loads model assets on demand.
       * The selected image is passed directly to the browser-side library.
       */
      const outputBlob = await removeBackground(file, {
        model: "isnet_fp16",
        output: {
          format: "image/png",
          quality: 1,
          type: "foreground"
        },
        progress: (key, current, total) => {
          if (thisJob !== jobId) return;

          if (total > 0) {
            const fraction = Math.max(0, Math.min(1, current / total));
            const percent = 5 + fraction * 90;

            updateProgress(
              percent,
              "Removing background...",
              `Working on ${String(key)}. The first run can take longer.`
            );
          } else {
            updateProgress(
              50,
              "Processing image...",
              "The AI is separating the subject from its background."
            );
          }
        }
      });

      if (thisJob !== jobId) return;

      if (!(outputBlob instanceof Blob) || outputBlob.size === 0) {
        throw new Error("The AI did not return a valid image. Please try again.");
      }

      clearResult();

      resultBlob = outputBlob;
      resultObjectUrl = URL.createObjectURL(outputBlob);
      resultPreview.src = resultObjectUrl;

      await new Promise((resolve, reject) => {
        resultPreview.onload = resolve;
        resultPreview.onerror = () => reject(
          new Error("The processed image could not be displayed.")
        );
      });

      if (thisJob !== jobId) return;

      updateProgress(
        100,
        "Background removed!",
        "Your cutout is ready. Inspect the edges and download when you're satisfied."
      );

      setStatus(
        "Background removed successfully. Your image is ready to download.",
        "success"
      );

      // Keep the completed progress visible briefly, then hide it.
      window.setTimeout(() => {
        if (thisJob === jobId) showProgress(false);
      }, 900);

    } catch (error) {
      if (thisJob !== jobId) return;

      clearResult();

      setStatus(
        error.message ||
        "Background removal failed. Check your internet connection and try again.",
        "error"
      );

      updateProgress(
        0,
        "Could not remove background",
        "Check your connection, try a smaller image, or reload the page."
      );
    } finally {
      if (thisJob === jobId) {
        setBusy(false);
      }
    }
  }

  function setPreviewBackground(background) {
    previewBackground = background;

    if (background === "transparent") {
      resultStage.classList.add("br-checkerboard");
      resultStage.style.backgroundColor = "";
    } else {
      resultStage.classList.remove("br-checkerboard");
      resultStage.style.backgroundColor = background;
    }

    document.querySelectorAll(".br-bg-option").forEach(button => {
      const active = button.dataset.background === background;

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateFormatOptions() {
    const format = formatSelect.value;
    const lossy = format === "image/jpeg" || format === "image/webp";

    qualityField.hidden = !lossy;

    if (format === "image/png") {
      exportNote.textContent =
        "PNG preserves transparent areas and is recommended for most cutouts.";
    } else if (format === "image/webp") {
      exportNote.textContent =
        "WebP supports transparency in modern browsers. Check the downloaded result in your target application.";
    } else {
      exportNote.textContent =
        "JPG cannot preserve transparency. The selected preview background color will be applied to transparent areas.";
    }
  }

  function getExtension(mimeType) {
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/webp") return "webp";
    return "png";
  }

  async function downloadResult() {
    if (!resultBlob || isBusy) {
      setStatus("Please remove an image background before downloading.", "error");
      return;
    }

    setBusy(true);
    setStatus("Preparing your download...");

    let exportUrl = null;

    try {
      const format = formatSelect.value;
      let blobToDownload;

      if (format === "image/png") {
        // Preserve the original transparent result without recompressing.
        blobToDownload = resultBlob;
      } else {
        const image = new Image();
        const temporaryUrl = URL.createObjectURL(resultBlob);

        try {
          image.src = temporaryUrl;

          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(
              new Error("Could not prepare the image for export.")
            );
          });

          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;

          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Your browser could not prepare the export.");
          }

          if (format === "image/jpeg") {
            // Flatten transparent areas onto the selected preview color.
            context.fillStyle =
              previewBackground === "transparent" ? "#ffffff" : previewBackground;

            context.fillRect(0, 0, canvas.width, canvas.height);
          }

          context.drawImage(image, 0, 0);

          blobToDownload = await new Promise((resolve, reject) => {
            canvas.toBlob(
              blob => blob ? resolve(blob) : reject(
                new Error("Could not encode the image. Please try another format.")
              ),
              format,
              Number(qualityInput.value) / 100
            );
          });

          canvas.width = 0;
          canvas.height = 0;
        } finally {
          URL.revokeObjectURL(temporaryUrl);
        }
      }

      const actualMimeType = blobToDownload.type || "image/png";
      const extension = getExtension(actualMimeType);

      exportUrl = URL.createObjectURL(blobToDownload);

      const link = document.createElement("a");
      link.href = exportUrl;
      link.download = `${originalFileName}-no-background.${extension}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setStatus(
        `Your image has been downloaded as ${extension.toUpperCase()}.`,
        "success"
      );

    } catch (error) {
      setStatus(error.message || "Download failed. Please try again.", "error");
    } finally {
      if (exportUrl) {
        window.setTimeout(() => URL.revokeObjectURL(exportUrl), 1000);
      }

      setBusy(false);
    }
  }

  function startOver() {
    // Invalidate any ongoing processing job.
    jobId++;

    clearImages();

    editor.hidden = true;
    fileInput.value = "";
    showProgress(false);

    progressBar.style.width = "0%";
    progressPercent.textContent = "0%";

    setStatus("Choose an image to get started.");
    setBusy(false);
  }

  // File picker.
  fileInput.addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];

    if (file) processImage(file);

    fileInput.value = "";
  });

  // Drag-and-drop upload.
  ["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
      event.preventDefault();

      if (!isBusy) dropZone.classList.add("br-dragging");
    });
  });

  ["dragleave", "dragend"].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove("br-dragging");
    });
  });

  dropZone.addEventListener("drop", event => {
    event.preventDefault();
    dropZone.classList.remove("br-dragging");

    if (isBusy) return;

    const file = event.dataTransfer.files && event.dataTransfer.files[0];

    if (file) processImage(file);
  });

  // Preview background buttons.
  document.querySelectorAll(".br-bg-option").forEach(button => {
    button.addEventListener("click", () => {
      setPreviewBackground(button.dataset.background);
    });
  });

  previewColor.addEventListener("input", () => {
    setPreviewBackground(previewColor.value);
  });

  // Format and quality controls.
  formatSelect.addEventListener("change", updateFormatOptions);

  qualityInput.addEventListener("input", () => {
    qualityValue.value = `${qualityInput.value}%`;
  });

  resetButton.addEventListener("click", startOver);
  downloadButton.addEventListener("click", downloadResult);

  document.getElementById("brYear").textContent = new Date().getFullYear();

  updateFormatOptions();
  qualityValue.value = `${qualityInput.value}%`;
})();