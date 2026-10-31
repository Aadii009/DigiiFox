"use strict";

const icp = {
  fileInput: document.getElementById("icpFileInput"),
  chooseBtn: document.getElementById("icpChooseBtn"),
  changeImageBtn: document.getElementById("icpChangeImageBtn"),
  dropZone: document.getElementById("icpDropZone"),
  uploadEmpty: document.getElementById("icpUploadEmpty"),
  imageArea: document.getElementById("icpImageArea"),
  canvasWrap: document.getElementById("icpCanvasWrap"),
  canvas: document.getElementById("icpCanvas"),
  marker: document.getElementById("icpPickerMarker"),
  swatch: document.getElementById("icpColorSwatch"),
  colorName: document.getElementById("icpColorName"),
  colorPosition: document.getElementById("icpColorPosition"),
  hex: document.getElementById("icpHex"),
  rgb: document.getElementById("icpRgb"),
  hsl: document.getElementById("icpHsl"),
  copyAllBtn: document.getElementById("icpCopyAllBtn"),
  resetBtn: document.getElementById("icpResetBtn"),
  history: document.getElementById("icpHistory"),
  clearHistoryBtn: document.getElementById("icpClearHistoryBtn"),
  downloadBtn: document.getElementById("icpDownloadBtn"),
  status: document.getElementById("icpStatus"),
  year: document.getElementById("icpYear")
};

const ICP_MAX_FILE_BYTES = 20 * 1024 * 1024;
const ICP_MAX_PIXELS = 40_000_000;
const ICP_MAX_DIMENSION = 12_000;
const ICP_MAX_HISTORY = 18;

let icpCurrentImage = null;
let icpCurrentFileUrl = null;
let icpPickedColors = [];
let icpSelectedColor = null;
let icpLoadToken = 0;

icp.year.textContent = new Date().getFullYear();

icp.chooseBtn.addEventListener("click", () => icp.fileInput.click());
icp.changeImageBtn.addEventListener("click", () => icp.fileInput.click());

icp.fileInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];

  if (file) {
    icpLoadFile(file);
  }

  // Allow the same file to be selected again.
  event.target.value = "";
});

icp.canvas.addEventListener("click", (event) => {
  icpPickFromPointer(event);
});

icp.canvas.addEventListener("keydown", (event) => {
  if (!icpCurrentImage || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) {
    return;
  }

  event.preventDefault();

  if (event.key === "Enter" || event.key === " ") {
    const markerX = Number(icp.marker.dataset.x || icp.canvas.width / 2);
    const markerY = Number(icp.marker.dataset.y || icp.canvas.height / 2);
    icpPickPixel(markerX, markerY);
    return;
  }

  let x = Number(icp.marker.dataset.x || Math.floor(icp.canvas.width / 2));
  let y = Number(icp.marker.dataset.y || Math.floor(icp.canvas.height / 2));

  if (event.key === "ArrowLeft") x--;
  if (event.key === "ArrowRight") x++;
  if (event.key === "ArrowUp") y--;
  if (event.key === "ArrowDown") y++;

  x = Math.max(0, Math.min(icp.canvas.width - 1, x));
  y = Math.max(0, Math.min(icp.canvas.height - 1, y));

  icpPickPixel(x, y);
});

icp.resetBtn.addEventListener("click", () => {
  icpSelectedColor = null;
  icp.marker.hidden = true;
  icp.swatch.style.backgroundColor = "#eaf0f8";
  icp.colorName.textContent = "No color selected";
  icp.colorPosition.textContent = "Click the image to choose a color";
  icp.hex.value = "—";
  icp.rgb.value = "—";
  icp.hsl.value = "—";

  icp.setCopyButtonsEnabled(false);
  icp.resetBtn.disabled = true;
  icp.copyAllBtn.disabled = true;

  icp.setStatus("Selection reset. Click the image to pick another color.");
});

icp.copyAllBtn.addEventListener("click", async () => {
  if (!icpSelectedColor) return;

  const text = [
    `HEX: ${icpSelectedColor.hex}`,
    `RGB: ${icpSelectedColor.rgb}`,
    `HSL: ${icpSelectedColor.hsl}`
  ].join("\n");

  await icpCopyText(text, "All color codes copied.");
});

icp.clearHistoryBtn.addEventListener("click", () => {
  icpPickedColors = [];
  icpRenderHistory();
  icp.setStatus("Recent colors cleared.");
});

