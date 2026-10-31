/* =====================================================
   DIGIIFOX LENGTH CONVERTER
   All conversions run locally in the browser.
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // -------------------------------------------------
    // DOM ELEMENTS
    // -------------------------------------------------

    const form = document.getElementById("lengthForm");

    const valueInput = document.getElementById("lengthValue");
    const fromUnit = document.getElementById("fromUnit");
    const toUnit = document.getElementById("toUnit");

    const swapButton = document.getElementById("swapUnits");
    const resetButton = document.getElementById("resetLength");

    const errorBox = document.getElementById("lengthError");
    const resultPanel = document.getElementById("lengthResult");

    const resultInput = document.getElementById("resultInput");
    const resultValue = document.getElementById("resultValue");
    const resultUnit = document.getElementById("resultUnit");
    const resultSummary = document.getElementById("resultSummary");
    const resultFormula = document.getElementById("resultFormula");

    const copyButton = document.getElementById("copyLengthResult");
    const copyMessage = document.getElementById("copyLengthMessage");

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const currentYear = document.getElementById("currentYear");


    // -------------------------------------------------
    // UNIT DEFINITIONS
    //
    // Each factor represents the number of meters
    // in one unit.
    // -------------------------------------------------

    const units = {
        mm: {
            name: "Millimeter",
            plural: "Millimeters",
            symbol: "mm",
            factor: 0.001
        },

        cm: {
            name: "Centimeter",
            plural: "Centimeters",
            symbol: "cm",
            factor: 0.01
        },

        m: {
            name: "Meter",
            plural: "Meters",
            symbol: "m",
            factor: 1
        },

        km: {
            name: "Kilometer",
            plural: "Kilometers",
            symbol: "km",
            factor: 1000
        },

        in: {
            name: "Inch",
            plural: "Inches",
            symbol: "in",
            factor: 0.0254
        },

        ft: {
            name: "Foot",
            plural: "Feet",
            symbol: "ft",
            factor: 0.3048
        },

        yd: {
            name: "Yard",
            plural: "Yards",
            symbol: "yd",
            factor: 0.9144
        },

        mi: {
            name: "Mile",
            plural: "Miles",
            symbol: "mi",
            factor: 1609.344
        },

        nmi: {
            name: "Nautical mile",
            plural: "Nautical miles",
            symbol: "nmi",
            factor: 1852
        }
    };


    // -------------------------------------------------
    // FORMATTERS
    // -------------------------------------------------

    const numberFormatter = new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 12
    });

    const preciseFormatter = new Intl.NumberFormat("en-IN", {
        maximumSignificantDigits: 12
    });


    function formatNumber(number) {
        if (!Number.isFinite(number)) {
            return "Result is outside the supported range";
        }

        if (number === 0) {
            return "0";
        }

        const absoluteNumber = Math.abs(number);

        // Avoid displaying tiny results as zero.
        if (absoluteNumber < 0.000000001 ||
            absoluteNumber >= 1e15) {
            return number.toExponential(8);
        }

        return numberFormatter.format(number);
    }


    function formatPrecise(number) {
        if (!Number.isFinite(number)) {
            return "Not available";
        }

        if (number === 0) {
            return "0";
        }

        const absoluteNumber = Math.abs(number);

        if (absoluteNumber < 0.000000001 ||
            absoluteNumber >= 1e15) {
            return number.toExponential(8);
        }

        return preciseFormatter.format(number);
    }


    function formatInputNumber(number) {
        return String(number);
    }


    // -------------------------------------------------
    // UNIT LABELS
    // -------------------------------------------------

    function getUnitLabel(unit, amount) {
        if (amount === 1 || amount === -1) {
            return unit.name;
        }

        return unit.plural;
    }


    function getFullUnitName(unit, amount) {
        return `${formatNumber(amount)} ${getUnitLabel(unit, amount)}`;
    }


    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        resultPanel.hidden = true;
        copyMessage.textContent = "";
    }


    function clearError() {
        errorBox.textContent = "";
        errorBox.hidden = true;
    }


    function validateInput() {
        const rawValue = valueInput.value.trim();

        if (rawValue === "") {
            showError("Please enter a length value.");
            valueInput.focus();
            return null;
        }

        const value = Number(rawValue);

        if (!Number.isFinite(value)) {
            showError("Please enter a valid numeric value.");
            valueInput.focus();
            return null;
        }

        if (value < 0) {
            showError("Length cannot be negative. Please enter zero or a positive value.");
            valueInput.focus();
            return null;
        }

        if (value > 1e100) {
            showError("Please enter a smaller value to keep the conversion within the supported range.");
            valueInput.focus();
            return null;
        }

        if (!units[fromUnit.value] || !units[toUnit.value]) {
            showError("Please select valid source and target units.");
            return null;
        }

        return value;
    }


    // -------------------------------------------------
    // CONVERSION FORMULA
    //
    // Result = Input value × Source factor
    //          ÷ Target factor
    //
    // Source factor and target factor are both
    // expressed in meters.
    // -------------------------------------------------

    function convertLength(value, source, target) {
        const meters = value * source.factor;
        const result = meters / target.factor;

        if (!Number.isFinite(result)) {
            return null;
        }

        return {
            meters,
            result
        };
    }


    // -------------------------------------------------
    // BUILD FORMULA DESCRIPTION
    // -------------------------------------------------

    function buildFormula(value, source, target) {
        const sourceFactor = source.factor;
        const targetFactor = target.factor;

        const sourceText = formatPrecise(sourceFactor);
        const targetText = formatPrecise(targetFactor);

        const sourcePart =
            `${formatInputNumber(value)} × ${sourceText}`;

        const metersPart =
            `(${sourcePart}) ÷ ${targetText}`;

        return `(${formatInputNumber(value)} × ${sourceText}) ÷ ${targetText}`;
    }


    // -------------------------------------------------
    // DISPLAY RESULT
    // -------------------------------------------------

    function calculateLength() {
        clearError();
        copyMessage.textContent = "";

        const value = validateInput();

        if (value === null) {
            return;
        }

        const source = units[fromUnit.value];
        const target = units[toUnit.value];

        const conversion = convertLength(value, source, target);

        if (!conversion) {
            showError(
                "The result is outside the supported numerical range. Try a smaller value."
            );
            return;
        }

        const result = conversion.result;

        resultInput.textContent =
            `${formatNumber(value)} ${source.symbol}`;

        resultValue.textContent = formatNumber(result);

        resultUnit.textContent =
            `${getUnitLabel(target, result)} (${target.symbol})`;

        resultSummary.textContent =
            `${getFullUnitName(source, value)} is equal to ` +
            `${getFullUnitName(target, result)}.`;

        resultFormula.textContent = buildFormula(
            value,
            source,
            target
        );

        resultPanel.hidden = false;
    }


    // -------------------------------------------------
    // FORM SUBMISSION
    // -------------------------------------------------

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        calculateLength();
    });


    // -------------------------------------------------
    // INSTANT CONVERSION
    // -------------------------------------------------

    valueInput.addEventListener("input", () => {
        if (valueInput.value.trim() === "") {
            clearError();
            resultPanel.hidden = true;
            copyMessage.textContent = "";
            return;
        }

        calculateLength();
    });


    fromUnit.addEventListener("change", calculateLength);
    toUnit.addEventListener("change", calculateLength);


    // -------------------------------------------------
    // SWAP UNITS
    // -------------------------------------------------

    swapButton.addEventListener("click", () => {
        const previousFrom = fromUnit.value;

        fromUnit.value = toUnit.value;
        toUnit.value = previousFrom;

        clearError();
        copyMessage.textContent = "";

        calculateLength();
    });


    // -------------------------------------------------
    // RESET
    // -------------------------------------------------

    resetButton.addEventListener("click", () => {
        valueInput.value = "1";
        fromUnit.value = "m";
        toUnit.value = "km";

        clearError();
        copyMessage.textContent = "";

        calculateLength();
    });


    // -------------------------------------------------
    // COPY RESULT
    // -------------------------------------------------

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        // Fallback for local development or older browsers.
        const temporaryInput = document.createElement("textarea");

        temporaryInput.value = text;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";

        document.body.appendChild(temporaryInput);

        temporaryInput.select();
        temporaryInput.setSelectionRange(
            0,
            temporaryInput.value.length
        );

        const successful = document.execCommand("copy");

        temporaryInput.remove();

        if (!successful) {
            throw new Error("Copy operation failed.");
        }
    }


    copyButton.addEventListener("click", async () => {
        if (resultPanel.hidden) {
            return;
        }

        const textToCopy =
            `${resultInput.textContent} = ` +
            `${resultValue.textContent} ${resultUnit.textContent}`;

        try {
            await copyText(textToCopy);

            copyMessage.textContent = "Result copied successfully!";
        } catch (error) {
            copyMessage.textContent =
                "Unable to copy automatically. Please select and copy the result.";
        }
    });


    // -------------------------------------------------
    // MOBILE NAVIGATION
    // -------------------------------------------------

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("active");

            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        });

        mainNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                mainNav.classList.remove("active");

                menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );
            });
        });
    }


    // -------------------------------------------------
    // DYNAMIC FOOTER YEAR
    // -------------------------------------------------

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    // -------------------------------------------------
    // INITIAL RESULT
    // -------------------------------------------------

    calculateLength();

});