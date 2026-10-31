document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  const uploadBox = document.getElementById("uploadBox");
  const editor = document.getElementById("editor");
  const originalPreview = document.getElementById("originalPreview");
  const convertedPreview = document.getElementById("convertedPreview");
  const previewPlaceholder = document.getElementById("previewPlaceholder");

  const qualityInput = document.getElementById("quality");
  const qualityValue = document.getElementById("qualityValue");
  const convertButton = document.getElementById("convertButton");
  const changeImageButton = document.getElementById("changeImageButton");

  const originalSize = document.getElementById("originalSize");
  const originalDimensions = document.getElementById("originalDimensions");
  const originalFormat = document.getElementById("originalFormat");

  const convertedSize = document.getElementById("convertedSize");
  const convertedDimensions = document.getElementById("convertedDimensions");
  const convertedFormat = document.getElementById("convertedFormat");

  const conversionSummary = document.getElementById("conversionSummary");
  const summaryTitle = document.getElementById("summaryTitle");
  const summaryText = document.getElementById("summaryText");
  const savingsBadge = document.getElementById("savingsBadge");

  const downloadButton = document.getElementById("downloadButton");
  const statusMessage = document.getElementById("statusMessage");

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_PIXELS = 40_000_000;
  const MAX_DIMENSION = 12000;

  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  let currentFile = null;
  let sourceObjectUrl = null;
  let convertedObjectUrl = null;
  let originalWidth = 0;
  let originalHeight = 0;
  let isProcessing = false;

  // Mobile navigation
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("iw-nav-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Footer year
  document.getElementById("currentYear").textContent =
    new Date().getFullYear();

  function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "iw-status";

    if (type === "error") {
      statusMessage.classList.add("iw-error");
    } else if (type === "success") {
      statusMessage.classList.add("iw-success");
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";

    const units = ["Bytes", "KB", "MB", "GB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  function getFormatName(type) {
    if (type === "image/jpeg") return "JPG";
    if (type === "image/png") return "PNG";
    if (type === "image/webp") return "WebP";
    return "Unknown";
  }

  function clearConvertedResult() {
    if (convertedObjectUrl) {
      URL.revokeObjectURL(convertedObjectUrl);
      convertedObjectUrl = null;
    }

    convertedPreview.removeAttribute("src");
    convertedPreview.hidden = true;
    previewPlaceholder.hidden = false;

    convertedSize.textContent = "—";
    convertedDimensions.textContent = "—";
    convertedFormat.textContent = "WebP";

    conversionSummary.hidden = true;
    downloadButton.hidden = true;
    downloadButton.removeAttribute("href");
  }

  function setProcessing(processing) {
    isProcessing = processing;
    convertButton.disabled = processing;
    convertButton.textContent = processing ? "Converting..." : "Convert to WebP";
  }

  function updateQualityLabel() {
    qualityValue.textContent = `${qualityInput.value}%`;
  }

  function invalidateOldConversion() {
    if (!currentFile) return;

    clearConvertedResult();

    setStatus("Quality changed. Convert again to apply the new setting.");
  }

  function loadImage(file) {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setStatus("Please select a JPG, PNG, or WebP image.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("The image exceeds the 25 MB file-size limit.", "error");
      return;
    }

    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
      sourceObjectUrl = null;
    }

    clearConvertedResult();

    currentFile = null;
    originalWidth = 0;
    originalHeight = 0;

    sourceObjectUrl = URL.createObjectURL(file);

    const temporaryImage = new Image();

    temporaryImage.onload = () => {
      const width = temporaryImage.naturalWidth;
      const height = temporaryImage.naturalHeight;

      if (!width || !height) {
        URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = null;

        setStatus("The selected image could not be read.", "error");
        return;
      }

      if (width * height > MAX_PIXELS) {
        URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = null;

        setStatus(
          "This image exceeds the 40-megapixel limit. Please select a smaller image.",
          "error"
        );
        return;
      }

      currentFile = file;
      originalWidth = width;
      originalHeight = height;

      originalPreview.src = sourceObjectUrl;

      originalSize.textContent = formatBytes(file.size);
      originalDimensions.textContent = `${width} × ${height} px`;
      originalFormat.textContent = getFormatName(file.type);

      uploadBox.hidden = true;
      editor.hidden = false;

      qualityInput.value = "85";
      updateQualityLabel();

      setStatus("Image loaded. Choose a quality setting and convert to WebP.");

      editor.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    };

    temporaryImage.onerror = () => {
      if (sourceObjectUrl) {
        URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = null;
      }

      currentFile = null;

      setStatus(
        "Unable to open this image. Please try another file.",
        "error"
      );
    };

    temporaryImage.src = sourceObjectUrl;
    imageInput.value = "";
  }

  // File picker
  imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    loadImage(file);
  });

  // Drag and drop
  uploadBox.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadBox.classList.add("iw-dragover");
  });

  uploadBox.addEventListener("dragleave", (event) => {
    if (!uploadBox.contains(event.relatedTarget)) {
      uploadBox.classList.remove("iw-dragover");
    }
  });

  uploadBox.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadBox.classList.remove("iw-dragover");

    const file = event.dataTransfer.files[0];
    if (file) loadImage(file);
  });

  // Change image
  changeImageButton.addEventListener("click", () => {
    imageInput.click();
  });

  // Quality controls
  qualityInput.addEventListener("input", () => {
    updateQualityLabel();
    invalidateOldConversion();
  });

  // Convert image to WebP
  convertButton.addEventListener("click", async () => {
    if (!currentFile || isProcessing) {
      if (!currentFile) {
        setStatus("Please upload an image first.", "error");
      }
      return;
    }

    setProcessing(true);
    clearConvertedResult();
    setStatus("Converting your image to WebP...");

    let canvas = null;

    try {
      // Decode the image again for conversion.
      const image = new Image();
      image.src = sourceObjectUrl;

      await image.decode();

      if (image.naturalWidth !== originalWidth ||
          image.naturalHeight !== originalHeight) {
        throw new Error("The image changed unexpectedly. Please upload it again.");
      }

      if (
        originalWidth > MAX_DIMENSION ||
        originalHeight > MAX_DIMENSION
      ) {
        throw new Error(
          "The image dimensions exceed the supported limit of 12,000 pixels per side."
        );
      }

      canvas = document.createElement("canvas");
      canvas.width = originalWidth;
      canvas.height = originalHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Your browser could not prepare the image for conversion.");
      }

      context.drawImage(image, 0, 0);

      const quality = Number(qualityInput.value) / 100;

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error("The browser failed to create a WebP image."));
              return;
            }

            resolve(result);
          },
          "image/webp",
          quality
        );
      });

      // Check the actual encoded type rather than trusting the requested type.
      if (blob.type !== "image/webp") {
        throw new Error(
          "Your browser does not support WebP encoding. Please try an updated version of Chrome, Edge, Firefox, or Safari."
        );
      }

      convertedObjectUrl = URL.createObjectURL(blob);

      convertedPreview.src = convertedObjectUrl;
      convertedPreview.hidden = false;
      previewPlaceholder.hidden = true;

      convertedSize.textContent = formatBytes(blob.size);
      convertedDimensions.textContent =
        `${originalWidth} × ${originalHeight} px`;
      convertedFormat.textContent = "WebP";

      downloadButton.href = convertedObjectUrl;
      downloadButton.download = "digifox-converted.webp";
      downloadButton.hidden = false;

      const difference = currentFile.size - blob.size;
      const percentage = (difference / currentFile.size) * 100;

      if (difference > 0) {
        summaryTitle.textContent = "Image size reduced!";
        summaryText.textContent =
          `The WebP image is ${formatBytes(difference)} smaller than the original.`;
        savingsBadge.textContent = `${percentage.toFixed(1)}% smaller`;
      } else if (difference < 0) {
        summaryTitle.textContent = "Conversion complete";
        summaryText.textContent =
          `The WebP image is ${formatBytes(Math.abs(difference))} larger than the original.`;
        savingsBadge.textContent =
          `${Math.abs(percentage).toFixed(1)}% larger`;
      } else {
        summaryTitle.textContent = "Conversion complete";
        summaryText.textContent =
          "The converted image is approximately the same size as the original.";
        savingsBadge.textContent = "Same size";
      }

      conversionSummary.hidden = false;

      setStatus("Your WebP image is ready to download.", "success");

      convertedPreview.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    } catch (error) {
      clearConvertedResult();

      setStatus(
        error.message || "Something went wrong during conversion.",
        "error"
      );

    } finally {
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
      }

      setProcessing(false);
    }
  });

  // Release temporary browser resources.
  window.addEventListener("beforeunload", () => {
    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
    }

    if (convertedObjectUrl) {
      URL.revokeObjectURL(convertedObjectUrl);
    }
  });

  updateQualityLabel();
});