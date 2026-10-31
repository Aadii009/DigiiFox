/* =========================================
   DIGIIFOX EXPONENT CALCULATOR
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("exponentForm");

    const baseInput = document.getElementById("expBase");
    const powerInput = document.getElementById("expPower");

    const expressionBase = document.getElementById("expExpressionBase");
    const expressionPower = document.getElementById("expExpressionPower");

    const errorBox = document.getElementById("expError");

    const resultPanel = document.getElementById("expResultPanel");
    const resultExpression = document.getElementById("expResultExpression");
    const resultNumber = document.getElementById("expResultNumber");
    const stepsList = document.getElementById("expSteps");

    const resetButton = document.getElementById("expResetButton");
    const copyButton = document.getElementById("expCopyButton");
    const copyFeedback = document.getElementById("expCopyFeedback");

    const exampleButtons = document.querySelectorAll(".exp-example-button");

    let calculatedResult = null;


    /* =========================================
       NUMBER FORMATTING
    ========================================= */

    function formatNumber(number) {
        if (!Number.isFinite(number)) {
            return String(number);
        }

        if (Object.is(number, -0)) {
            number = 0;
        }

        if (number === 0) {
            return "0";
        }

        const absoluteValue = Math.abs(number);

        // Keep extremely large and small values readable.
        if (absoluteValue >= 1e15 || absoluteValue < 1e-9) {
            return number
                .toExponential(8)
                .replace(/\.?0+e/, "e")
                .replace("e+", "e");
        }

        // Reduce floating-point display noise.
        return Number(number.toPrecision(12)).toString();
    }


    /* =========================================
       EXPRESSION DISPLAY
    ========================================= */

    function updateExpression() {
        expressionBase.textContent =
            baseInput.value.trim() || "x";

        expressionPower.textContent =
            powerInput.value.trim() || "y";
    }


    function clearError() {
        errorBox.textContent = "";
        errorBox.hidden = true;
    }


    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        resultPanel.hidden = true;
        calculatedResult = null;
    }


    function clearResult() {
        resultPanel.hidden = true;
        resultExpression.textContent = "";
        resultNumber.textContent = "";
        stepsList.replaceChildren();

        calculatedResult = null;
        copyFeedback.textContent = "";
    }


    /* =========================================
       INPUT VALIDATION
    ========================================= */

    function readInputs() {
        const baseText = baseInput.value.trim();
        const powerText = powerInput.value.trim();

        if (baseText === "" || powerText === "") {
            throw new Error("Please enter both the base and the exponent.");
        }

        const base = Number(baseText);
        const exponent = Number(powerText);

        if (!Number.isFinite(base) || !Number.isFinite(exponent)) {
            throw new Error("Please enter valid, finite numbers.");
        }

        // Prevent misleading calculations from extremely large inputs.
        if (
            Math.abs(base) > 1e100 ||
            Math.abs(exponent) > 1e6
        ) {
            throw new Error(
                "The input is too large for this calculator. Please use smaller values."
            );
        }

        if (base === 0 && exponent === 0) {
            throw new Error(
                "Zero raised to the power of zero (0⁰) is undefined."
            );
        }

        if (base === 0 && exponent < 0) {
            throw new Error(
                "Zero cannot be raised to a negative exponent because division by zero is undefined."
            );
        }

        if (base < 0 && !Number.isInteger(exponent)) {
            throw new Error(
                "A negative base with a non-integer exponent does not produce a real result in this calculator. Try a whole-number exponent."
            );
        }

        return { base, exponent };
    }


    /* =========================================
       CALCULATION STEPS
    ========================================= */

    function addStep(text) {
        const item = document.createElement("li");
        item.textContent = text;
        stepsList.appendChild(item);
    }


    function buildSteps(base, exponent, result) {
        stepsList.replaceChildren();

        const baseText = formatNumber(base);
        const exponentText = formatNumber(exponent);
        const resultText = formatNumber(result);

        addStep(
            `Identify the base: ${baseText}, and the exponent: ${exponentText}.`
        );

        if (exponent === 0) {
            addStep(
                "Any nonzero base raised to the power of zero equals 1."
            );

            addStep(`${baseText}⁰ = 1.`);
            return;
        }

        if (exponent === 1) {
            addStep(
                "A number raised to the power of one remains unchanged."
            );

            addStep(`${baseText}¹ = ${resultText}.`);
            return;
        }

        if (exponent < 0 && Number.isInteger(exponent)) {
            const positiveExponent = Math.abs(exponent);
            const positivePower = Math.pow(base, positiveExponent);

            addStep(
                "Use the negative exponent rule: x⁻ⁿ = 1 / xⁿ."
            );

            addStep(
                `${baseText}^(${exponentText}) = 1 / (${baseText}^${positiveExponent}).`
            );

            if (Number.isFinite(positivePower) && positivePower !== 0) {
                addStep(
                    `Evaluate the positive power: ${baseText}^${positiveExponent} = ${formatNumber(positivePower)}.`
                );

                addStep(
                    `Divide 1 by ${formatNumber(positivePower)} to obtain ${resultText}.`
                );
            } else {
                addStep(
                    `The calculator evaluates the reciprocal power numerically to obtain ${resultText}.`
                );
            }

            return;
        }

        if (exponent > 0 && Number.isInteger(exponent) && exponent <= 12) {
            const factors = Array.from(
                { length: exponent },
                () => `(${baseText})`
            ).join(" × ");

            addStep(
                `Expand the power: ${baseText}^${exponentText} = ${factors}.`
            );

            addStep(`Multiply the factors to obtain ${resultText}.`);
            return;
        }

        if (exponent === 0.5) {
            addStep(
                "An exponent of 0.5 is equivalent to taking the square root."
            );

            addStep(
                `√${baseText} = ${resultText}.`
            );

            return;
        }

        if (exponent === 1 / 3) {
            addStep(
                "An exponent of 1/3 is equivalent to taking the cube root."
            );

            addStep(
                `∛${baseText} = ${resultText}.`
            );

            return;
        }

        addStep(
            `Apply the power formula: ${baseText}^${exponentText}.`
        );

        addStep(
            `Evaluate the expression using the exponent rules to obtain ${resultText}.`
        );
    }


    /* =========================================
       CALCULATE POWER
    ========================================= */

    function calculatePower(event) {
        if (event) {
            event.preventDefault();
        }

        clearError();
        clearResult();

        let base;
        let exponent;

        try {
            const inputs = readInputs();

            base = inputs.base;
            exponent = inputs.exponent;
        } catch (error) {
            showError(error.message);
            return;
        }

        const result = Math.pow(base, exponent);

        if (Number.isNaN(result)) {
            showError(
                "This expression does not produce a real number. Please check your inputs."
            );
            return;
        }

        if (!Number.isFinite(result)) {
            showError(
                "The result is outside the calculator's supported numeric range. Try smaller inputs."
            );
            return;
        }

        const displayBase = formatNumber(base);
        const displayExponent = formatNumber(exponent);
        const displayResult = formatNumber(result);

        calculatedResult = displayResult;

        const needsBaseParentheses = base < 0;
        const baseExpression = needsBaseParentheses
            ? `(${displayBase})`
            : displayBase;

        resultExpression.textContent =
            `${baseExpression}^${displayExponent} = ${displayResult}`;

        resultNumber.textContent = displayResult;

        buildSteps(base, exponent, result);

        resultPanel.hidden = false;
        copyFeedback.textContent = "";

        resultPanel.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }


    /* =========================================
       EXAMPLE BUTTONS
    ========================================= */

    exampleButtons.forEach((button) => {
        button.addEventListener("click", () => {
            baseInput.value = button.dataset.base;
            powerInput.value = button.dataset.power;

            updateExpression();
            calculatePower();
        });
    });


    /* =========================================
       RESET
    ========================================= */

    function resetCalculator() {
        form.reset();

        baseInput.value = "";
        powerInput.value = "";

        clearError();
        clearResult();
        updateExpression();

        baseInput.focus();
    }


    /* =========================================
       COPY RESULT
    ========================================= */

    async function copyResult() {
        if (calculatedResult === null) {
            copyFeedback.textContent = "Calculate a result first.";
            return;
        }

        try {
            await navigator.clipboard.writeText(calculatedResult);

            copyFeedback.textContent = "Result copied!";
        } catch (error) {
            // Fallback for browsers where Clipboard API is unavailable.
            const temporaryInput = document.createElement("textarea");

            temporaryInput.value = calculatedResult;
            temporaryInput.setAttribute("readonly", "");
            temporaryInput.style.position = "fixed";
            temporaryInput.style.opacity = "0";

            document.body.appendChild(temporaryInput);

            temporaryInput.select();

            let copied = false;

            try {
                copied = document.execCommand("copy");
            } catch (copyError) {
                copied = false;
            }

            temporaryInput.remove();

            copyFeedback.textContent = copied
                ? "Result copied!"
                : "Copy unavailable. Please copy the result manually.";
        }
    }


    /* =========================================
       MOBILE NAVIGATION
       Uses the shared DigiiFox navbar structure.
    ========================================= */

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

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

                menuToggle.setAttribute("aria-expanded", "false");
            });
        });
    }


    /* =========================================
       FOOTER YEAR
    ========================================= */

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    /* =========================================
       EVENT LISTENERS
    ========================================= */

    form.addEventListener("submit", calculatePower);

    baseInput.addEventListener("input", () => {
        updateExpression();
        clearError();
    });

    powerInput.addEventListener("input", () => {
        updateExpression();
        clearError();
    });

    resetButton.addEventListener("click", resetCalculator);

    copyButton.addEventListener("click", copyResult);


    // Initialize the expression display.
    updateExpression();
});