icp.downloadBtn.addEventListener("click", () => {
  if (icpPickedColors.length === 0) return;

  const lines = [
    "DigiiFox Image Color Picker - Color Palette",
    `Exported: ${new Date().toLocaleString()}`,
    "",
    "HEX\tRGB\tHSL\tPixel Position",
    ...icpPickedColors.map((color) =>
      `${color.hex}\t${color.rgb}\t${color.hsl}\t${color.x}, ${color.y}`
    )
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "digiifox-color-palette.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  icp.setStatus("Your color palette has been downloaded.");
});

// Copy individual color codes.
document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const field = document.getElementById(button.dataset.copy);

    if (!field || !icpSelectedColor) return;

    const originalText = button.textContent;
    await icpCopyText(field.value, `${field.value} copied.`);

    button.textContent = "Copied!";
    setTimeout(() => {
      button.textContent = originalText;
    }, 1200);
  });
});

// Drag and drop.
["dragenter", "dragover"].forEach((eventName) => {
  icp.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    icp.dropZone.classList.add("icp-drag-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  icp.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    icp.dropZone.classList.remove("icp-drag-active");
  });
});

icp.dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer && event.dataTransfer.files[0];

  if (file) {
    icpLoadFile(file);
  }
});

async function icpLoadFile(file) {
  const token = ++icpLoadToken;

  if (!file.type.startsWith("image/")) {
    icp.setStatus("Please select a valid image file.");
    return;
  }

  if (file.size > ICP_MAX_FILE_BYTES) {
    icp.setStatus("This image is too large. Please choose an image smaller than 20 MB.");
    return;
  }

  icp.setStatus("Loading image...");

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    if (token !== icpLoadToken) {
      URL.revokeObjectURL(objectUrl);
      return;
    }

    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const pixels = width * height;

    if (
      width > ICP_MAX_DIMENSION ||
      height > ICP_MAX_DIMENSION ||
      pixels > ICP_MAX_PIXELS
    ) {
      URL.revokeObjectURL(objectUrl);
      icp.setStatus("This image is too large to process safely. Maximum dimensions are 12,000 × 12,000 pixels and 40 megapixels.");
      return;
    }

    try {
      icp.canvas.width = width;
      icp.canvas.height = height;

      const context = icp.canvas.getContext("2d", {
        willReadFrequently: true
      });

      if (!context) {
        throw new Error("Canvas is unavailable.");
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0);

      // Verify pixel access is available before accepting the image.
      context.getImageData(0, 0, 1, 1);

      if (icpCurrentFileUrl) {
        URL.revokeObjectURL(icpCurrentFileUrl);
      }

      icpCurrentFileUrl = objectUrl;
      icpCurrentImage = image;
      icpSelectedColor = null;
      icpPickedColors = [];
      icpRenderHistory();

      icp.uploadEmpty.hidden = true;
      icp.imageArea.hidden = false;
      icp.marker.hidden = true;

      icp.swatch.style.backgroundColor = "#eaf0f8";
      icp.colorName.textContent = "No color selected";
      icp.colorPosition.textContent = "Click the image to choose a color";
      icp.hex.value = "—";
      icp.rgb.value = "—";
      icp.hsl.value = "—";

      icp.setCopyButtonsEnabled(false);
      icp.copyAllBtn.disabled = true;
      icp.resetBtn.disabled = true;

      icp.setStatus(`Image loaded: ${width.toLocaleString()} × ${height.toLocaleString()} pixels. Click anywhere on the image to pick a color.`);
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      console.error("Image Color Picker:", error);
      icp.setStatus("The image could not be read. Try another image format.");
    }
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);

    if (token === icpLoadToken) {
      icp.setStatus("The image could not be opened. Please try another image.");
    }
  };

  image.src = objectUrl;
}

function icpPickFromPointer(event) {
  if (!icpCurrentImage) return;

  const rect = icp.canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const scaleX = icp.canvas.width / rect.width;
  const scaleY = icp.canvas.height / rect.height;

  const x = Math.max(
    0,
    Math.min(icp.canvas.width - 1, Math.floor((event.clientX - rect.left) * scaleX))
  );

  const y = Math.max(
    0,
    Math.min(icp.canvas.height - 1, Math.floor((event.clientY - rect.top) * scaleY))
  );

  icpPickPixel(x, y);
}

