"use strict";

const bti = {
  input: document.getElementById("bti-input"),
  characterCount: document.getElementById("bti-character-count"),
  decode: document.getElementById("bti-decode"),
  clear: document.getElementById("bti-clear"),
  status: document.getElementById("bti-status"),
  previewCard: document.getElementById("bti-preview-card"),
  preview: document.getElementById("bti-preview"),
  format: document.getElementById("bti-format"),
  dimensions: document.getElementById("bti-dimensions"),
  size: document.getElementById("bti-size"),
  downloadCard: document.getElementById("bti-download-card"),
  outputFormat: document.getElementById("bti-output-format"),
  quality: document.getElementById("bti-quality"),
  qualityValue: document.getElementById("bti-quality-value"),
  qualityField: document.getElementById("bti-quality-field"),
  formatNote: document.getElementById("bti-format-note"),
  download: document.getElementById("bti-download"),
  copyData: document.getElementById("bti-copy-data"),
  copyStatus: document.getElementById("bti-copy-status"),
  year: document.getElementById("bti-year")
};

const BTI_MAX_BYTES = 20 * 1024 * 1024;
const BTI_MAX_DIMENSION = 12000;
const BTI_MAX_PIXELS = 40000000;

let btiBlob = null;
let btiObjectUrl = "";
let btiOriginalMime = "";
let btiOriginalExtension = "bin";
let btiNormalizedDataUrl = "";
let btiDecodedWidth = 0;
let btiDecodedHeight = 0;
let btiRequestId = 0;

bti.year.textContent = new Date().getFullYear();

function btiSetStatus(message, isError = false) {
  bti.status.textContent = message;
  bti.status.classList.toggle("bti-error", isError);
}

function btiFormatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function btiResetResult() {
  btiRequestId++;

  if (btiObjectUrl) {
    URL.revokeObjectURL(btiObjectUrl);
    btiObjectUrl = "";
  }

  btiBlob = null;
  btiOriginalMime = "";
  btiOriginalExtension = "bin";
  btiNormalizedDataUrl = "";
  btiDecodedWidth = 0;
  btiDecodedHeight = 0;

  bti.preview.removeAttribute("src");
  bti.previewCard.hidden = true;
  bti.downloadCard.hidden = true;

  bti.format.textContent = "—";
  bti.dimensions.textContent = "—";
  bti.size.textContent = "—";
  bti.copyStatus.textContent = "";

  bti.download.disabled = true;
  bti.copyData.disabled = true;
}

function btiDetectImageType(bytes) {
  // PNG signature
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0D &&
    bytes[5] === 0x0A &&
    bytes[6] === 0x1A &&
    bytes[7] === 0x0A
  ) {
    return { mime: "image/png", extension: "png" };
  }

  // JPEG signature
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xFF &&
    bytes[1] === 0xD8 &&
    bytes[2] === 0xFF
  ) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

  // GIF signature
  if (
    bytes.length >= 6 &&
    String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)
  ) {
    return { mime: "image/gif", extension: "gif" };
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }

  // BMP signature
  if (
    bytes.length >= 2 &&
    bytes[0] === 0x42 &&
    bytes[1] === 0x4D
  ) {
    return { mime: "image/bmp", extension: "bmp" };
  }

  // ICO signature
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  ) {
    return { mime: "image/x-icon", extension: "ico" };
  }

  // AVIF: ISO Base Media File Format with an avif/avis brand.
  if (bytes.length >= 12) {
    const boxType = String.fromCharCode(...bytes.slice(4, 8));
    const brand = String.fromCharCode(...bytes.slice(8, 12));

    if (boxType === "ftyp" && (brand === "avif" || brand === "avis")) {
      return { mime: "image/avif", extension: "avif" };
    }
  }

  return null;
}

