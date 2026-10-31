"use strict";

const itp = {
  fileInput: document.getElementById("itpFileInput"),
  chooseBtn: document.getElementById("itpChooseBtn"),
  addMoreBtn: document.getElementById("itpAddMoreBtn"),
  dropzone: document.getElementById("itpDropzone"),
  list: document.getElementById("itpImageList"),
  count: document.getElementById("itpCount"),
  clearBtn: document.getElementById("itpClearBtn"),
  pageSize: document.getElementById("itpPageSize"),
  orientation: document.getElementById("itpOrientation"),
  margin: document.getElementById("itpMargin"),
  placement: document.getElementById("itpPlacement"),
  quality: document.getElementById("itpQuality"),
  background: document.getElementById("itpBackground"),
  summaryCount: document.getElementById("itpSummaryCount"),
  summarySize: document.getElementById("itpSummarySize"),
  createBtn: document.getElementById("itpCreateBtn"),
  status: document.getElementById("itpStatus"),
  year: document.getElementById("itpYear")
};

const ITP_MAX_FILE_BYTES = 20 * 1024 * 1024;
const ITP_MAX_FILES = 40;
const ITP_MAX_PIXELS = 40_000_000;
const ITP_MAX_DIMENSION = 12000;
const ITP_MAX_TOTAL_BYTES = 100 * 1024 * 1024;

let itpImages = [];
let itpNextId = 1;
let itpBusy = false;

itp.year.textContent = new Date().getFullYear();

itp.chooseBtn.addEventListener("click", () => itp.fileInput.click());
itp.addMoreBtn.addEventListener("click", () => itp.fileInput.click());

itp.fileInput.addEventListener("change", async (event) => {
  await itpAddFiles(Array.from(event.target.files || []));
  event.target.value = "";
});

itp.clearBtn.addEventListener("click", () => {
  if (itpBusy) return;

  itpImages.forEach((item) => URL.revokeObjectURL(item.url));
  itpImages = [];
  itpRenderList();
  itp.setStatus("All images removed.");
});

itp.createBtn.addEventListener("click", itpCreatePdf);

[itp.pageSize, itp.orientation, itp.margin, itp.placement, itp.quality, itp.background]
  .forEach((control) => {
    control.addEventListener("change", () => {
      itp.setStatus("");
    });
  });

// Drag and drop.
["dragenter", "dragover"].forEach((eventName) => {
  itp.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    itp.dropzone.classList.add("itp-drag-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  itp.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    itp.dropzone.classList.remove("itp-drag-active");
  });
});

itp.dropzone.addEventListener("drop", async (event) => {
  const files = Array.from(event.dataTransfer?.files || []);
  await itpAddFiles(files);
});

async function itpAddFiles(files) {
  if (itpBusy) {
    itp.setStatus("Please wait until the current PDF is finished.");
    return;
  }

  if (!files.length) return;

  let added = 0;
  const errors = [];

  for (const file of files) {
    if (itpImages.length >= ITP_MAX_FILES) {
      errors.push(`Maximum ${ITP_MAX_FILES} images allowed.`);
      break;
    }

    if (!file.type.startsWith("image/")) {
      errors.push(`${file.name}: not an image.`);
      continue;
    }

    if (file.size > ITP_MAX_FILE_BYTES) {
      errors.push(`${file.name}: exceeds 20 MB.`);
      continue;
    }

    const currentTotal = itpImages.reduce((sum, item) => sum + item.file.size, 0);

    if (currentTotal + file.size > ITP_MAX_TOTAL_BYTES) {
      errors.push("Total source image size cannot exceed 100 MB.");
      break;
    }

    const url = URL.createObjectURL(file);

    try {
      const image = await itpLoadImage(url);
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (
        width > ITP_MAX_DIMENSION ||
        height > ITP_MAX_DIMENSION ||
        width * height > ITP_MAX_PIXELS
      ) {
        URL.revokeObjectURL(url);
        errors.push(`${file.name}: exceeds the supported image dimensions.`);
        continue;
      }

      itpImages.push({
        id: itpNextId++,
        file,
        url,
        width,
        height
      });

      added++;
    } catch (error) {
      URL.revokeObjectURL(url);
      errors.push(`${file.name}: could not be opened.`);
    }
  }

  itpRenderList();

  if (errors.length) {
    const displayed = errors.slice(0, 3).join(" ");
    const remaining = errors.length > 3 ? ` And ${errors.length - 3} more issue(s).` : "";
    itp.setStatus(`${added} image(s) added. ${displayed}${remaining}`);
  } else {
    itp.setStatus(`${added} image(s) added successfully.`);
  }
}

function itpLoadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image loading failed."));
    image.src = url;
  });
}

function itpRenderList() {
  itp.list.replaceChildren();

  if (itpImages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "itp-empty-list";

    const title = document.createElement("strong");
    title.textContent = "No images added yet";

    const description = document.createElement("p");
    description.textContent = "Your uploaded images will appear here.";

    empty.append(title, description);
    itp.list.appendChild(empty);
  } else {
    itpImages.forEach((item, index) => {
      const row = document.createElement("article");
      row.className = "itp-image-item";

      const thumb = document.createElement("img");
      thumb.className = "itp-image-thumb";
      thumb.src = item.url;
      thumb.alt = "";
      thumb.loading = "lazy";

      const details = document.createElement("div");
      details.className = "itp-image-details";

      const name = document.createElement("div");
      name.className = "itp-image-name";
      name.textContent = `${index + 1}. ${item.file.name}`;
      name.title = item.file.name;

      const meta = document.createElement("div");
      meta.className = "itp-image-meta";
      meta.textContent =
        `${item.width.toLocaleString()} × ${item.height.toLocaleString()} · ${itpFormatBytes(item.file.size)}`;

      details.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "itp-image-actions";

      const up = document.createElement("button");
      up.type = "button";
      up.className = "itp-icon-btn";
      up.textContent = "↑";
      up.title = "Move image up";
      up.setAttribute("aria-label", `Move ${item.file.name} up`);
      up.disabled = index === 0 || itpBusy;
      up.addEventListener("click", () => itpMoveImage(index, -1));

      const down = document.createElement("button");
      down.type = "button";
      down.className = "itp-icon-btn";
      down.textContent = "↓";
      down.title = "Move image down";
      down.setAttribute("aria-label", `Move ${item.file.name} down`);
      down.disabled = index === itpImages.length - 1 || itpBusy;
      down.addEventListener("click", () => itpMoveImage(index, 1));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "itp-icon-btn itp-remove-btn";
      remove.textContent = "×";
      remove.title = "Remove image";
      remove.setAttribute("aria-label", `Remove ${item.file.name}`);
      remove.disabled = itpBusy;
      remove.addEventListener("click", () => itpRemoveImage(item.id));

      actions.append(up, down, remove);
      row.append(thumb, details, actions);
      itp.list.appendChild(row);
    });
  }

  itp.count.textContent = `${itpImages.length} image${itpImages.length === 1 ? "" : "s"}`;
  itp.summaryCount.textContent = String(itpImages.length);

  const totalBytes = itpImages.reduce((sum, item) => sum + item.file.size, 0);
  itp.summarySize.textContent = itpFormatBytes(totalBytes);

  itp.clearBtn.disabled = itpImages.length === 0 || itpBusy;
  itp.createBtn.disabled = itpImages.length === 0 || itpBusy;
  itp.chooseBtn.disabled = itpBusy;
  itp.addMoreBtn.disabled = itpBusy;
  itp.fileInput.disabled = itpBusy;

  [itp.pageSize, itp.orientation, itp.margin, itp.placement, itp.quality, itp.background]
    .forEach((control) => {
      control.disabled = itpBusy;
    });
}

function itpMoveImage(index, direction) {
  if (itpBusy) return;

  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= itpImages.length) return;

  [itpImages[index], itpImages[nextIndex]] = [
    itpImages[nextIndex],
    itpImages[index]
  ];

  itpRenderList();
}

