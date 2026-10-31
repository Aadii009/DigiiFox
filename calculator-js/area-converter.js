/* =========================================
   DIGIIFOX AREA CONVERTER
   File: area-converter.js
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------
    // ELEMENTS
    // -------------------------------------

    const form = document.getElementById("areaForm");
    const valueInput = document.getElementById("areaValue");
    const fromUnit = document.getElementById("areaFromUnit");
    const toUnit = document.getElementById("areaToUnit");

    const swapButton = document.getElementById("areaSwap");
    const resetButton = document.getElementById("areaReset");
    const copyButton = document.getElementById("areaCopy");

    const errorMessage = document.getElementById("areaError");
    const resultInput = document.getElementById("areaResultInput");
    const resultValue = document.getElementById("areaResultValue");
    const resultUnit = document.getElementById("areaResultUnit");
    const resultSummary = document.getElementById("areaResultSummary");
    const resultFormula = document.getElementById("areaResultFormula");
    const resultSteps = document.getElementById("areaResultSteps");
    const copyMessage = document.getElementById("areaCopyMessage");

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const currentYear = document.getElementById("currentYear");

    // -------------------------------------
    // UNIT DEFINITIONS
    //
    // factor = square metres represented
    // by one unit.
    // -------------------------------------

    const units = {
        mm2: {
            name: "square millimetres",
            singular: "square millimetre",
            symbol: "mm²",
            factor: 0.000001
        },

        cm2: {
            name: "square centimetres",
            singular: "square centimetre",
            symbol: "cm²",
            factor: 0.0001
        },

        m2: {
            name: "square metres",
            singular: "square metre",
            symbol: "m²",
            factor: 1
        },

        km2: {
            name: "square kilometres",
            singular: "square kilometre",
            symbol: "km²",
            factor: 1000000
        },

        hectare: {
            name: "hectares",
            singular: "hectare",
            symbol: "ha",
            factor: 10000
        },

        acre: {
            name: "acres",
            singular: "acre",
            symbol: "ac",
            factor: 4046.8564224
        },

        in2: {
            name: "square inches",
            singular: "square inch",
            symbol: "in²",
            factor: 0.00064516
        },

        ft2: {
            name: "square feet",
            singular: "square foot",
            symbol: "ft²",
            factor: 0.09290304
        },

        yd2: {
            name: "square yards",
            singular: "square yard",
            symbol: "yd²",
            factor: 0.83612736
        }
    };

    // -------------------------------------
    // NUMBER FORMATTING
    // -------------------------------------

    function formatNumber(number) {
        if (!Number.isFinite(number)) {
            return "Invalid result";
        }

        if (Object.is(number, -0) || number === 0) {
            return "0";
        }

        return Number(number.toPrecision(10)).toLocaleString("en-US", {
            useGrouping: false,
            maximumFractionDigits: 8
        });
    }

    function formatCalculationNumber(number) {
        return Number(number.toPrecision(12)).toString();
    }

    // -------------------------------------
    // ERROR HANDLING
    // -------------------------------------

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
    }

    function clearError() {
        errorMessage.textContent = "";
        errorMessage.hidden = true;
    }

    function clearCopyMessage() {
        copyMessage.textContent = "";
    }

    // -------------------------------------
    // CONVERSION DETAILS
    // -------------------------------------

    function getConversionDetails(value, source, target, result) {
        const sourceUnit = units[source];
        const targetUnit = units[target];

        const input = formatCalculationNumber(value);
        const output = formatNumber(result);

        if (source === target) {
            return {
                formula: "Result = Input",
                steps: `${input} ${sourceUnit.symbol} = ${output} ${targetUnit.symbol}`
            };
        }

        const sourceFactor = sourceUnit.factor;
        const targetFactor = targetUnit.factor;

        const formattedSourceFactor =
            formatCalculationNumber(sourceFactor);

        const formattedTargetFactor =
            formatCalculationNumber(targetFactor);

        return {
            formula: "Result = Input × Source factor ÷ Target factor",

            steps:
                `${input} × ${formattedSourceFactor} ÷ ` +
                `${formattedTargetFactor} = ${output} ${targetUnit.symbol}`
        };
    }

    // -------------------------------------
    // MAIN CONVERSION
    // -------------------------------------

    function convertArea() {
        clearError();
        clearCopyMessage();

        const rawValue = valueInput.value.trim();
        const source = fromUnit.value;
        const target = toUnit.value;

        if (rawValue === "") {
            showError("Please enter an area value.");
            return null;
        }

        const value = Number(rawValue);

        if (!Number.isFinite(value)) {
            showError("Please enter a valid numeric area.");
            return null;
        }

        if (value < 0) {
            showError("Area cannot be negative. Please enter zero or a positive value.");
            return null;
        }

        if (!Object.prototype.hasOwnProperty.call(units, source) ||
            !Object.prototype.hasOwnProperty.call(units, target)) {
            showError("Please select valid area units.");
            return null;
        }

        // Reject extremely large values that would overflow
        // the intermediate square-metre calculation.
        if (value > Number.MAX_VALUE / units[source].factor) {
            showError("This value is too large to convert safely.");
            return null;
        }

        // Convert source unit to square metres.
        const squareMetres = value * units[source].factor;

        // Convert square metres to the target unit.
        const result = squareMetres / units[target].factor;

        if (!Number.isFinite(result)) {
            showError("The result is outside the supported calculation range.");
            return null;
        }

        const formattedInput = formatNumber(value);
        const formattedResult = formatNumber(result);

        const sourceUnit = units[source];
        const targetUnit = units[target];

        // Update the result panel.
        resultInput.textContent =
            `${formattedInput} ${sourceUnit.symbol}`;

        resultValue.textContent = formattedResult;
        resultUnit.textContent = targetUnit.symbol;

        const sourceName =
            value === 1 ? sourceUnit.singular : sourceUnit.name;

        const targetName =
            result === 1 ? targetUnit.singular : targetUnit.name;

        resultSummary.textContent =
            `${formattedInput} ${sourceName} equals ` +
            `${formattedResult} ${targetName}.`;

        const details = getConversionDetails(
            value,
            source,
            target,
            result
        );

        resultFormula.textContent = details.formula;
        resultSteps.textContent = details.steps;

        return {
            inputValue: value,
            resultValue: result,
            source,
            target
        };
    }

    // -------------------------------------
    // FORM SUBMISSION
    // -------------------------------------

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        convertArea();
    });

    // -------------------------------------
    // LIVE CONVERSION
    // -------------------------------------

    valueInput.addEventListener("input", convertArea);
    fromUnit.addEventListener("change", convertArea);
    toUnit.addEventListener("change", convertArea);

    // -------------------------------------
    // SWAP UNITS
    // -------------------------------------

    swapButton.addEventListener("click", () => {
        const conversion = convertArea();

        if (!conversion) {
            return;
        }

        const previousResult = conversion.resultValue;
        const previousSource = fromUnit.value;

        fromUnit.value = toUnit.value;
        toUnit.value = previousSource;

        // Use the converted value as the new input.
        valueInput.value = formatCalculationNumber(previousResult);

        convertArea();
    });

    // -------------------------------------
    // RESET
    // -------------------------------------

    resetButton.addEventListener("click", () => {
        valueInput.value = "1";
        fromUnit.value = "m2";
        toUnit.value = "ft2";

        clearError();
        clearCopyMessage();

        convertArea();
        valueInput.focus();
    });

    // -------------------------------------
    // COPY RESULT
    // -------------------------------------

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        // Fallback for local development and older browsers.
        const temporaryInput = document.createElement("textarea");

        temporaryInput.value = text;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";

        document.body.appendChild(temporaryInput);
        temporaryInput.select();

        const copied = document.execCommand("copy");

        temporaryInput.remove();

        if (!copied) {
            throw new Error("Copy operation was unsuccessful.");
        }
    }

    copyButton.addEventListener("click", async () => {
        const conversion = convertArea();

        if (!conversion) {
            return;
        }

        const sourceSymbol = units[conversion.source].symbol;
        const targetSymbol = units[conversion.target].symbol;

        const text =
            `${formatNumber(conversion.inputValue)} ${sourceSymbol} = ` +
            `${formatNumber(conversion.resultValue)} ${targetSymbol}`;

        try {
            await copyText(text);

            copyMessage.textContent = "Result copied successfully.";
            copyButton.textContent = "Copied!";

            window.setTimeout(() => {
                copyButton.textContent = "Copy result";
                copyMessage.textContent = "";
            }, 1800);

        } catch (error) {
            copyMessage.textContent =
                "Unable to copy automatically. Please copy the result manually.";
        }
    });

    // -------------------------------------
    // MOBILE NAVIGATION
    // -------------------------------------

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("active");

            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation" : "Toggle navigation"
            );

            menuToggle.textContent = isOpen ? "✕" : "☰";
        });

        mainNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                mainNav.classList.remove("active");

                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Toggle navigation");
                menuToggle.textContent = "☰";
            });
        });
    }

    // -------------------------------------
    // FOOTER YEAR
    // -------------------------------------

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    // -------------------------------------
    // INITIAL CONVERSION
    // -------------------------------------

    convertArea();
});