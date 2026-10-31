"use strict";

const icm = {
  fileInput: document.getElementById("icm-file-input"),
  dropzone: document.getElementById("icm-dropzone"),
  status: document.getElementById("icm-status"),
  columns: document.getElementById("icm-columns"),
  ratio: document.getElementById("icm-ratio"),
  spacing: document.getElementById("icm-spacing"),
  spacingValue: document.getElementById("icm-spacing-value"),
  radius: document.getElementById("icm-radius"),
  radiusValue: document.getElementById("icm-radius-value"),
  background: document.getElementById("icm-background"),
  backgroundValue: document.getElementById("icm-background-value"),
  format: document.getElementById("icm-format"),
  quality: document.getElementById("icm-quality"),
  qualityValue: document.getElementById("icm-quality-value"),
  qualityField: document.getElementById("icm-quality-field"),
  create: document.getElementById("icm-create"),
  reset: document.getElementById("icm-reset"),
  download: document.getElementById("icm-download"),
  canvas: document.getElementById("icm-canvas"),
  emptyPreview: document.getElementById("icm-empty-preview"),
  previewMeta: document.getElementById("icm-preview-meta"),
  photoList: document.getElementById("icm-photo-list"),
  photoCount: document.getElementById("icm-photo-count"),
  year: document.getElementById("icm-year")
};

const ICM_MAX_FILES = 15;
const ICM_MAX_FILE_SIZE = 15 * 1024 * 1024;
const ICM_MAX_IMAGE_DIMENSION = 12000;
const ICM_MAX_PIXELS = 40_000_000;
const ICM_MAX_OUTPUT_DIMENSION = 2400;

let icmPhotos = [];
let icmNextId = 1;
let icmPreviewIsCurrent = false;
let icmRenderToken = 0;

icm.year.textContent = new Date().getFullYear();

function icmSetStatus(message, isError = false) {
  icm.status.textContent = message;
  icm.status.classList.toggle("icm-error", isError);
}

function icmFormatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function icmInvalidatePreview(message = "Settings changed. Create the collage again to update the preview.") {
  icmRenderToken++;
  icmPreviewIsCurrent = false;
  icm.download.disabled = true;

  if (icmPhotos.length >= 2) {
    icm.create.disabled = false;
    icm.previewMeta.textContent = message;
  } else {
    icm.create.disabled = true;
    icm.canvas.hidden = true;
    icm.emptyPreview.hidden = false;
    icm.previewMeta.textContent = "No collage created yet.";
  }
}

function icmUpdateControls() {
  icm.spacingValue.textContent = `${icm.spacing.value} px`;
  icm.radiusValue.textContent = `${icm.radius.value} px`;
  icm.backgroundValue.textContent = icm.background.value.toUpperCase();
  icm.qualityValue.textContent = `${icm.quality.value}%`;

  const isLossy = icm.format.value !== "image/png";
  icm.qualityField.hidden = !isLossy;
}

function icmLoadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (
        !width ||
        !height ||
        width > ICM_MAX_IMAGE_DIMENSION ||
        height > ICM_MAX_IMAGE_DIMENSION ||
        width * height > ICM_MAX_PIXELS
      ) {
        URL.revokeObjectURL(url);
        reject(new Error(
          `"${file.name}" is too large in dimensions. Use an image no larger than 12,000 px per side and 40 megapixels.`
        ));
        return;
      }

      resolve({
        id: icmNextId++,
        file,
        url,
        image,
        width,
        height
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`The image "${file.name}" could not be opened. Try another image format.`));
    };

    image.src = url;
  });
}

async function icmAddFiles(fileList) {
  const selectedFiles = Array.from(fileList || []);

  if (!selectedFiles.length) return;

  let added = 0;
  const errors = [];

  for (const file of selectedFiles) {
    if (icmPhotos.length >= ICM_MAX_FILES) {
      errors.push(`You can add up to ${ICM_MAX_FILES} photos.`);
      break;
    }

    if (!file.type.startsWith("image/")) {
      errors.push(`"${file.name}" is not a supported image file.`);
      continue;
    }

    if (file.size > ICM_MAX_FILE_SIZE) {
      errors.push(`"${file.name}" exceeds the 15 MB file-size limit.`);
      continue;
    }

    try {
      const photo = await icmLoadImage(file);
      icmPhotos.push(photo);
      added++;
    } catch (error) {
      errors.push(error.message);
    }
  }

  icmRenderPhotoList();
  icmInvalidatePreview();

  if (errors.length) {
    const shownErrors = errors.slice(0, 3).join(" ");
    const remaining = errors.length > 3
      ? ` And ${errors.length - 3} more issue(s).`
      : "";

    icmSetStatus(
      `${added} photo(s) added. ${shownErrors}${remaining}`,
      added === 0
    );
  } else if (added > 0) {
    icmSetStatus(
      `${added} photo(s) added. ${icmPhotos.length} photo(s) ready in total.`
    );
  }

  if (icmPhotos.length < 2) {
    icmSetStatus(
      icmPhotos.length === 1
        ? "Add at least one more photo to create a collage."
        : "Add at least two images to begin."
    );
  }
}

