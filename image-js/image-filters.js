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

  const filterInputs = {
    brightness: $("brightness"),
    contrast: $("contrast"),
    saturation: $("saturation"),
    grayscale: $("grayscale"),
    sepia: $("sepia"),
    blur: $("blur"),
    hue: $("hue"),
    invert: $("invert")
  };

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_PIXELS = 40_000_000;
  const MAX_DIMENSION = 12000;

  let sourceImage = null;
  let sourceUrl = null;
  let sourceName = "image";
  let renderTimer = null;
  let imageLoadToken = 0;

  const defaults = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
    sepia: 0,
    blur: 0,
    hue: 0,
    invert: false
  };

  const presets = {
    original: { ...defaults },

    vivid: {
      brightness: 105,
      contrast: 115,
      saturation: 145,
      grayscale: 0,
      sepia: 0,
      blur: 0,
      hue: 0,
      invert: false
    },

    warm: {
      brightness: 105,
      contrast: 105,
      saturation: 120,
      grayscale: 0,
      sepia: 25,
      blur: 0,
      hue: 350,
      invert: false
    },

    cool: {
      brightness: 102,
      contrast: 108,
      saturation: 110,
      grayscale: 0,
      sepia: 0,
      blur: 0,
      hue: 195,
      invert: false
    },

    grayscale: {
      brightness: 100,
      contrast: 105,
      saturation: 100,
      grayscale: 100,
      sepia: 0,
      blur: 0,
      hue: 0,
      invert: false
    },

    sepia: {
      brightness: 105,
      contrast: 95,
      saturation: 100,
      grayscale: 0,
      sepia: 85,
      blur: 0,
      hue: 0,
      invert: false
    }
  };

  $("currentYear").textContent = new Date().getFullYear();

  function setError(message = "") {
    errorMessage.textContent = message;
  }

  function getSettings() {
    return {
      brightness: Number(filterInputs.brightness.value),
      contrast: Number(filterInputs.contrast.value),
      saturation: Number(filterInputs.saturation.value),
      grayscale: Number(filterInputs.grayscale.value),
      sepia: Number(filterInputs.sepia.value),
      blur: Number(filterInputs.blur.value),
      hue: Number(filterInputs.hue.value),
      invert: filterInputs.invert.checked
    };
  }

  function updateValueLabels(settings = getSettings()) {
    $("brightnessValue").textContent = `${settings.brightness}%`;
    $("contrastValue").textContent = `${settings.contrast}%`;
    $("saturationValue").textContent = `${settings.saturation}%`;
    $("grayscaleValue").textContent = `${settings.grayscale}%`;
    $("sepiaValue").textContent = `${settings.sepia}%`;
    $("blurValue").textContent = `${settings.blur} px`;
    $("hueValue").textContent = `${settings.hue}°`;
    $("qualityValue").textContent = `${$("quality").value}%`;
  }

  function getFilterString(settings) {
    return [
      `brightness(${settings.brightness}%)`,
      `contrast(${settings.contrast}%)`,
      `saturate(${settings.saturation}%)`,
      `grayscale(${settings.grayscale}%)`,
      `sepia(${settings.sepia}%)`,
      `blur(${settings.blur}px)`,
      `hue-rotate(${settings.hue}deg)`,
      `invert(${settings.invert ? 100 : 0}%)`
    ].join(" ");
  }

  function updateActivePreset() {
    const settings = getSettings();

    let matchingPreset = null;

    for (const [name, preset] of Object.entries(presets)) {
      const matches = Object.keys(defaults).every(
        (key) => settings[key] === preset[key]
      );

      if (matches) {
        matchingPreset = name;
        break;
      }
    }

    document.querySelectorAll(".if-preset").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.preset === matchingPreset
      );
    });
  }

  function updateQualityVisibility() {
    $("qualityField").hidden = $("outputFormat").value === "image/png";
  }

  function renderPreview() {
    clearTimeout(renderTimer);

    renderTimer = setTimeout(() => {
      if (!sourceImage) return;

      try {
        setError("");

        const width = sourceImage.naturalWidth;
        const height = sourceImage.naturalHeight;
        const settings = getSettings();

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        // JPG cannot preserve transparency.
        if ($("outputFormat").value === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.save();
        ctx.filter = getFilterString(settings);
        ctx.drawImage(sourceImage, 0, 0, width, height);
        ctx.restore();

        canvas.style.display = "block";
        placeholder.hidden = true;

        updateValueLabels(settings);
        updateActivePreset();

        imageInfo.textContent =
          `Image: ${width} × ${height} px` +
          ` · Brightness: ${settings.brightness}%` +
          ` · Contrast: ${settings.contrast}%` +
          ` · Saturation: ${settings.saturation}%`;

      } catch (error) {
        console.error("Filter rendering failed:", error);
        setError(
          "Could not apply the filters. Please try another image or a smaller file."
        );
      }
    }, 25);
  }

  function applySettings(settings) {
    for (const key of Object.keys(defaults)) {
      if (key === "invert") {
        filterInputs.invert.checked = Boolean(settings.invert);
      } else {
        filterInputs[key].value = String(settings[key]);
      }
    }

    updateValueLabels(settings);
    updateActivePreset();
    renderPreview();
  }

  function resetFilters() {
    applySettings(defaults);
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
      setError("The image exceeds the 25 MB file size limit.");
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

      uploadCard.hidden = true;
      editor.hidden = false;

      resetFilters();
      updateQualityVisibility();
      renderPreview();
    };

    image.onerror = () => {
      URL.revokeObjectURL(nextUrl);

      if (token === imageLoadToken) {
        setError("Unable to open this image. Please try another file.");
      }
    };

    image.src = nextUrl;
  }

  function downloadImage() {
    if (!sourceImage) {
      setError("Please select an image first.");
      return;
    }

    const format = $("outputFormat").value;

    const extensions = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp"
    };

    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Could not export the image. Please try again.");
            return;
          }

          // Some browsers may fall back to PNG for unsupported formats.
          const actualExtension = blob.type === "image/png"
            ? "png"
            : extensions[format];

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");

          link.href = url;
          link.download = `${sourceName}-filtered.${actualExtension}`;

          document.body.appendChild(link);
          link.click();
          link.remove();

          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setError("");
        },
        format,
        Number($("quality").value) / 100
      );
    } catch (error) {
      console.error("Image export failed:", error);
      setError("Unable to download this image. Please try again.");
    }
  }

  // Upload selection
  imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];

    if (file) loadImage(file);

    // Allow selecting the same file again.
    imageInput.value = "";
  });

  // Update filters as sliders and checkboxes change.
  Object.values(filterInputs).forEach((control) => {
    control.addEventListener("input", renderPreview);
    control.addEventListener("change", renderPreview);
  });

  // Quick presets
  document.querySelectorAll(".if-preset").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = presets[button.dataset.preset];

      if (preset) applySettings(preset);
    });
  });

  $("resetButton").addEventListener("click", resetFilters);
  $("downloadButton").addEventListener("click", downloadImage);

  $("changeImageButton").addEventListener("click", () => {
    imageInput.click();
  });

  $("outputFormat").addEventListener("change", () => {
    updateQualityVisibility();
    renderPreview();
  });

  $("quality").addEventListener("input", () => {
    updateValueLabels();
  });

  // Drag and drop
  ["dragenter", "dragover"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.add("if-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.remove("if-dragging");
    });
  });

  uploadCard.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];

    if (file) loadImage(file);
  });

  updateQualityVisibility();
  updateValueLabels();

  window.addEventListener("beforeunload", () => {
    clearTimeout(renderTimer);

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  });
})();