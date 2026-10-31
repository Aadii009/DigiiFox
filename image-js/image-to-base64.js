"use strict";

const itb = {
  file: document.getElementById("itb-file"),
  dropzone: document.getElementById("itb-dropzone"),
  status: document.getElementById("itb-status"),
  imageCard: document.getElementById("itb-image-card"),
  preview: document.getElementById("itb-preview"),
  name: document.getElementById("itb-name"),
  size: document.getElementById("itb-size"),
  format: document.getElementById("itb-format"),
  dimensions: document.getElementById("itb-dimensions"),
  remove: document.getElementById("itb-remove"),
  outputType: document.getElementById("itb-output-type"),
  lineFormat: document.getElementById("itb-line-format"),
  convert: document.getElementById("itb-convert"),
  clear: document.getElementById("itb-clear"),
  output: document.getElementById("itb-output"),
  outputSize: document.getElementById("itb-output-size"),
  outputStatus: document.getElementById("itb-output-status"),
  copy: document.getElementById("itb-copy"),
  download: document.getElementById("itb-download"),
  copyStatus: document.getElementById("itb-copy-status"),
  year: document.getElementById("itb-year")
};

const ITB_MAX_SIZE = 15 * 1024 * 1024;
const ITB_MAX_DIMENSION = 12000;
const ITB_MAX_PIXELS = 40000000;

let itbFile = null;
let itbDataUrl = "";
let itbObjectUrl = "";
let itbConversionVersion = 0;

itb.year.textContent = new Date().getFullYear();

function itbSetStatus(message, isError = false) {
  itb.status.textContent = message;
  itb.status.classList.toggle("itb-error", isError);
}

function itbFormatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function itbInvalidateOutput() {
  itbConversionVersion++;
  itb.output.value = "";
  itb.outputSize.textContent = "Output size: —";
  itb.outputStatus.textContent = "Not converted";
  itb.copy.disabled = true;
  itb.download.disabled = true;
  itb.copyStatus.textContent = "";
}

function itbLoadImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (
        !width ||
        !height ||
        width > ITB_MAX_DIMENSION ||
        height > ITB_MAX_DIMENSION ||
        width * height > ITB_MAX_PIXELS
      ) {
        reject(new Error(
          "This image exceeds the supported dimensions of 12,000 pixels per side or 40 megapixels."
        ));
        return;
      }

      resolve({ width, height });
    };

    image.onerror = () => {
      reject(new Error("This image could not be opened by your browser."));
    };

    image.src = url;
  });
}

function itbReadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The image could not be converted to text."));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error("Could not read this file. Please try another image."));
    };

    reader.onabort = () => {
      reject(new Error("Reading the image was cancelled."));
    };

    reader.readAsDataURL(file);
  });
}

async function itbSelectFile(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    itbSetStatus("Please select a valid image file.", true);
    return;
  }

  if (file.size > ITB_MAX_SIZE) {
    itbSetStatus("The image exceeds the 15 MB file-size limit.", true);
    return;
  }

  const version = ++itbConversionVersion;

  itbSetStatus("Reading your image...");
  itb.convert.disabled = true;
  itbInvalidateOutput();

  if (itbObjectUrl) {
    URL.revokeObjectURL(itbObjectUrl);
    itbObjectUrl = "";
  }

  itbFile = null;
  itbDataUrl = "";

  try {
    const objectUrl = URL.createObjectURL(file);
    itbObjectUrl = objectUrl;

    const dimensions = await itbLoadImageDimensions(objectUrl);

    if (version !== itbConversionVersion) return;

    itbFile = file;
    itb.preview.src = objectUrl;
    itb.name.textContent = file.name;
    itb.size.textContent = itbFormatBytes(file.size);
    itb.format.textContent = file.type || "Unknown";
    itb.dimensions.textContent =
      `${dimensions.width} × ${dimensions.height} px`;

    itb.imageCard.hidden = false;
    itb.convert.disabled = false;

    itbSetStatus("Image loaded. Choose your output type and convert.");
  } catch (error) {
    if (version !== itbConversionVersion) return;

    itbSetStatus(error.message, true);
    itb.imageCard.hidden = true;
    itbFile = null;
  }
}

function itbWrapText(text, lineLength = 76) {
  const lines = [];

  for (let index = 0; index < text.length; index += lineLength) {
    lines.push(text.slice(index, index + lineLength));
  }

  return lines.join("\n");
}

function itbGenerateOutput(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    throw new Error("The browser returned an unexpected image data URL.");
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const outputType = itb.outputType.value;
  const formatting = itb.lineFormat.value;

  if (outputType === "base64") {
    return formatting === "wrapped" ? itbWrapText(base64) : base64;
  }

  if (outputType === "html") {
    // Keep HTML markup on one line so the Data URL remains valid.
    const safeMime = dataUrl.slice(5, dataUrl.indexOf(";"));

    return `<img src="${dataUrl}" alt="Embedded image" />`;
  }

  return formatting === "wrapped"
    ? `${dataUrl.slice(0, commaIndex + 1)}\n${itbWrapText(base64)}`
    : dataUrl;
}