function icmRenderPhotoList() {
  icm.photoList.replaceChildren();

  icm.photoCount.textContent =
    `${icmPhotos.length} ${icmPhotos.length === 1 ? "photo" : "photos"}`;

  if (!icmPhotos.length) {
    const empty = document.createElement("p");
    empty.className = "icm-photo-empty";
    empty.textContent = "Your selected photos will appear here.";
    icm.photoList.appendChild(empty);
    return;
  }

  icmPhotos.forEach((photo, index) => {
    const item = document.createElement("article");
    item.className = "icm-photo-item";

    const thumbnail = document.createElement("img");
    thumbnail.src = photo.url;
    thumbnail.alt = `Selected photo ${index + 1}`;

    const name = document.createElement("p");
    name.className = "icm-photo-name";
    name.title = photo.file.name;
    name.textContent = `${index + 1}. ${photo.file.name}`;

    const size = document.createElement("p");
    size.className = "icm-photo-name";
    size.textContent = `${photo.width} × ${photo.height} · ${icmFormatSize(photo.file.size)}`;

    const actions = document.createElement("div");
    actions.className = "icm-photo-actions";

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.textContent = "↑";
    upButton.title = "Move photo up";
    upButton.setAttribute("aria-label", `Move ${photo.file.name} up`);
    upButton.disabled = index === 0;
    upButton.addEventListener("click", () => icmMovePhoto(index, -1));

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.textContent = "↓";
    downButton.title = "Move photo down";
    downButton.setAttribute("aria-label", `Move ${photo.file.name} down`);
    downButton.disabled = index === icmPhotos.length - 1;
    downButton.addEventListener("click", () => icmMovePhoto(index, 1));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icm-remove-photo";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${photo.file.name}`);
    removeButton.addEventListener("click", () => icmRemovePhoto(index));

    actions.append(upButton, downButton, removeButton);
    item.append(thumbnail, name, size, actions);
    icm.photoList.appendChild(item);
  });
}

function icmMovePhoto(index, direction) {
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= icmPhotos.length) return;

  [icmPhotos[index], icmPhotos[newIndex]] =
    [icmPhotos[newIndex], icmPhotos[index]];

  icmRenderPhotoList();
  icmInvalidatePreview();
  icmSetStatus("Photo order updated. Create the collage to apply the changes.");
}

function icmRemovePhoto(index) {
  const [removed] = icmPhotos.splice(index, 1);

  if (removed) {
    URL.revokeObjectURL(removed.url);
  }

  icmRenderPhotoList();
  icmInvalidatePreview();

  icmSetStatus(
    icmPhotos.length >= 2
      ? "Photo removed. Create the collage to update your preview."
      : "Add at least two images to begin."
  );
}

function icmGetCanvasSize(photoCount, columns) {
  const rows = Math.ceil(photoCount / columns);
  const ratio = icm.ratio.value;

  let width;
  let height;

  if (ratio === "landscape") {
    width = 1800;
    height = 1350;
  } else if (ratio === "wide") {
    width = 1920;
    height = 1080;
  } else if (ratio === "portrait") {
    width = 1350;
    height = 1800;
  } else {
    width = 1600;
    height = 1600;
  }

  // Keep each grid cell large enough for the selected layout.
  const spacing = Number(icm.spacing.value);
  const usableWidth = width - spacing * (columns + 1);
  const usableHeight = height - spacing * (rows + 1);

  if (usableWidth <= 0 || usableHeight <= 0) {
    throw new Error("The spacing is too large for this layout.");
  }

  return { width, height, columns, rows, spacing };
}

