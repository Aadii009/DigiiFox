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

  const thicknessInput = $("thickness");
  const borderColorInput = $("borderColor");
  const borderColorText = $("borderColorText");
  const backgroundColorInput = $("backgroundColor");
  const backgroundColorText = $("backgroundColorText");
  const cornerRadiusInput = $("cornerRadius");
  const borderStyleInput = $("borderStyle");
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

  function validHex(value) {
    return /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function updateColorFromPicker(picker, textInput) {
    textInput.value = picker.value;
    renderPreview();
  }

  function updateColorFromText(textInput, picker) {
    const value = textInput.value.trim();

    if (validHex(value)) {
      picker.value = value;
      textInput.setCustomValidity("");
      renderPreview();
    } else {
      textInput.setCustomValidity(
        "Enter a valid six-digit hexadecimal color, such as #2878d0."
      );
    }
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.max(
      0,
      Math.min(radius, width / 2, height / 2)
    );

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

  function drawImageWithRoundedCorners(
    context,
    image,
    x,
    y,
    width,
    height,
    radius
  ) {
    context.save();
    roundedRectPath(context, x, y, width, height, radius);
    context.clip();
    context.drawImage(image, x, y, width, height);
    context.restore();
  }

  function renderPreview() {
    clearTimeout(renderTimer);

    renderTimer = setTimeout(() => {
      if (!sourceImage) return;

      try {
        setError("");

        const thickness = Number(thicknessInput.value);
        const cornerRadius = Number(cornerRadiusInput.value);
        const borderColor = borderColorInput.value;
        const backgroundColor = backgroundColorInput.value;
        const style = borderStyleInput.value;

        const outputWidth = sourceImage.naturalWidth + thickness * 2;
        const outputHeight = sourceImage.naturalHeight + thickness * 2;

        if (
          outputWidth > MAX_DIMENSION ||
          outputHeight > MAX_DIMENSION ||
          outputWidth * outputHeight > MAX_PIXELS
        ) {
          setError(
            "The selected border makes the output too large. Reduce the border thickness or use a smaller image."
          );
          return;
        }

        canvas.width = outputWidth;
        canvas.height = outputHeight;

        ctx.clearRect(0, 0, outputWidth, outputHeight);

        // Background fills the complete canvas, including the image area.
        // This also ensures that rounded corners have a consistent color.
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, outputWidth, outputHeight);

        const innerRadius = Math.max(0, cornerRadius - thickness);

        drawImageWithRoundedCorners(
          ctx,
          sourceImage,
          thickness,
          thickness,
          sourceImage.naturalWidth,
          sourceImage.naturalHeight,
          innerRadius
        );

        if (thickness > 0) {
          ctx.save();
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = thickness;

          if (style === "dashed") {
            ctx.setLineDash([thickness * 2, thickness * 1.25]);
          } else if (style === "dotted") {
            ctx.setLineDash([Math.max(1, thickness * 0.15), thickness * 1.15]);
            ctx.lineCap = "round";
          }

          const half = thickness / 2;
          const outerRadius = Math.min(
            cornerRadius,
            outputWidth / 2,
            outputHeight / 2
          );

          roundedRectPath(
            ctx,
            half,
            half,
            outputWidth - thickness,
            outputHeight - thickness,
            Math.max(0, outerRadius - half)
          );

          ctx.stroke();
          ctx.restore();
        }

        placeholder.hidden = true;
        canvas.style.display = "block";

        $("thicknessValue").textContent = `${thickness} px`;
        $("cornerValue").textContent = `${cornerRadius} px`;
        $("qualityValue").textContent = `${qualityInput.value}%`;

        imageInfo.textContent =
          `Original: ${sourceImage.naturalWidth} × ${sourceImage.naturalHeight} px` +
          ` · Output: ${outputWidth} × ${outputHeight} px` +
          ` · Border: ${thickness} px`;

      } catch (error) {
        console.error("Preview rendering failed:", error);
        setError("Could not render this image. Please try another file.");
      }
    }, 30);
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

    if (file.size > MAX_FILE_SIZE) {
      setError("Your image exceeds the 25 MB file size limit.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty. Please choose another image.");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (token !== imageLoadToken) {
        URL.revokeObjectURL(nextUrl);
        return;
      }

      if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        image.naturalWidth * image.naturalHeight > MAX_PIXELS
      ) {
        URL.revokeObjectURL(nextUrl);
        setError("This image is too large. The maximum is 40 megapixels.");
        return;
      }

      if (
        image.naturalWidth > MAX_DIMENSION ||
        image.naturalHeight > MAX_DIMENSION
      ) {
        URL.revokeObjectURL(nextUrl);
        setError("Image dimensions cannot exceed 12,000 pixels per side.");
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
      canvas.style.display = "block";
      placeholder.hidden = true;

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

  function resetSettings() {
    thicknessInput.value = "20";
    borderColorInput.value = "#2878d0";
    borderColorText.value = "#2878d0";
    backgroundColorInput.value = "#ffffff";
    backgroundColorText.value = "#ffffff";
    cornerRadiusInput.value = "0";
    borderStyleInput.value = "solid";
    outputFormatInput.value = "image/png";
    qualityInput.value = "92";

    borderColorText.setCustomValidity("");
    backgroundColorText.setCustomValidity("");

    updateQualityVisibility();
    renderPreview();
  }

  function updateQualityVisibility() {
    const format = outputFormatInput.value;
    $("qualityField").hidden = format === "image/png";
  }

  function downloadImage() {
    if (!sourceImage) {
      setError("Please select an image first.");
      return;
    }

    if (
      !validHex(borderColorText.value.trim()) ||
      !validHex(backgroundColorText.value.trim())
    ) {
      setError("Please enter valid six-digit hexadecimal color codes.");
      return;
    }

    const format = outputFormatInput.value;
    const extension = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp"
    }[format];

    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Could not create the download. Please try again.");
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");

          link.href = url;
          link.download = `${sourceName}-bordered.${extension}`;

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
      console.error("Download failed:", error);
      setError(
        "Could not export this image. Try reducing its dimensions or using another format."
      );
    }
  }

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) loadImage(file);

    // Allows selecting the same file again.
    imageInput.value = "";
  });

  [
    thicknessInput,
    cornerRadiusInput,
    borderStyleInput,
    outputFormatInput,
    qualityInput
  ].forEach((control) => {
    control.addEventListener("input", () => {
      updateQualityVisibility();
      renderPreview();
    });

    control.addEventListener("change", () => {
      updateQualityVisibility();
      renderPreview();
    });
  });

  borderColorInput.addEventListener("input", () => {
    updateColorFromPicker(borderColorInput, borderColorText);
  });

  backgroundColorInput.addEventListener("input", () => {
    updateColorFromPicker(backgroundColorInput, backgroundColorText);
  });

  borderColorText.addEventListener("input", () => {
    updateColorFromText(borderColorText, borderColorInput);
  });

  backgroundColorText.addEventListener("input", () => {
    updateColorFromText(backgroundColorText, backgroundColorInput);
  });

  $("resetButton").addEventListener("click", resetSettings);
  $("downloadButton").addEventListener("click", downloadImage);

  $("changeImageButton").addEventListener("click", () => {
    imageInput.click();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.add("ibm-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.remove("ibm-dragging");
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
})();"use strict";

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

  const thicknessInput = $("thickness");
  const borderColorInput = $("borderColor");
  const borderColorText = $("borderColorText");
  const backgroundColorInput = $("backgroundColor");
  const backgroundColorText = $("backgroundColorText");
  const cornerRadiusInput = $("cornerRadius");
  const borderStyleInput = $("borderStyle");
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

  function validHex(value) {
    return /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function updateColorFromPicker(picker, textInput) {
    textInput.value = picker.value;
    renderPreview();
  }

  function updateColorFromText(textInput, picker) {
    const value = textInput.value.trim();

    if (validHex(value)) {
      picker.value = value;
      textInput.setCustomValidity("");
      renderPreview();
    } else {
      textInput.setCustomValidity(
        "Enter a valid six-digit hexadecimal color, such as #2878d0."
      );
    }
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.max(
      0,
      Math.min(radius, width / 2, height / 2)
    );

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

  function drawImageWithRoundedCorners(
    context,
    image,
    x,
    y,
    width,
    height,
    radius
  ) {
    context.save();
    roundedRectPath(context, x, y, width, height, radius);
    context.clip();
    context.drawImage(image, x, y, width, height);
    context.restore();
  }

  function renderPreview() {
    clearTimeout(renderTimer);

    renderTimer = setTimeout(() => {
      if (!sourceImage) return;

      try {
        setError("");

        const thickness = Number(thicknessInput.value);
        const cornerRadius = Number(cornerRadiusInput.value);
        const borderColor = borderColorInput.value;
        const backgroundColor = backgroundColorInput.value;
        const style = borderStyleInput.value;

        const outputWidth = sourceImage.naturalWidth + thickness * 2;
        const outputHeight = sourceImage.naturalHeight + thickness * 2;

        if (
          outputWidth > MAX_DIMENSION ||
          outputHeight > MAX_DIMENSION ||
          outputWidth * outputHeight > MAX_PIXELS
        ) {
          setError(
            "The selected border makes the output too large. Reduce the border thickness or use a smaller image."
          );
          return;
        }

        canvas.width = outputWidth;
        canvas.height = outputHeight;

        ctx.clearRect(0, 0, outputWidth, outputHeight);

        // Background fills the complete canvas, including the image area.
        // This also ensures that rounded corners have a consistent color.
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, outputWidth, outputHeight);

        const innerRadius = Math.max(0, cornerRadius - thickness);

        drawImageWithRoundedCorners(
          ctx,
          sourceImage,
          thickness,
          thickness,
          sourceImage.naturalWidth,
          sourceImage.naturalHeight,
          innerRadius
        );

        if (thickness > 0) {
          ctx.save();
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = thickness;

          if (style === "dashed") {
            ctx.setLineDash([thickness * 2, thickness * 1.25]);
          } else if (style === "dotted") {
            ctx.setLineDash([Math.max(1, thickness * 0.15), thickness * 1.15]);
            ctx.lineCap = "round";
          }

          const half = thickness / 2;
          const outerRadius = Math.min(
            cornerRadius,
            outputWidth / 2,
            outputHeight / 2
          );

          roundedRectPath(
            ctx,
            half,
            half,
            outputWidth - thickness,
            outputHeight - thickness,
            Math.max(0, outerRadius - half)
          );

          ctx.stroke();
          ctx.restore();
        }

        placeholder.hidden = true;
        canvas.style.display = "block";

        $("thicknessValue").textContent = `${thickness} px`;
        $("cornerValue").textContent = `${cornerRadius} px`;
        $("qualityValue").textContent = `${qualityInput.value}%`;

        imageInfo.textContent =
          `Original: ${sourceImage.naturalWidth} × ${sourceImage.naturalHeight} px` +
          ` · Output: ${outputWidth} × ${outputHeight} px` +
          ` · Border: ${thickness} px`;

      } catch (error) {
        console.error("Preview rendering failed:", error);
        setError("Could not render this image. Please try another file.");
      }
    }, 30);
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

    if (file.size > MAX_FILE_SIZE) {
      setError("Your image exceeds the 25 MB file size limit.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty. Please choose another image.");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (token !== imageLoadToken) {
        URL.revokeObjectURL(nextUrl);
        return;
      }

      if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        image.naturalWidth * image.naturalHeight > MAX_PIXELS
      ) {
        URL.revokeObjectURL(nextUrl);
        setError("This image is too large. The maximum is 40 megapixels.");
        return;
      }

      if (
        image.naturalWidth > MAX_DIMENSION ||
        image.naturalHeight > MAX_DIMENSION
      ) {
        URL.revokeObjectURL(nextUrl);
        setError("Image dimensions cannot exceed 12,000 pixels per side.");
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
      canvas.style.display = "block";
      placeholder.hidden = true;

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

  function resetSettings() {
    thicknessInput.value = "20";
    borderColorInput.value = "#2878d0";
    borderColorText.value = "#2878d0";
    backgroundColorInput.value = "#ffffff";
    backgroundColorText.value = "#ffffff";
    cornerRadiusInput.value = "0";
    borderStyleInput.value = "solid";
    outputFormatInput.value = "image/png";
    qualityInput.value = "92";

    borderColorText.setCustomValidity("");
    backgroundColorText.setCustomValidity("");

    updateQualityVisibility();
    renderPreview();
  }

  function updateQualityVisibility() {
    const format = outputFormatInput.value;
    $("qualityField").hidden = format === "image/png";
  }

  function downloadImage() {
    if (!sourceImage) {
      setError("Please select an image first.");
      return;
    }

    if (
      !validHex(borderColorText.value.trim()) ||
      !validHex(backgroundColorText.value.trim())
    ) {
      setError("Please enter valid six-digit hexadecimal color codes.");
      return;
    }

    const format = outputFormatInput.value;
    const extension = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp"
    }[format];

    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Could not create the download. Please try again.");
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");

          link.href = url;
          link.download = `${sourceName}-bordered.${extension}`;

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
      console.error("Download failed:", error);
      setError(
        "Could not export this image. Try reducing its dimensions or using another format."
      );
    }
  }

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) loadImage(file);

    // Allows selecting the same file again.
    imageInput.value = "";
  });

  [
    thicknessInput,
    cornerRadiusInput,
    borderStyleInput,
    outputFormatInput,
    qualityInput
  ].forEach((control) => {
    control.addEventListener("input", () => {
      updateQualityVisibility();
      renderPreview();
    });

    control.addEventListener("change", () => {
      updateQualityVisibility();
      renderPreview();
    });
  });

  borderColorInput.addEventListener("input", () => {
    updateColorFromPicker(borderColorInput, borderColorText);
  });

  backgroundColorInput.addEventListener("input", () => {
    updateColorFromPicker(backgroundColorInput, backgroundColorText);
  });

  borderColorText.addEventListener("input", () => {
    updateColorFromText(borderColorText, borderColorInput);
  });

  backgroundColorText.addEventListener("input", () => {
    updateColorFromText(backgroundColorText, backgroundColorInput);
  });

  $("resetButton").addEventListener("click", resetSettings);
  $("downloadButton").addEventListener("click", downloadImage);

  $("changeImageButton").addEventListener("click", () => {
    imageInput.click();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.add("ibm-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadCard.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadCard.classList.remove("ibm-dragging");
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