async function itbConvert() {
  if (!itbFile) {
    itbSetStatus("Please select an image first.", true);
    return;
  }

  const version = ++itbConversionVersion;

  itb.convert.disabled = true;
  itb.copy.disabled = true;
  itb.download.disabled = true;
  itb.output.value = "";
  itb.outputStatus.textContent = "Converting...";
  itb.outputSize.textContent = "Output size: —";
  itb.copyStatus.textContent = "";

  itbSetStatus("Converting your image to Base64...");

  try {
    const dataUrl = await itbReadFileAsDataUrl(itbFile);

    if (version !== itbConversionVersion) return;

    itbDataUrl = dataUrl;

    const output = itbGenerateOutput(dataUrl);

    itb.output.value = output;
    itb.outputSize.textContent =
      `Output size: ${itbFormatBytes(new Blob([output]).size)}`;
    itb.outputStatus.textContent = "Conversion complete";
    itb.copy.disabled = false;
    itb.download.disabled = false;

    itbSetStatus("Conversion successful. You can now copy or download the output.");
  } catch (error) {
    if (version !== itbConversionVersion) return;

    itbSetStatus(error.message || "Conversion failed.", true);
    itb.outputStatus.textContent = "Conversion failed";
  } finally {
    if (version === itbConversionVersion) {
      itb.convert.disabled = !itbFile;
    }
  }
}

async function itbCopyOutput() {
  const text = itb.output.value;

  if (!text) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      itb.output.focus();
      itb.output.select();

      const copied = document.execCommand("copy");

      if (!copied) {
        throw new Error("Automatic copying is not supported.");
      }

      itb.output.setSelectionRange(0, 0);
    }

    itb.copyStatus.textContent = "Output copied to clipboard.";
  } catch (error) {
    itb.output.focus();
    itb.output.select();

    itb.copyStatus.textContent =
      "Automatic copy failed. The output is selected; press Ctrl+C to copy it.";
  }
}

function itbDownloadOutput() {
  const text = itb.output.value;

  if (!text) return;

  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "digii-fox-image-base64.txt";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  itb.copyStatus.textContent = "Your text file has been downloaded.";
}

function itbStartOver() {
  itbConversionVersion++;

  if (itbObjectUrl) {
    URL.revokeObjectURL(itbObjectUrl);
    itbObjectUrl = "";
  }

  itbFile = null;
  itbDataUrl = "";

  itb.file.value = "";
  itb.preview.removeAttribute("src");
  itb.imageCard.hidden = true;

  itb.name.textContent = "—";
  itb.size.textContent = "—";
  itb.format.textContent = "—";
  itb.dimensions.textContent = "—";

  itb.outputType.value = "dataurl";
  itb.lineFormat.value = "single";
  itb.output.value = "";

  itb.outputSize.textContent = "Output size: —";
  itb.outputStatus.textContent = "Not converted";
  itb.copyStatus.textContent = "";

  itb.convert.disabled = true;
  itb.copy.disabled = true;
  itb.download.disabled = true;

  itbSetStatus("No image selected yet.");
}

itb.file.addEventListener("change", event => {
  const file = event.target.files && event.target.files[0];

  if (file) {
    itbSelectFile(file);
  }

  // Allow the same image to be selected again.
  itb.file.value = "";
});

itb.dropzone.addEventListener("dragover", event => {
  event.preventDefault();
  itb.dropzone.classList.add("itb-dragging");
});

itb.dropzone.addEventListener("dragleave", event => {
  if (!itb.dropzone.contains(event.relatedTarget)) {
    itb.dropzone.classList.remove("itb-dragging");
  }
});

itb.dropzone.addEventListener("drop", event => {
  event.preventDefault();
  itb.dropzone.classList.remove("itb-dragging");

  const file = event.dataTransfer.files &&
    event.dataTransfer.files[0];

  if (file) {
    itbSelectFile(file);
  }
});

itb.outputType.addEventListener("change", () => {
  itbInvalidateOutput();
  itbSetStatus(
    itbFile
      ? "Output type changed. Convert again to generate the new format."
      : "Choose an image to begin."
  );
});

itb.lineFormat.addEventListener("change", () => {
  itbInvalidateOutput();
  itbSetStatus(
    itbFile
      ? "Output formatting changed. Convert again to apply it."
      : "Choose an image to begin."
  );
});

itb.convert.addEventListener("click", itbConvert);
itb.copy.addEventListener("click", itbCopyOutput);
itb.download.addEventListener("click", itbDownloadOutput);
itb.remove.addEventListener("click", itbStartOver);
itb.clear.addEventListener("click", itbStartOver);