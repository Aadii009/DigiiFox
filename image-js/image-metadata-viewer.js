"use strict";

const imv = {
  fileInput: document.getElementById("imvFileInput"),
  chooseBtn: document.getElementById("imvChooseBtn"),
  changeBtn: document.getElementById("imvChangeBtn"),
  clearBtn: document.getElementById("imvClearBtn"),
  dropzone: document.getElementById("imvDropzone"),
  previewWrap: document.getElementById("imvPreviewWrap"),
  preview: document.getElementById("imvPreview"),
  previewCaption: document.getElementById("imvPreviewCaption"),
  status: document.getElementById("imvStatus"),
  badge: document.getElementById("imvMetadataBadge"),
  basicInfo: document.getElementById("imvBasicInfo"),
  exifInfo: document.getElementById("imvExifInfo"),
  gpsInfo: document.getElementById("imvGpsInfo"),
  downloadBtn: document.getElementById("imvDownloadBtn"),
  copyBtn: document.getElementById("imvCopyBtn"),
  year: document.getElementById("imvYear")
};

const IMV_MAX_BYTES = 25 * 1024 * 1024;
let imvCurrentUrl = null;
let imvCurrentReport = "";
let imvRequestId = 0;

imv.year.textContent = new Date().getFullYear();

imv.chooseBtn.addEventListener("click", () => imv.fileInput.click());
imv.changeBtn.addEventListener("click", () => imv.fileInput.click());

imv.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) await imvProcessFile(file);
});

imv.clearBtn.addEventListener("click", imvClear);

["dragenter", "dragover"].forEach((name) => {
  imv.dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    imv.dropzone.classList.add("imv-drag-active");
  });
});

["dragleave", "drop"].forEach((name) => {
  imv.dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    imv.dropzone.classList.remove("imv-drag-active");
  });
});

imv.dropzone.addEventListener("drop", async (event) => {
  const file = Array.from(event.dataTransfer?.files || []).find((item) =>
    item.type.startsWith("image/")
  );

  if (!file) {
    imv.setStatus("Drop a supported image file to continue.");
    return;
  }

  await imvProcessFile(file);
});

imv.copyBtn.addEventListener("click", async () => {
  if (!imvCurrentReport) return;

  try {
    await navigator.clipboard.writeText(imvCurrentReport);
    imv.setStatus("Metadata copied to clipboard.");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = imvCurrentReport;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    imv.setStatus(copied
      ? "Metadata copied to clipboard."
      : "Copy failed. Try downloading the text report instead.");
  }
});

imv.downloadBtn.addEventListener("click", () => {
  if (!imvCurrentReport) return;

  const blob = new Blob([imvCurrentReport], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "digiiFox-image-metadata.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

imv.setStatus = (message) => {
  imv.status.textContent = message;
};

async function imvProcessFile(file) {
  const requestId = ++imvRequestId;

  if (!file.type.startsWith("image/")) {
    imv.setStatus("Please select an image file.");
    return;
  }

  if (file.size > IMV_MAX_BYTES) {
    imv.setStatus("This file exceeds the 25 MB limit. Please choose a smaller image.");
    return;
  }

  imvResetResults(false);
  imv.setStatus("Reading image properties and available metadata...");

  const objectUrl = URL.createObjectURL(file);
  let image;

  try {
    image = await imvLoadImage(objectUrl);
  } catch {
    URL.revokeObjectURL(objectUrl);
    if (requestId !== imvRequestId) return;
    imv.setStatus("This image could not be opened by your browser.");
    return;
  }

  if (requestId !== imvRequestId) {
    URL.revokeObjectURL(objectUrl);
    return;
  }

  imvCurrentUrl = objectUrl;
  imv.preview.src = objectUrl;
  imv.preview.alt = `Preview of ${file.name}`;
  imv.previewWrap.hidden = false;
  imv.previewCaption.textContent = file.name;
  imv.dropzone.hidden = true;
  imv.changeBtn.hidden = false;
  imv.clearBtn.disabled = false;

  const basic = {
    "File name": file.name,
    "File format": imvGetFormat(file),
    "File size": imvFormatBytes(file.size),
    "Image dimensions": `${image.naturalWidth.toLocaleString()} × ${image.naturalHeight.toLocaleString()} px`,
    "Aspect ratio": imvAspectRatio(image.naturalWidth, image.naturalHeight),
    "Last modified": file.lastModified
      ? new Date(file.lastModified).toLocaleString()
      : "Not available",
    "MIME type": file.type || "Not reported",
    "Pixel count": (image.naturalWidth * image.naturalHeight).toLocaleString()
  };

  imvRenderBasic(basic);

  let metadata = {};
  let metadataError = "";

  if (window.exifr && typeof window.exifr.parse === "function") {
    try {
      metadata = await window.exifr.parse(file, {
        gps: true,
        exif: true,
        iptc: true,
        xmp: true,
        icc: true,
        tiff: true,
        jfif: true,
        ihdr: true,
        translateValues: true
      }) || {};
    } catch (error) {
      console.warn("Metadata parsing failed:", error);
      metadataError = "The file's embedded metadata could not be fully read.";
    }
  } else {
    metadataError = "The metadata library did not load. Basic image properties are still available.";
  }

  if (requestId !== imvRequestId) return;

  const entries = imvPrepareEntries(metadata);
  imvRenderExif(entries, metadataError);
  imvRenderGps(metadata);

  const reportLines = [
    "DigiiFox Image Metadata Report",
    "==============================",
    "",
    ...Object.entries(basic).map(([key, value]) => `${key}: ${value}`),
    "",
    "EXIF & Other Metadata",
    "---------------------",
    ...(entries.length
      ? entries.map(([key, value]) => `${key}: ${value}`)
      : ["No readable EXIF or additional metadata found."]),
    "",
    "GPS Information",
    "---------------",
    ...imvGetGpsLines(metadata),
    "",
    metadataError ? `Note: ${metadataError}` : ""
  ];

  imvCurrentReport = reportLines.join("\n");
  imv.downloadBtn.disabled = false;
  imv.copyBtn.disabled = false;

  const hasMetadata = entries.length > 0;
  imv.badge.textContent = hasMetadata ? "Metadata found" : "Basic data only";

  if (metadataError) {
    imv.setStatus(`${metadataError} Basic properties are available.`);
  } else if (hasMetadata) {
    imv.setStatus("Image inspected successfully. Available metadata is shown below.");
  } else {
    imv.setStatus("Basic properties loaded. No additional EXIF metadata was detected.");
  }
}

function imvLoadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed."));
    image.src = url;
  });
}