function btiParseInput(rawInput) {
  let text = rawInput.trim();

  if (!text) {
    throw new Error("Please paste a Base64 string or Data URL.");
  }

  // Reject HTML snippets rather than trying to extract arbitrary markup.
  if (/<\s*img\b/i.test(text) || /^</.test(text)) {
    throw new Error(
      "Paste the Base64 string or Data URL itself, not HTML markup."
    );
  }

  let declaredMime = "";

  const dataUrlMatch = text.match(
    /^data:([^;,]+);base64,([\s\S]*)$/i
  );

  if (dataUrlMatch) {
    declaredMime = dataUrlMatch[1].toLowerCase();
    text = dataUrlMatch[2];
  } else if (/^data:/i.test(text)) {
    throw new Error(
      "This Data URL is invalid. Use a Data URL with a Base64 prefix, such as data:image/png;base64,..."
    );
  }

  // Whitespace and line breaks are commonly added when Base64 is wrapped.
  text = text.replace(/\s/g, "");

  if (!text) {
    throw new Error("The Base64 data is empty.");
  }

  // Permit URL-safe Base64 as well as standard Base64.
  text = text.replace(/-/g, "+").replace(/_/g, "/");

  // Reject characters that are not part of standard Base64.
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
    throw new Error(
      "The input contains invalid Base64 characters. Check that the entire string was copied correctly."
    );
  }

  // '=' may only appear at the end, with valid padding.
  const unpadded = text.replace(/=+$/, "");

  if (unpadded.length % 4 === 1) {
    throw new Error("The Base64 string has an invalid length.");
  }

  const estimatedBytes = Math.floor(unpadded.length * 3 / 4);

  if (estimatedBytes > BTI_MAX_BYTES) {
    throw new Error("The decoded image exceeds the 20 MB size limit.");
  }

  // Restore omitted padding where necessary.
  const remainder = text.length % 4;

  if (remainder === 1) {
    throw new Error("The Base64 string has an invalid length.");
  }

  if (remainder === 2) text += "==";
  if (remainder === 3) text += "=";

  // This tool accepts raster image data only.
  const allowedDeclaredMimes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/x-ms-bmp",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/avif"
  ];

  if (
    declaredMime &&
    !allowedDeclaredMimes.includes(declaredMime)
  ) {
    throw new Error(
      "This MIME type is not supported. Use PNG, JPEG, WebP, GIF, BMP, ICO, or AVIF image data."
    );
  }

  let binary;

  try {
    binary = atob(text);
  } catch {
    throw new Error("The Base64 string could not be decoded.");
  }

  if (!binary.length) {
    throw new Error("The decoded data is empty.");
  }

  if (binary.length > BTI_MAX_BYTES) {
    throw new Error("The decoded image exceeds the 20 MB size limit.");
  }

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const detected = btiDetectImageType(bytes);

  if (!detected) {
    throw new Error(
      "The decoded data is not a recognized supported raster image. Check the Base64 string and try again."
    );
  }

  // Prefer the actual file signature over a possibly incorrect MIME label.
  const mime = detected.mime;
  const extension = detected.extension;

  return {
    bytes,
    mime,
    extension
  };
}

function btiDecodeImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (
        !width ||
        !height ||
        width > BTI_MAX_DIMENSION ||
        height > BTI_MAX_DIMENSION ||
        width * height > BTI_MAX_PIXELS
      ) {
        URL.revokeObjectURL(url);

        reject(new Error(
          "This image exceeds the supported dimensions of 12,000 pixels per side or 40 megapixels."
        ));

        return;
      }

      resolve({ url, width, height });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);

      reject(new Error(
        "The data resembles an image file, but your browser could not decode it. The image may be damaged or unsupported."
      ));
    };

    image.src = url;
  });
}

async function btiDecode() {
  const requestId = ++btiRequestId;

  btiResetResult();

  // btiResetResult increments the request ID, so use the new current ID.
  const activeRequestId = btiRequestId;

  bti.decode.disabled = true;
  btiSetStatus("Validating and decoding your Base64 data...");

  try {
    const parsed = btiParseInput(bti.input.value);

    const blob = new Blob([parsed.bytes], { type: parsed.mime });

    const result = await btiDecodeImage(blob);

    if (activeRequestId !== btiRequestId) {
      URL.revokeObjectURL(result.url);
      return;
    }

    btiBlob = blob;
    btiObjectUrl = result.url;
    btiOriginalMime = parsed.mime;
    btiOriginalExtension = parsed.extension;
    btiDecodedWidth = result.width;
    btiDecodedHeight = result.height;

    // Construct a normalized Data URL from the decoded bytes.
    // Process in chunks to avoid overflowing the call stack.
    let binary = "";
    const chunkSize = 8192;

    for (let offset = 0; offset < parsed.bytes.length; offset += chunkSize) {
      const chunk = parsed.bytes.subarray(
        offset,
        Math.min(offset + chunkSize, parsed.bytes.length)
      );

      binary += String.fromCharCode(...chunk);
    }

    btiNormalizedDataUrl =
      `data:${parsed.mime};base64,${btoa(binary)}`;

    bti.preview.src = result.url;
    bti.format.textContent = parsed.mime.replace("image/", "").toUpperCase();
    bti.dimensions.textContent =
      `${result.width} × ${result.height} px`;
    bti.size.textContent = btiFormatBytes(blob.size);

    bti.previewCard.hidden = false;
    bti.downloadCard.hidden = false;

    bti.download.disabled = false;
    bti.copyData.disabled = false;

    btiUpdateDownloadSettings();

    btiSetStatus("Image decoded successfully. Your image is ready.");
  } catch (error) {
    if (activeRequestId !== btiRequestId) return;

    btiSetStatus(
      error.message || "Could not decode the image.",
      true
    );
  } finally {
    if (activeRequestId === btiRequestId) {
      bti.decode.disabled = false;
    }
  }
}