function icmDrawRoundedImage(ctx, image, x, y, width, height, radius) {
  const safeRadius = Math.max(
    0,
    Math.min(radius, width / 2, height / 2)
  );

  // Crop the image from the center to fill the cell without distortion.
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else if (sourceRatio < targetRatio) {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.save();
  ctx.beginPath();

  if (safeRadius > 0) {
    ctx.roundRect(x, y, width, height, safeRadius);
  } else {
    ctx.rect(x, y, width, height);
  }

  ctx.clip();
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  ctx.restore();
}

async function icmCreateCollage() {
  if (icmPhotos.length < 2) {
    icmSetStatus("Please add at least two photos first.", true);
    return;
  }

  const token = ++icmRenderToken;
  icm.create.disabled = true;
  icm.download.disabled = true;
  icmPreviewIsCurrent = false;

  icmSetStatus("Creating your collage...");
  icm.previewMeta.textContent = "Rendering your collage...";

  // Allow the browser to display the status before drawing.
  await new Promise(resolve => requestAnimationFrame(resolve));

  if (token !== icmRenderToken) return;

  try {
    const columns = Number(icm.columns.value);
    const layout = icmGetCanvasSize(icmPhotos.length, columns);
    const { width, height, rows, spacing } = layout;

    const canvas = icm.canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas is not available in this browser.");
    }

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = icm.background.value;
    ctx.fillRect(0, 0, width, height);

    const cellWidth = (width - spacing * (columns + 1)) / columns;
    const cellHeight = (height - spacing * (rows + 1)) / rows;

    const radius = Number(icm.radius.value) * (width / 1600);

    for (let i = 0; i < icmPhotos.length; i++) {
      if (token !== icmRenderToken) return;

      const photo = icmPhotos[i];
      const col = i % columns;
      const row = Math.floor(i / columns);

      const x = spacing + col * (cellWidth + spacing);
      const y = spacing + row * (cellHeight + spacing);

      icmDrawRoundedImage(
        ctx,
        photo.image,
        x,
        y,
        cellWidth,
        cellHeight,
        radius
      );
    }

    if (token !== icmRenderToken) return;

    icm.emptyPreview.hidden = true;
    canvas.hidden = false;
    icmPreviewIsCurrent = true;
    icm.download.disabled = false;

    icm.previewMeta.textContent =
      `${width} × ${height} pixels · ${icmPhotos.length} photos · ${columns} columns`;

    icmSetStatus("Your collage is ready to download.");
  } catch (error) {
    console.error("Collage creation failed:", error);
    icmSetStatus(
      error.message || "Could not create the collage. Try fewer or smaller images.",
      true
    );
    icm.previewMeta.textContent = "Collage creation failed.";
  } finally {
    if (token === icmRenderToken) {
      icm.create.disabled = icmPhotos.length < 2;
    }
  }
}

function icmDownloadCollage() {
  if (!icmPreviewIsCurrent) {
    icmSetStatus("Create or update the collage before downloading.", true);
    return;
  }

  const mimeType = icm.format.value;
  const extension = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
  }[mimeType];

  const quality = Number(icm.quality.value) / 100;

  try {
    icm.canvas.toBlob(blob => {
      if (!blob) {
        icmSetStatus(
          "The collage could not be exported. Try another format.",
          true
        );
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `digiifox-collage.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      icmSetStatus("Your collage has been downloaded.");
    }, mimeType, mimeType === "image/png" ? undefined : quality);
  } catch (error) {
    console.error("Collage export failed:", error);
    icmSetStatus(
      "Export failed. Try reducing the number or size of your photos.",
      true
    );
  }
}

function icmStartOver() {
  icmRenderToken++;

  icmPhotos.forEach(photo => URL.revokeObjectURL(photo.url));
  icmPhotos = [];
  icmNextId = 1;
  icmPreviewIsCurrent = false;

  icm.fileInput.value = "";
  icm.columns.value = "3";
  icm.ratio.value = "square";
  icm.spacing.value = "12";
  icm.radius.value = "12";
  icm.background.value = "#ffffff";
  icm.format.value = "image/png";
  icm.quality.value = "92";

  icm.canvas.width = 0;
  icm.canvas.height = 0;
  icm.canvas.hidden = true;
  icm.emptyPreview.hidden = false;

  icm.previewMeta.textContent = "No collage created yet.";
  icm.download.disabled = true;
  icm.create.disabled = true;

  icmUpdateControls();
  icmRenderPhotoList();
  icmSetStatus("Add at least two images to begin.");
}

icm.fileInput.addEventListener("change", async event => {
  await icmAddFiles(event.target.files);
  // Reset so the same file can be selected again later.
  icm.fileInput.value = "";
});

icm.dropzone.addEventListener("dragover", event => {
  event.preventDefault();
  icm.dropzone.classList.add("icm-dragging");
});

icm.dropzone.addEventListener("dragleave", event => {
  if (!icm.dropzone.contains(event.relatedTarget)) {
    icm.dropzone.classList.remove("icm-dragging");
  }
});

icm.dropzone.addEventListener("drop", async event => {
  event.preventDefault();
  icm.dropzone.classList.remove("icm-dragging");
  await icmAddFiles(event.dataTransfer.files);
});

[
  icm.columns,
  icm.ratio,
  icm.spacing,
  icm.radius,
  icm.background
].forEach(control => {
  control.addEventListener("input", () => {
    icmUpdateControls();

    if (icmPhotos.length >= 2) {
      icmInvalidatePreview();
    }
  });
});

icm.format.addEventListener("change", () => {
  icmUpdateControls();
});

icm.quality.addEventListener("input", icmUpdateControls);

icm.create.addEventListener("click", icmCreateCollage);
icm.download.addEventListener("click", icmDownloadCollage);
icm.reset.addEventListener("click", icmStartOver);

icmUpdateControls();
icmRenderPhotoList();