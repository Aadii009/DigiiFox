"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const imageInput = $("imageInput");
  const uploadCard = $("uploadCard");
  const editor = $("editor");
  const canvas = $("previewCanvas");
  const ctx = canvas.getContext("2d");
  const placeholder = $("previewPlaceholder");
  const errorMessage = $("errorMessage");
  const imageInfo = $("imageInfo");

  const radiusInput = $("radius");
  const backgroundColorInput = $("backgroundColor");
  const backgroundColorText = $("backgroundColorText");
  const transparentCornersInput = $("transparentCorners");
  const outputFormatInput = $("outputFormat");
  const qualityInput = $("quality");

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_PIXELS = 40_000_000;
  const MAX_DIMENSION = 12000;

  let sourceImage = null;
  let sourceUrl = null;
  let sourceName = "image";
  let renderTimer = null;
  let imageLoadToken = 0;

  $("currentYear").textContent = new Date().getFullYear();

  function setError(message = "") {
    errorMessage.textContent = message;
  }

  function isValidHex(value) {
    return /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));

    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - r,
      y + height
    );
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function updateQualityVisibility() {
    $("qualityField").hidden = outputFormatInput.value === "image/png";
  }

  function updatePreview() {
    clearTimeout(renderTimer);

    renderTimer = setTimeout(() => {
      if (!sourceImage) return;

      try {
        setError("");

        const width = sourceImage.naturalWidth;
        const height = sourceImage.naturalHeight;
        const requestedRadius = Number(radiusInput.value);
        const maxRadius = Math.floor(Math.min(width, height) / 2);
        const radius = Math.min(requestedRadius, maxRadius);

        const backgroundColor = backgroundColorInput.value;
        const transparentCorners = transparentCornersInput.checked;

        const format = outputFormatInput.value;

        // JPG cannot store transparency, so always use a solid background.
        const useTransparentCorners =
          transparentCorners && format !== "image/jpeg";

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        if (!useTransparentCorners) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, width, height);
        }

        ctx.save();

        roundedRectPath(ctx, 0, 0, width, height, radius);
        ctx.clip();

        ctx.drawImage(sourceImage, 0, 0, width, height);

        ctx.restore();

        radiusInput.max = String(Math.max(0, maxRadius));

        $("radiusValue").textContent = `${radius} px`;
        $("qualityValue").textContent = `${qualityInput.value}%`;

        canvas.style.display = "block";
        placeholder.hidden = true;

        const transparencyText = useTransparentCorners
          ? "Transparent corners enabled"
          : "Solid background";

        imageInfo.textContent =
          `Image: ${width} × ${height} px` +
          ` · Corner radius: ${radius} px` +
          ` · ${transparencyText}`;

      } catch (error) {
        console.error("Preview rendering failed:", error);
        setError("Could not create the preview. Please try another image.");
      }
    }, 25);
  }

  function loadImage(file) {
    if (!file) return;

    const token = ++imageLoadToken;

    setError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPG, PNG or WebP image.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty. Please choose another image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The image exceeds the maximum file size of 25 MB.");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (token !== imageLoadToken) {
        URL.revokeObjectURL(nextUrl);
        return;
      }

      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (
        !width ||
        !height ||
        width * height > MAX_PIXELS ||
        width > MAX_DIMENSION ||
        height > MAX_DIMENSION
      ) {
        URL.revokeObjectURL(nextUrl);
        setError(
          "This image is too large. Use an image up to 40 megapixels and 12,000 pixels per side."
        );
        return;
      }

      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }

      sourceUrl = nextUrl;
      sourceImage = image;
      sourceName = file.name.replace(/\.[^.]+$/, "") || "image";

      // Adjust the slider maximum for this image.
      radiusInput.max = String(Math.floor(Math.min(width, height) / 2));

      // Keep the default radius within the supported range.
      radiusInput.value = String(
        Math.min(60, Number(radiusInput.max))
      );

      uploadCard.hidden = true;
      editor.hidden = false;

      updateQualityVisibility();
      updatePreview();
    };

    image.onerror = () => {
      URL.revokeObjectURL(nextUrl);

      if (token === imageLoadToken) {
        setError("Unable to open this image. Please try another file.");
      }
    };

    image.src = nextUrl;
  }

  function updateBackgroundColorFromPicker() {
    backgroundColorText.value = backgroundColorInput.value;
    backgroundColorText.setCustomValidity("");
    updatePreview();
  }

  function updateBackgroundColorFromText() {
    const value = backgroundColorText.value.trim();

    if (!isValidHex(value)) {
      backgroundColorText.setCustomValidity(
        "Enter a valid six-digit hexadecimal color, such as #ffffff."
      );
      setError("Please enter a valid background color, such as #ffffff.");
      return;
    }

    backgroundColorText.setCustomValidity("");
    backgroundColorInput.value = value;
    setError("");
    updatePreview();
  }

  function resetSettings() {
    if (!sourceImage) return;

    radiusInput.value = String(
      Math.min(60, Number(radiusInput.max))
    );

    backgroundColorInput.value = "#ffffff";
    backgroundColorText.value = "#ffffff";
    transparentCornersInput.checked = true;
    outputFormatInput.value = "image/png";
    qualityInput.value = "92";

    backgroundColorText.setCustomValidity("");

    updateQualityVisibility();
    updatePreview();
  }

  function downloadImage() {
    if (!sourceImage) {
      setError("Please select an image first.");
      return;
    }

    if (!isValidHex(backgroundColorText.value.trim())) {
      setError("Please enter a valid six-digit background color.");
      return;
    }

    const format = outputFormatInput.value;

    const extensionMap = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp"
    };

    const extension = extensionMap[format];

    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Could not export the image. Please try again.");
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");

          link.href = url;
          link.download = `${sourceName}-rounded.${extension}`;

          document.body.appendChild(link);
          link.click();
          link.remove();

          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setError("");
        },
        format,
        Number(qualityInput.value) / 100
      );
    } catch (error) {
      console.error("Image export failed:", error);
      setError("Unable to export this image. Please try again.");
    }
  }

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];

    if (file) loadImage(file);

    // Permit selecting the same file again.
    imageInput.value = "";
  });

  radiusInput.addEventListener("input", updatePreview);

  backgroundColorInput.addEventListener(
    "input",
    updateBackgroundColorFromPicker
  );

  backgroundColorText.addEventListener(
    "input",
    updateBackgroundColorFromText
  );

  transparentCornersInput.addEventListener("change", updatePreview);

  outputFormatInput.addEventListener("change", () => {
    updateQualityVisibility();
    updatePreview();
  });

  qualityInput.addEventListener("input", () => {
    $("qualityValue").textContent = `${qualityInput.value}%`;
  });

  $("resetButton").addEventListener("click", resetSettings);
  $("downloadButton").addEventListener("click", downloadImage);

  $("changeImageButton").addEventListener("click", () => {
    imageInput.click();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.add("irc-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.remove("irc-dragging");
    });
  });

  uploadCard.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];

    if (file) loadImage(file);
  });

  updateQualityVisibility();

  window.addEventListener("beforeunload", () => {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  });
})();