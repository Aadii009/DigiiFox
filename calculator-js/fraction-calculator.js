/* =========================================
   DIGIIFOX FRACTION CALCULATOR
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("fractionForm");
    const operationSelect = document.getElementById("fractionOperation");

    const numerator1 = document.getElementById("numerator1");
    const denominator1 = document.getElementById("denominator1");
    const numerator2 = document.getElementById("numerator2");
    const denominator2 = document.getElementById("denominator2");

    const firstFractionHeading = document.getElementById("firstFractionHeading");
    const secondFractionGroup = document.getElementById("secondFractionGroup");
    const fractionOperator = document.getElementById("fractionOperator");

    const errorMessage = document.getElementById("fractionError");
    const resultPanel = document.getElementById("fractionResultPanel");

    const resultNumerator = document.getElementById("fractionResultNumerator");
    const resultDenominator = document.getElementById("fractionResultDenominator");
    const mixedResult = document.getElementById("fractionMixedResult");
    const decimalResult = document.getElementById("fractionDecimalResult");
    const stepsList = document.getElementById("fractionSteps");

    const resetButton = document.getElementById("fractionResetButton");
    const exampleButton = document.getElementById("fractionExampleButton");
    const copyButton = document.getElementById("fractionCopyButton");
    const copyFeedback = document.getElementById("fractionCopyFeedback");

    const currentYear = document.getElementById("currentYear");
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    let lastResult = null;


    /* =========================================
       BIGINT FRACTION HELPERS
    ========================================= */

    function absolute(value) {
        return value < 0n ? -value : value;
    }


    function gcd(a, b) {
        a = absolute(a);
        b = absolute(b);

        while (b !== 0n) {
            const remainder = a % b;
            a = b;
            b = remainder;
        }

        return a;
    }


    function createFraction(numerator, denominator) {
        if (denominator === 0n) {
            throw new Error("The denominator cannot be zero.");
        }

        // Keep the denominator positive.
        if (denominator < 0n) {
            numerator = -numerator;
            denominator = -denominator;
        }

        const divisor = gcd(numerator, denominator);

        return {
            numerator: numerator / divisor,
            denominator: denominator / divisor
        };
    }


    function simplifyFraction(fraction) {
        return createFraction(
            fraction.numerator,
            fraction.denominator
        );
    }


    function fractionToString(fraction) {
        if (fraction.denominator === 1n) {
            return fraction.numerator.toString();
        }

        return `${fraction.numerator}/${fraction.denominator}`;
    }


    function isWholeNumber(fraction) {
        return fraction.denominator === 1n;
    }


    /* =========================================
       INPUT VALIDATION
    ========================================= */

    function readInteger(input, label) {
        const value = input.value.trim();

        if (value === "") {
            throw new Error(`Please enter the ${label}.`);
        }

        if (!/^-?\d+$/.test(value)) {
            throw new Error(`${label} must be a whole number.`);
        }

        /*
         * BigInt preserves integer precision.
         * Limit input length to prevent unnecessarily huge
         * calculations from extremely large user inputs.
         */
        if (value.replace("-", "").length > 100) {
            throw new Error(`${label} is too large. Enter up to 100 digits.`);
        }

        return BigInt(value);
    }


    function readFraction(numeratorInput, denominatorInput, label) {
        const numerator = readInteger(
            numeratorInput,
            `${label} numerator`
        );

        const denominator = readInteger(
            denominatorInput,
            `${label} denominator`
        );

        if (denominator === 0n) {
            throw new Error(`${label} denominator cannot be zero.`);
        }

        return createFraction(numerator, denominator);
    }


    /* =========================================
       FRACTION ARITHMETIC
    ========================================= */

    function addFractions(a, b) {
        return createFraction(
            a.numerator * b.denominator +
            b.numerator * a.denominator,

            a.denominator * b.denominator
        );
    }


    function subtractFractions(a, b) {
        return createFraction(
            a.numerator * b.denominator -
            b.numerator * a.denominator,

            a.denominator * b.denominator
        );
    }


    function multiplyFractions(a, b) {
        return createFraction(
            a.numerator * b.numerator,
            a.denominator * b.denominator
        );
    }


    function divideFractions(a, b) {
        if (b.numerator === 0n) {
            throw new Error("You cannot divide by a fraction equal to zero.");
        }

        return createFraction(
            a.numerator * b.denominator,
            a.denominator * b.numerator
        );
    }


    /* =========================================
       RESULT CONVERSIONS
    ========================================= */

    function toMixedNumber(fraction) {
        const numerator = fraction.numerator;
        const denominator = fraction.denominator;

        if (numerator === 0n) {
            return "0";
        }

        if (denominator === 1n) {
            return numerator.toString();
        }

        const whole = absolute(numerator) / denominator;
        const remainder = absolute(numerator) % denominator;
        const sign = numerator < 0n ? "-" : "";

        if (remainder === 0n) {
            return `${sign}${whole}`;
        }

        if (whole === 0n) {
            return `${sign}${remainder}/${denominator}`;
        }

        return `${sign}${whole} ${remainder}/${denominator}`;
    }


    function toDecimal(fraction) {
        const numerator = Number(fraction.numerator);
        const denominator = Number(fraction.denominator);

        const result = numerator / denominator;

        if (!Number.isFinite(result)) {
            return "Outside decimal range";
        }

        if (Object.is(result, -0)) {
            return "0";
        }

        return Number(result.toPrecision(12)).toString();
    }


    /* =========================================
       CALCULATION STEPS
    ========================================= */

    function addStep(text) {
        const item = document.createElement("li");

        // Use textContent to prevent HTML injection.
        item.textContent = text;

        stepsList.appendChild(item);
    }


    function buildSteps(operation, a, b, result) {
        stepsList.replaceChildren();

        if (operation === "simplify") {
            const originalNumerator = readInteger(
                numerator1,
                "numerator"
            );

            const originalDenominator = readInteger(
                denominator1,
                "denominator"
            );

            const divisor = gcd(
                originalNumerator,
                originalDenominator
            );

            addStep(
                `Start with ${originalNumerator}/${originalDenominator}.`
            );

            if (divisor === 0n) {
                addStep("Zero is already represented as 0/1.");
            } else if (divisor === 1n) {
                addStep("The numerator and denominator have no common divisor greater than 1.");
            } else {
                addStep(
                    `The greatest common divisor is ${divisor}.`
                );

                addStep(
                    `Divide both numbers by ${divisor}: ` +
                    `${originalNumerator} ÷ ${divisor} = ${result.numerator}, ` +
                    `${originalDenominator} ÷ ${divisor} = ${result.denominator}.`
                );
            }

            addStep(`Simplified answer: ${fractionToString(result)}.`);
            return;
        }

        addStep(
            `First fraction: ${fractionToString(a)}.`
        );

        addStep(
            `Second fraction: ${fractionToString(b)}.`
        );

        if (operation === "add" || operation === "subtract") {
            const commonNumerator =
                operation === "add"
                    ? a.numerator * b.denominator +
                      b.numerator * a.denominator
                    : a.numerator * b.denominator -
                      b.numerator * a.denominator;

            const commonDenominator =
                a.denominator * b.denominator;

            const operator = operation === "add" ? "+" : "−";

            addStep(
                `Use a common denominator: ` +
                `(${a.numerator} × ${b.denominator} ${operator} ` +
                `${b.numerator} × ${a.denominator}) / ` +
                `(${a.denominator} × ${b.denominator}).`
            );

            addStep(
                `Before simplification: ${commonNumerator}/${commonDenominator}.`
            );

        } else if (operation === "multiply") {
            addStep(
                `Multiply the numerators: ${a.numerator} × ${b.numerator} = ` +
                `${a.numerator * b.numerator}.`
            );

            addStep(
                `Multiply the denominators: ${a.denominator} × ${b.denominator} = ` +
                `${a.denominator * b.denominator}.`
            );

        } else if (operation === "divide") {
            addStep(
                `Invert the second fraction: ${b.denominator}/${b.numerator}.`
            );

            addStep(
                `Multiply: ${fractionToString(a)} × ` +
                `${b.denominator}/${b.numerator}.`
            );
        }

        addStep(
            `Simplified answer: ${fractionToString(result)}.`
        );
    }


    /* =========================================
       DISPLAY RESULT
    ========================================= */

    function displayResult(result, operation, a, b) {
        lastResult = result;

        resultNumerator.textContent =
            result.numerator.toString();

        resultDenominator.textContent =
            result.denominator.toString();

        mixedResult.textContent = toMixedNumber(result);
        decimalResult.textContent = toDecimal(result);

        buildSteps(operation, a, b, result);

        resultPanel.hidden = false;

        resultPanel.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }


    /* =========================================
       ERROR HANDLING
    ========================================= */

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;

        resultPanel.hidden = true;
    }


    function clearError() {
        errorMessage.textContent = "";
        errorMessage.hidden = true;
    }


    /* =========================================
       MAIN CALCULATION
    ========================================= */

    function calculateFraction(event) {
        event.preventDefault();

        clearError();
        copyFeedback.textContent = "";

        try {
            const operation = operationSelect.value;

            const a = readFraction(
                numerator1,
                denominator1,
                "First fraction"
            );

            let b = createFraction(0n, 1n);
            let result;

            if (operation !== "simplify") {
                b = readFraction(
                    numerator2,
                    denominator2,
                    "Second fraction"
                );
            }

            switch (operation) {
                case "simplify":
                    result = simplifyFraction(a);
                    break;

                case "add":
                    result = addFractions(a, b);
                    break;

                case "subtract":
                    result = subtractFractions(a, b);
                    break;

                case "multiply":
                    result = multiplyFractions(a, b);
                    break;

                case "divide":
                    result = divideFractions(a, b);
                    break;

                default:
                    throw new Error("Please select a valid operation.");
            }

            displayResult(result, operation, a, b);

        } catch (error) {
            showError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please check your inputs."
            );
        }
    }


    /* =========================================
       OPERATION UI
    ========================================= */

    function updateOperationUI() {
        const operation = operationSelect.value;
        const isSimplify = operation === "simplify";

        secondFractionGroup.hidden = isSimplify;
        numerator2.required = !isSimplify;
        denominator2.required = !isSimplify;

        firstFractionHeading.textContent =
            isSimplify ? "Fraction" : "First fraction";

        const operatorSymbols = {
            simplify: "=",
            add: "+",
            subtract: "−",
            multiply: "×",
            divide: "÷"
        };

        fractionOperator.textContent =
            operatorSymbols[operation] || "=";

        fractionOperator.classList.toggle(
            "is-hidden",
            isSimplify
        );

        exampleButton.textContent =
            isSimplify
                ? "Load 6/8"
                : "Load 3/4 + 1/2";

        clearError();
        resultPanel.hidden = true;
        copyFeedback.textContent = "";
    }


    /* =========================================
       EXAMPLE
    ========================================= */

    function loadExample() {
        operationSelect.value = "add";

        numerator1.value = "3";
        denominator1.value = "4";

        numerator2.value = "1";
        denominator2.value = "2";

        updateOperationUI();
        clearError();

        numerator1.focus();
    }


    function loadSimplifyExample() {
        operationSelect.value = "simplify";

        numerator1.value = "6";
        denominator1.value = "8";

        numerator2.value = "";
        denominator2.value = "";

        updateOperationUI();
        clearError();

        numerator1.focus();
    }


    /* =========================================
       RESET
    ========================================= */

    function resetCalculator() {
        form.reset();

        operationSelect.value = "simplify";

        numerator1.value = "";
        denominator1.value = "";
        numerator2.value = "";
        denominator2.value = "";

        resultPanel.hidden = true;
        lastResult = null;

        clearError();
        copyFeedback.textContent = "";

        updateOperationUI();
        numerator1.focus();
    }


    /* =========================================
       COPY RESULT
    ========================================= */

    async function copyResult() {
        if (!lastResult) {
            copyFeedback.textContent =
                "Calculate a fraction before copying the result.";
            return;
        }

        const text = fractionToString(lastResult);

        try {
            await navigator.clipboard.writeText(text);

            copyFeedback.textContent = "Fraction copied successfully.";

        } catch {
            // Fallback for browsers where Clipboard API is unavailable.
            const temporaryInput = document.createElement("textarea");

            temporaryInput.value = text;
            temporaryInput.style.position = "fixed";
            temporaryInput.style.opacity = "0";

            document.body.appendChild(temporaryInput);

            temporaryInput.select();

            let copied = false;

            try {
                copied = document.execCommand("copy");
            } catch {
                copied = false;
            }

            temporaryInput.remove();

            copyFeedback.textContent = copied
                ? "Fraction copied successfully."
                : `Copy unavailable. Your result is ${text}.`;
        }
    }


    /* =========================================
       NAVBAR
    ========================================= */

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("active");

            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        });
    }


    /* =========================================
       FOOTER YEAR
    ========================================= */

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    /* =========================================
       EVENT LISTENERS
    ========================================= */

    form.addEventListener("submit", calculateFraction);

    operationSelect.addEventListener("change", updateOperationUI);

    resetButton.addEventListener("click", resetCalculator);

    copyButton.addEventListener("click", copyResult);

    exampleButton.addEventListener("click", () => {
        if (operationSelect.value === "simplify") {
            loadSimplifyExample();
        } else {
            loadExample();
        }
    });

    [
        numerator1,
        denominator1,
        numerator2,
        denominator2
    ].forEach((input) => {
        input.addEventListener("input", () => {
            clearError();
            copyFeedback.textContent = "";
        });
    });


    /* =========================================
       INITIALIZE
    ========================================= */

    updateOperationUI();
});