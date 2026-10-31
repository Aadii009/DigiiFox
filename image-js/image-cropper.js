document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  const uploadBox = document.getElementById("uploadBox");
  const editor = document.getElementById("editor");
  const sourceImage = document.getElementById("sourceImage");
  const aspectRatioSelect = document.getElementById("aspectRatio");
  const outputFormatSelect = document.getElementById("outputFormat");
  const qualityInput = document.getElementById("quality");
  const qualityValue = document.getElementById("qualityValue");
  const qualitySetting = document.getElementById("qualitySetting");
  const statusMessage = document.getElementById("statusMessage");

  const rotateLeftButton = document.getElementById("rotateLeft");
  const rotateRightButton = document.getElementById("rotateRight");
  const resetCropButton = document.getElementById("resetCrop");
  const cropButton = document.getElementById("cropButton");
  const changeImageButton = document.getElementById("changeImageButton");
  const cropAgainButton = document.getElementById("cropAgainButton");

  const result = document.getElementById("result");
  const resultImage = document.getElementById("resultImage");
  const resultDimensions = document.getElementById("resultDimensions");
  const resultSize = document.getElementById("resultSize");
  const resultFormat = document.getElementById("resultFormat");
  const downloadButton = document.getElementById("downloadButton");

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_PIXELS = 40_000_000;
  const MAX_DIMENSION = 12000;

  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  let cropper = null;
  let sourceObjectUrl = null;
  let resultObjectUrl = null;
  let isProcessing = false;

  // Navigation menu
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("ic-nav-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Footer year
  document.getElementById("currentYear").textContent =
    new Date().getFullYear();

  // Display status messages
  function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "ic-status";

    if (type === "error") {
      statusMessage.classList.add("ic-error");
    } else if (type === "success") {
      statusMessage.classList.add("ic-success");
    }
  }

  function setProcessing(processing) {
    isProcessing = processing;
    cropButton.disabled = processing;
    cropButton.textContent = processing ? "Processing..." : "Crop Image";
    cropButton.style.opacity = processing ? "0.7" : "1";
    cropButton.style.cursor = processing ? "wait" : "pointer";
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

  function getExtension(mimeType) {
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/webp") return "webp";
    return "png";
  }

  function getFormatName(mimeType) {
    if (mimeType === "image/jpeg") return "JPG";
    if (mimeType === "image/webp") return "WebP";
    return "PNG";
  }

  function clearResult() {
    result.hidden = true;
    resultImage.removeAttribute("src");
    downloadButton.removeAttribute("href");

    if (resultObjectUrl) {
      URL.revokeObjectURL(resultObjectUrl);
      resultObjectUrl = null;
    }
  }

  function destroyCropper() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  }

  function updateQualityVisibility() {
    const format = outputFormatSelect.value;
    qualitySetting.hidden = format === "image/png";
  }

  function updateQualityLabel() {
    qualityValue.textContent = `${qualityInput.value}%`;
  }

  function updateAspectRatio() {
    if (!cropper) return;

    const selected = aspectRatioSelect.value;
    const ratio = selected === "free" ? NaN : Number(selected);

    cropper.setAspectRatio(ratio);
    setStatus("Crop area updated.");
  }

  function initializeCropper() {
    if (typeof Cropper === "undefined") {
      setStatus(
        "The cropping library could not load. Check your internet connection and refresh the page.",
        "error"
      );
      return;
    }

    destroyCropper();

    cropper = new Cropper(sourceImage, {
      viewMode: 1,
      dragMode: "move",
      aspectRatio: NaN,
      autoCropArea: 0.8,
      responsive: true,
      restore: false,
      guides: true,
      center: true,
      highlight: true,
      background: false,
      movable: true,
      zoomable: true,
      zoomOnWheel: true,
      zoomOnTouch: true,
      rotatable: true,
      scalable: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      minContainerWidth: 200,
      minContainerHeight: 200,
      ready() {
        updateAspectRatio();
        setStatus("Image loaded. Adjust the crop area to get started.");
      }
    });
  }

  function loadImage(file) {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setStatus(
        "Please choose a JPG, PNG, or WebP image.",
        "error"
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus(
        "This image is larger than 25 MB. Please choose a smaller file.",
        "error"
      );
      return;
    }

    clearResult();
    destroyCropper();

    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
      sourceObjectUrl = null;
    }

    sourceObjectUrl = URL.createObjectURL(file);

    sourceImage.onload = () => {
      const width = sourceImage.naturalWidth;
      const height = sourceImage.naturalHeight;

      if (!width || !height) {
        setStatus("This image could not be read. Try another file.", "error");
        URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = null;
        sourceImage.removeAttribute("src");
        return;
      }

      if (width * height > MAX_PIXELS) {
        setStatus(
          "This image exceeds the 40-megapixel limit. Please choose a smaller image.",
          "error"
        );

        URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = null;
        sourceImage.removeAttribute("src");
        editor.hidden = true;
        uploadBox.hidden = false;
        return;
      }

      uploadBox.hidden = true;
      editor.hidden = false;
      clearResult();

      aspectRatioSelect.value = "free";
      outputFormatSelect.value = "image/png";
      qualityInput.value = "92";

      updateQualityLabel();
      updateQualityVisibility();

      initializeCropper();

      editor.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    };

    sourceImage.onerror = () => {
      setStatus("Unable to open this image. Please try another file.", "error");

      if (sourceObjectUrl) {
        URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = null;
      }

      sourceImage.removeAttribute("src");
    };

    sourceImage.src = sourceObjectUrl;
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
    uploadBox.classList.add("ic-dragover");
  });

  uploadBox.addEventListener("dragleave", (event) => {
    if (!uploadBox.contains(event.relatedTarget)) {
      uploadBox.classList.remove("ic-dragover");
    }
  });

  uploadBox.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadBox.classList.remove("ic-dragover");

    const file = event.dataTransfer.files[0];
    if (file) loadImage(file);
  });

  // Change image
  changeImageButton.addEventListener("click", () => {
    imageInput.click();
  });

  // Aspect ratio
  aspectRatioSelect.addEventListener("change", updateAspectRatio);

  // Rotate
  rotateLeftButton.addEventListener("click", () => {
    if (!cropper) return;
    cropper.rotate(-90);
    setStatus("Image rotated left.");
  });

  rotateRightButton.addEventListener("click", () => {
    if (!cropper) return;
    cropper.rotate(90);
    setStatus("Image rotated right.");
  });

  // Reset crop selection
  resetCropButton.addEventListener("click", () => {
    if (!cropper) return;

    cropper.reset();
    aspectRatioSelect.value = "free";
    cropper.setAspectRatio(NaN);
    setStatus("Crop selection reset.");
  });

  // Output format
  outputFormatSelect.addEventListener("change", () => {
    updateQualityVisibility();
    setStatus("Output settings updated. Crop again to apply them.");
  });

  qualityInput.addEventListener("input", updateQualityLabel);

  qualityInput.addEventListener("change", () => {
    setStatus("Quality updated. Crop again to apply the new setting.");
  });

  // Crop and export
  cropButton.addEventListener("click", () => {
    if (!cropper || isProcessing) return;

    const cropData = cropper.getData(true);

    if (
      !cropData.width ||
      !cropData.height ||
      cropData.width < 1 ||
      cropData.height < 1
    ) {
      setStatus("Please select a valid crop area.", "error");
      return;
    }

    if (
      cropData.width > MAX_DIMENSION ||
      cropData.height > MAX_DIMENSION
    ) {
      setStatus(
        "The selected crop is too large to export. Reduce the crop area and try again.",
        "error"
      );
      return;
    }

    const outputType = outputFormatSelect.value;
    const quality = Number(qualityInput.value) / 100;

    setProcessing(true);
    setStatus("Cropping your image...");

    try {
      const canvas = cropper.getCroppedCanvas({
        maxWidth: MAX_DIMENSION,
        maxHeight: MAX_DIMENSION,
        fillColor: outputType === "image/jpeg" ? "#ffffff" : "transparent",
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high"
      });

      if (!canvas) {
        throw new Error("Could not create the cropped image.");
      }

      if (
        canvas.width < 1 ||
        canvas.height < 1 ||
        canvas.width * canvas.height > MAX_PIXELS
      ) {
        throw new Error(
          "The cropped image is too large to export. Reduce the crop area."
        );
      }

      canvas.toBlob(
        (blob) => {
          setProcessing(false);

          if (!blob) {
            setStatus(
              "Image export failed. Try a different format or smaller crop.",
              "error"
            );
            return;
          }

          // Some browsers may not support the requested encoder.
          if (blob.type !== outputType) {
            setStatus(
              "Your browser could not export that format. Try PNG or JPG.",
              "error"
            );
            return;
          }

          clearResult();

          resultObjectUrl = URL.createObjectURL(blob);
          resultImage.src = resultObjectUrl;

          resultDimensions.textContent =
            `${canvas.width} × ${canvas.height} px`;

          resultSize.textContent = formatBytes(blob.size);
          resultFormat.textContent = getFormatName(outputType);

          downloadButton.href = resultObjectUrl;
          downloadButton.download =
            `digifox-cropped-image.${getExtension(outputType)}`;

          result.hidden = false;

          setStatus("Your cropped image is ready to download.", "success");

          result.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

          // Release the canvas backing store after the blob is created.
          canvas.width = 1;
          canvas.height = 1;
        },
        outputType,
        outputType === "image/png" ? undefined : quality
      );
    } catch (error) {
      setProcessing(false);
      setStatus(
        error.message || "Something went wrong while cropping the image.",
        "error"
      );
    }
  });

  // Return to the crop editor to make adjustments.
  cropAgainButton.addEventListener("click", () => {
    result.hidden = true;

    editor.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  // Release temporary object URLs when leaving the page.
  window.addEventListener("beforeunload", () => {
    destroyCropper();

    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
    }

    if (resultObjectUrl) {
      URL.revokeObjectURL(resultObjectUrl);
    }
  });

  // Initial state
  updateQualityLabel();
  updateQualityVisibility();
});