function itpRemoveImage(id) {
  if (itpBusy) return;

  const index = itpImages.findIndex((item) => item.id === id);

  if (index === -1) return;

  const [removed] = itpImages.splice(index, 1);
  URL.revokeObjectURL(removed.url);

  itpRenderList();
  itp.setStatus("Image removed.");
}

async function itpCreatePdf() {
  if (itpBusy || itpImages.length === 0) return;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    itp.setStatus("The PDF library did not load. Check your internet connection and reload the page.");
    return;
  }

  itpBusy = true;
  itpRenderList();
  itp.createBtn.textContent = "Creating PDF...";

  try {
    const { jsPDF } = window.jspdf;
    const pageSize = itp.pageSize.value;
    const orientation = itp.orientation.value;
    const margin = Number(itp.margin.value);
    const placement = itp.placement.value;
    const quality = Number(itp.quality.value);
    const background = itp.background.value;

    let pdf = null;

    for (let index = 0; index < itpImages.length; index++) {
      const item = itpImages[index];

      itp.setStatus(`Preparing page ${index + 1} of ${itpImages.length}...`);

      const image = await itpLoadImage(item.url);
      const canvas = itpPrepareCanvas(image, quality, background);

      let pageOrientation = orientation;
      let format = pageSize;

      if (pageSize === "fit") {
        format = [
          Math.max(1, item.width * 0.264583),
          Math.max(1, item.height * 0.264583)
        ];
        pageOrientation = "portrait";
      }

      if (!pdf) {
        pdf = new jsPDF({
          orientation: pageOrientation,
          unit: "mm",
          format,
          compress: true
        });
      } else {
        pdf.addPage(format, pageOrientation);
      }

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const safeMargin = Math.min(
        margin,
        Math.max(0, (Math.min(pageWidth, pageHeight) - 1) / 2)
      );

      const availableWidth = Math.max(1, pageWidth - safeMargin * 2);
      const availableHeight = Math.max(1, pageHeight - safeMargin * 2);

      pdf.setFillColor(
        parseInt(background.slice(1, 3), 16),
        parseInt(background.slice(3, 5), 16),
        parseInt(background.slice(5, 7), 16)
      );

      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      let drawWidth;
      let drawHeight;
      let x;
      let y;

      const imageRatio = canvas.width / canvas.height;
      const areaRatio = availableWidth / availableHeight;

      if (placement === "fill") {
        if (imageRatio > areaRatio) {
          drawHeight = availableHeight;
          drawWidth = drawHeight * imageRatio;
        } else {
          drawWidth = availableWidth;
          drawHeight = drawWidth / imageRatio;
        }
      } else {
        if (imageRatio > areaRatio) {
          drawWidth = availableWidth;
          drawHeight = drawWidth / imageRatio;
        } else {
          drawHeight = availableHeight;
          drawWidth = drawHeight * imageRatio;
        }
      }

      x = (pageWidth - drawWidth) / 2;
      y = (pageHeight - drawHeight) / 2;

      const dataUrl = canvas.toDataURL("image/jpeg", quality);

      pdf.addImage(
        dataUrl,
        "JPEG",
        x,
        y,
        drawWidth,
        drawHeight,
        undefined,
        "FAST"
      );

      // Release per-page working canvas memory.
      canvas.width = 1;
      canvas.height = 1;
    }

    if (!pdf) {
      throw new Error("No PDF pages were generated.");
    }

    pdf.save("digiifox-images.pdf");
    itp.setStatus(`Done! Your PDF with ${itpImages.length} page(s) has been created.`);
  } catch (error) {
    console.error("Image to PDF error:", error);
    itp.setStatus("Could not create the PDF. Try fewer or smaller images, or check whether your browser supports the selected image formats.");
  } finally {
    itpBusy = false;
    itp.createBtn.textContent = "Create & Download PDF";
    itpRenderList();
  }
}

function itpPrepareCanvas(image, quality, background) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  return canvas;
}

function itpFormatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function itpSetStatus(message) {
  itp.status.textContent = message;
}

itp.setStatus = itpSetStatus;

window.addEventListener("pagehide", () => {
  itpImages.forEach((item) => URL.revokeObjectURL(item.url));
});