function imvResetResults(revokeUrl = true) {
  if (revokeUrl && imvCurrentUrl) {
    URL.revokeObjectURL(imvCurrentUrl);
  }

  imvCurrentUrl = null;
  imvCurrentReport = "";
  imv.preview.removeAttribute("src");
  imv.previewWrap.hidden = true;
  imv.previewCaption.textContent = "";
  imv.downloadBtn.disabled = true;
  imv.copyBtn.disabled = true;
  imv.basicInfo.replaceChildren();

  imv.exifInfo.replaceChildren();
  imv.exifInfo.appendChild(imvMakeEmptyRow("No metadata loaded yet."));

  imv.gpsInfo.textContent =
    "GPS information will appear here if location metadata is present.";

  imv.badge.textContent = "Waiting for image";
}

function imvClear() {
  ++imvRequestId;
  imvResetResults();
  imv.fileInput.value = "";
  imv.dropzone.hidden = false;
  imv.changeBtn.hidden = true;
  imv.clearBtn.disabled = true;
  imv.setStatus("Image cleared. Choose another image to begin.");
}

function imvRenderBasic(data) {
  imv.basicInfo.replaceChildren();

  Object.entries(data).forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "imv-data-item";

    const key = document.createElement("div");
    key.className = "imv-data-label";
    key.textContent = label;

    const content = document.createElement("div");
    content.className = "imv-data-value";
    content.textContent = String(value);

    item.append(key, content);
    imv.basicInfo.appendChild(item);
  });
}

function imvPrepareEntries(metadata) {
  const ignored = new Set([
    "gpsLatitude", "gpsLongitude", "latitude", "longitude",
    "GPSLatitude", "GPSLongitude", "ExifToolVersion"
  ]);

  return Object.entries(metadata)
    .filter(([key, value]) => !ignored.has(key) && value !== undefined && value !== null)
    .map(([key, value]) => [key, imvFormatValue(value)])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function imvRenderExif(entries, errorMessage) {
  imv.exifInfo.replaceChildren();

  if (!entries.length) {
    const message = errorMessage || "No additional EXIF or embedded metadata was detected.";
    imv.exifInfo.appendChild(imvMakeEmptyRow(message));
    return;
  }

  entries.forEach(([key, value]) => {
    const row = document.createElement("tr");
    const keyCell = document.createElement("td");
    const valueCell = document.createElement("td");

    keyCell.textContent = key;
    valueCell.textContent = value;
    row.append(keyCell, valueCell);
    imv.exifInfo.appendChild(row);
  });
}

function imvMakeEmptyRow(message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 2;
  cell.className = "imv-table-empty";
  cell.textContent = message;
  row.appendChild(cell);
  return row;
}

function imvRenderGps(metadata) {
  imv.gpsInfo.replaceChildren();

  const latitude = metadata.latitude ?? metadata.GPSLatitude;
  const longitude = metadata.longitude ?? metadata.GPSLongitude;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    imv.gpsInfo.textContent =
      "No readable GPS coordinates were found in this image.";
    return;
  }

  const coords = document.createElement("p");
  coords.textContent = `Latitude: ${latitude.toFixed(6)} · Longitude: ${longitude.toFixed(6)}`;

  const note = document.createElement("p");
  note.textContent = "These coordinates may reveal where the image was captured. Only open them if you are comfortable viewing that location.";

  const mapLink = document.createElement("a");
  mapLink.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=15/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;
  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";
  mapLink.textContent = "View coordinates on OpenStreetMap";

  imv.gpsInfo.append(coords, note, mapLink);
}

function imvGetGpsLines(metadata) {
  const latitude = metadata.latitude ?? metadata.GPSLatitude;
  const longitude = metadata.longitude ?? metadata.GPSLongitude;

  if (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return [
      `Latitude: ${latitude}`,
      `Longitude: ${longitude}`
    ];
  }

  return ["No readable GPS coordinates found."];
}

function imvGetFormat(file) {
  const extension = file.name.includes(".")
    ? file.name.split(".").pop().toUpperCase()
    : "";

  if (file.type) return `${file.type}${extension ? ` (${extension})` : ""}`;
  return extension || "Unknown";
}

function imvFormatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function imvAspectRatio(width, height) {
  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }

  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function imvFormatValue(value) {
  if (value instanceof Date) return value.toLocaleString();

  if (ArrayBuffer.isView(value)) {
    return Array.from(value).join(", ");
  }

  if (Array.isArray(value)) {
    return value.map(imvFormatValue).join(", ");
  }

  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Complex value]";
    }
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "Not available";
  }

  return String(value);
}

function imvAspectRatio(width, height) {
  function gcd(a, b) {
    while (b) {
      [a, b] = [b, a % b];
    }
    return a || 1;
  }

  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

window.addEventListener("pagehide", () => {
  if (imvCurrentUrl) URL.revokeObjectURL(imvCurrentUrl);
});