function icpPickPixel(x, y) {
  if (!icpCurrentImage) return;

  const context = icp.canvas.getContext("2d", {
    willReadFrequently: true
  });

  try {
    const pixel = context.getImageData(x, y, 1, 1).data;
    const [r, g, b, alpha] = pixel;

    // Composite transparent pixels against white so the displayed HEX/RGB/HSL
    // describes a practical visible color instead of an invisible RGB value.
    const a = alpha / 255;
    const red = Math.round(r * a + 255 * (1 - a));
    const green = Math.round(g * a + 255 * (1 - a));
    const blue = Math.round(b * a + 255 * (1 - a));

    const color = {
      r: red,
      g: green,
      b: blue,
      hex: icpToHex(red, green, blue),
      rgb: `rgb(${red}, ${green}, ${blue})`,
      hsl: icpToHsl(red, green, blue),
      x,
      y
    };

    icpSelectedColor = color;
    icpDisplaySelectedColor(color);
    icpAddToHistory(color);
    icpPlaceMarker(x, y);
    icp.setStatus(`Picked ${color.hex} at pixel ${x}, ${y}.`);
  } catch (error) {
    console.error("Could not sample this pixel:", error);
    icp.setStatus("Unable to sample this pixel. Please try again.");
  }
}

function icpDisplaySelectedColor(color) {
  icp.swatch.style.backgroundColor = color.hex;
  icp.colorName.textContent = color.hex;
  icp.colorPosition.textContent = `Pixel: X ${color.x}, Y ${color.y}`;

  icp.hex.value = color.hex;
  icp.rgb.value = color.rgb;
  icp.hsl.value = color.hsl;

  icp.setCopyButtonsEnabled(true);
  icp.copyAllBtn.disabled = false;
  icp.resetBtn.disabled = false;
}

function icpPlaceMarker(x, y) {
  // Position the marker using the canvas's intrinsic pixel coordinates.
  const rect = icp.canvas.getBoundingClientRect();
  const scaleX = rect.width / icp.canvas.width;
  const scaleY = rect.height / icp.canvas.height;

  icp.marker.style.left = `${(x + 0.5) * scaleX}px`;
  icp.marker.style.top = `${(y + 0.5) * scaleY}px`;
  icp.marker.style.backgroundColor = icpSelectedColor.hex;
  icp.marker.dataset.x = x;
  icp.marker.dataset.y = y;
  icp.marker.hidden = false;
}

function icpAddToHistory(color) {
  // Move duplicate colors to the beginning instead of storing duplicates.
  icpPickedColors = icpPickedColors.filter((item) => item.hex !== color.hex);

  icpPickedColors.unshift({ ...color });
  icpPickedColors = icpPickedColors.slice(0, ICP_MAX_HISTORY);

  icpRenderHistory();
}

function icpRenderHistory() {
  icp.history.replaceChildren();

  if (icpPickedColors.length === 0) {
    const empty = document.createElement("p");
    empty.className = "icp-empty-history";
    empty.textContent = "Your picked colors will appear here.";
    icp.history.appendChild(empty);
  } else {
    icpPickedColors.forEach((color) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icp-history-color";
      button.title = `Select ${color.hex}`;
      button.setAttribute("aria-label", `Select color ${color.hex}`);

      const swatch = document.createElement("span");
      swatch.className = "icp-history-swatch";
      swatch.style.backgroundColor = color.hex;

      const hex = document.createElement("span");
      hex.className = "icp-history-hex";
      hex.textContent = color.hex;

      button.append(swatch, hex);

      button.addEventListener("click", () => {
        icpSelectedColor = { ...color };
        icpDisplaySelectedColor(color);
        icpPlaceMarker(color.x, color.y);
        icp.setStatus(`Selected recent color ${color.hex}.`);
      });

      icp.history.appendChild(button);
    });
  }

  icp.clearHistoryBtn.disabled = icpPickedColors.length === 0;
  icp.downloadBtn.disabled = icpPickedColors.length === 0;
}

function icpToHex(r, g, b) {
  return "#" + [r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function icpToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }

    h *= 60;

    if (h < 0) {
      h += 360;
    }
  }

  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function icpSetCopyButtonsEnabled(enabled) {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.disabled = !enabled;
  });
}

async function icpCopyText(text, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for local development or browsers without Clipboard API access.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";

      document.body.appendChild(textarea);
      textarea.select();

      const copied = document.execCommand("copy");
      textarea.remove();

      if (!copied) {
        throw new Error("Clipboard copy was not available.");
      }
    }

    icp.setStatus(successMessage);
  } catch (error) {
    console.error("Copy failed:", error);
    icp.setStatus("Copy was blocked by the browser. Select and copy the color code manually.");
  }
}

function icpSetStatus(message) {
  icp.status.textContent = message;
}

// Use one status helper consistently.
icp.setStatus = icpSetStatus;

// Release the active image URL when leaving the page.
window.addEventListener("pagehide", () => {
  if (icpCurrentFileUrl) {
    URL.revokeObjectURL(icpCurrentFileUrl);
    icpCurrentFileUrl = null;
  }
});