function btiUpdateDownloadSettings() {
  const format = bti.outputFormat.value;
  const isLossy = format === "image/jpeg" || format === "image/webp";

  bti.qualityField.hidden = !isLossy;
  bti.qualityValue.textContent = `${bti.quality.value}%`;

  if (format === "original") {
    bti.formatNote.textContent =
      "Original format downloads the decoded image without re-encoding.";
  } else if (format === "image/png") {
    bti.formatNote.textContent =
      "PNG uses lossless encoding and supports transparency.";
  } else if (format === "image/jpeg") {
    bti.formatNote.textContent =
      "JPG does not support transparency. Transparent areas are filled with white.";
  } else {
    bti.formatNote.textContent =
      "WebP supports transparency. Quality settings control lossy encoding.";
  }
}

function btiCanvasFromImage() {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");

      canvas.width = btiDecodedWidth;
      canvas.height = btiDecodedHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas is not available in this browser."));
        return;
      }

      // JPEG cannot preserve transparency.
      if (bti.outputFormat.value === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.drawImage(image, 0, 0);

      resolve(canvas);
    };

    image.onerror = () => reject(
      new Error("Could not prepare the image for conversion.")
    );

    image.src = btiObjectUrl;
  });
}

async function btiDownloadImage() {
  if (!btiBlob || !btiObjectUrl) return;

  const selectedFormat = bti.outputFormat.value;
  bti.download.disabled = true;
  btiSetStatus("Preparing your download...");

  try {
    let downloadBlob;
    let extension;

    if (selectedFormat === "original") {
      downloadBlob = btiBlob;
      extension = btiOriginalExtension;
    } else {
      const canvas = await btiCanvasFromImage();

      const convertedBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error("The image could not be exported."));
              return;
            }

            resolve(blob);
          },
          selectedFormat,
          Number(bti.quality.value) / 100
        );
      });

      downloadBlob = convertedBlob;

      extension = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp"
      }[selectedFormat];

      if (!extension) {
        throw new Error("This download format is not supported.");
      }
    }

    const url = URL.createObjectURL(downloadBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `digii-fox-decoded-image.${extension}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);

    btiSetStatus("Your image has been downloaded.");
  } catch (error) {
    btiSetStatus(error.message || "The image could not be downloaded.", true);
  } finally {
    bti.download.disabled = false;
  }
}

async function btiCopyDataUrl() {
  if (!btiNormalizedDataUrl) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(btiNormalizedDataUrl);
    } else {
      const temporary = document.createElement("textarea");

      temporary.value = btiNormalizedDataUrl;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";

      document.body.appendChild(temporary);
      temporary.select();

      const copied = document.execCommand("copy");
      temporary.remove();

      if (!copied) {
        throw new Error("Clipboard access is unavailable.");
      }
    }

    bti.copyStatus.textContent = "Data URL copied to clipboard.";
  } catch {
    bti.copyStatus.textContent =
      "Copy failed. Your browser may block clipboard access.";
  }
}

function btiClear() {
  btiRequestId++;

  btiResetResult();
  bti.input.value = "";
  bti.characterCount.textContent = "0 characters";

  bti.outputFormat.value = "original";
  bti.quality.value = "92";
  bti.qualityValue.textContent = "92%";

  btiUpdateDownloadSettings();

  btiSetStatus("Paste your Base64 data to begin.");
}

bti.input.addEventListener("input", () => {
  bti.characterCount.textContent =
    `${bti.input.value.length.toLocaleString()} characters`;

  if (btiBlob) {
    btiResetResult();
  }

  bti.copyStatus.textContent = "";
});

bti.decode.addEventListener("click", btiDecode);
bti.clear.addEventListener("click", btiClear);
bti.download.addEventListener("click", btiDownloadImage);
bti.copyData.addEventListener("click", btiCopyDataUrl);

bti.outputFormat.addEventListener("change", btiUpdateDownloadSettings);

bti.quality.addEventListener("input", () => {
  bti.qualityValue.textContent = `${bti.quality.value}%`;
});

btiUpdateDownloadSettings();