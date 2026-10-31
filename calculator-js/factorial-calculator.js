/* =========================================
   DigiiFox Factorial Calculator
   File: factorial-calculator.js
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("factorialForm");
    const numberInput = document.getElementById("factorialNumber");

    const errorMessage = document.getElementById("factorialError");

    const resultPanel = document.getElementById("factorialResultPanel");
    const resultTitle = document.getElementById("factorialResultTitle");
    const resultSummary = document.getElementById("factorialResultSummary");

    const equationElement = document.getElementById("factorialEquation");
    const answerElement = document.getElementById("factorialAnswer");

    const inputResult = document.getElementById("factorialInputResult");
    const digitCount = document.getElementById("factorialDigitCount");

    const formulaElement = document.getElementById("factorialFormula");
    const stepsElement = document.getElementById("factorialSteps");
    const stepsNote = document.getElementById("factorialStepsNote");

    const resetButton = document.getElementById("factorialResetButton");
    const copyButton = document.getElementById("factorialCopyButton");

    const calculateAgainButton = document.getElementById(
        "factorialCalculateAgainButton"
    );

    const copyFeedback = document.getElementById("factorialCopyFeedback");

    const exampleButtons = document.querySelectorAll(
        ".factorial-example-button"
    );

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const currentYear = document.getElementById("currentYear");

    const MAX_FACTORIAL_INPUT = 1000;


    /* =========================================
       Footer year
    ========================================= */

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    /* =========================================
       Number formatting
    ========================================= */

    function formatInteger(value) {
        return value.toLocaleString("en-US");
    }


    /*
     * Format a BigInt with commas without converting
     * it to a JavaScript Number.
     *
     * This preserves exact digits for large factorials.
     */
    function formatBigInt(value) {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }


    /* =========================================
       Input validation
    ========================================= */

    function readFactorialInput() {
        const rawValue = numberInput.value.trim();

        if (rawValue === "") {
            throw new Error("Please enter a whole number.");
        }

        const number = Number(rawValue);

        if (!Number.isFinite(number) || !Number.isInteger(number)) {
            throw new Error(
                "Please enter a valid whole number without decimals."
            );
        }

        if (number < 0) {
            throw new Error(
                "Factorial is not available for negative integers in this calculator."
            );
        }

        if (number > MAX_FACTORIAL_INPUT) {
            throw new Error(
                `Please enter a number between 0 and ${MAX_FACTORIAL_INPUT}.`
            );
        }

        return number;
    }


    /* =========================================
       Calculate factorial using BigInt
    ========================================= */

    function calculateFactorial(number) {
        let result = 1n;

        for (let i = 2; i <= number; i++) {
            result *= BigInt(i);
        }

        return result;
    }


    /* =========================================
       Clear results
    ========================================= */

    function clearResults() {
        resultPanel.hidden = true;

        resultTitle.textContent = "";
        resultSummary.textContent = "";

        equationElement.textContent = "";
        answerElement.textContent = "";

        inputResult.textContent = "";
        digitCount.textContent = "";

        formulaElement.textContent = "";

        stepsElement.replaceChildren();
        stepsNote.textContent = "";

        copyFeedback.textContent = "";
    }


    function clearError() {
        errorMessage.textContent = "";
    }


    function showError(message) {
        errorMessage.textContent = message;
        resultPanel.hidden = true;
    }


    /* =========================================
       Calculation expression
    ========================================= */

    function createExpression(number) {
        if (number === 0 || number === 1) {
            return `${number}! = 1`;
        }

        if (number <= 15) {
            const factors = [];

            for (let i = number; i >= 1; i--) {
                factors.push(i);
            }

            return `${number}! = ${factors.join(" × ")}`;
        }

        return `${number}! = ${number} × ${number - 1} × ... × 3 × 2 × 1`;
    }


    /* =========================================
       Calculation steps
    ========================================= */

    function addStep(text) {
        const item = document.createElement("li");
        item.textContent = text;

        stepsElement.appendChild(item);
    }


    function createCalculationSteps(number, result) {
        stepsElement.replaceChildren();
        stepsNote.textContent = "";

        if (number === 0) {
            addStep("Start with the definition of zero factorial.");
            addStep("By definition, 0! = 1.");

            stepsNote.textContent =
                "Zero factorial is defined as 1 and is not calculated by multiplying an empty sequence down to a negative number.";

            return;
        }

        if (number === 1) {
            addStep("The factorial of 1 contains only the factor 1.");
            addStep("Therefore, 1! = 1.");

            return;
        }

        if (number <= 20) {
            let runningTotal = 1n;

            for (let i = 1; i <= number; i++) {
                runningTotal *= BigInt(i);

                addStep(
                    `${i}! = ${formatBigInt(runningTotal)}`
                );
            }

            stepsNote.textContent =
                "Each step multiplies the previous factorial by the next whole number.";

            return;
        }

        /*
         * For large factorials, display a concise,
         * readable explanation instead of hundreds
         * of unnecessary list items.
         */
        addStep(
            `Start with ${number}! = ${number} × ${number - 1} × ... × 2 × 1.`
        );

        addStep(
            `Calculate ${number}! using exact integer multiplication.`
        );

        addStep(
            `The previous factorial is ${number - 1}!.`
        );

        addStep(
            `${number}! = ${number} × (${number - 1}!).`
        );

        addStep(
            `The exact result contains ${result.toString().length} digits.`
        );

        addStep(
            `The final value is ${formatBigInt(result)}.`
        );

        stepsNote.textContent =
            `For readability, the individual multiplication steps are abbreviated for ${number}!. The result above is calculated exactly using BigInt arithmetic.`;
    }


    /* =========================================
       Main calculation
    ========================================= */

    function calculate() {
        clearError();
        clearResults();

        try {
            const number = readFactorialInput();
            const result = calculateFactorial(number);
            const resultText = formatBigInt(result);

            const totalDigits = result.toString().length;

            resultTitle.textContent = `${formatInteger(number)}!`;

            resultSummary.textContent =
                `The factorial of ${formatInteger(number)} is ${resultText}.`;

            equationElement.textContent = createExpression(number);

            answerElement.textContent = resultText;

            inputResult.textContent = formatInteger(number);

            digitCount.textContent = formatInteger(totalDigits);

            formulaElement.textContent =
                number === 0
                    ? "0! = 1"
                    : number === 1
                        ? "1! = 1"
                        : `${number}! = ${number} × (${number - 1})!`;

            createCalculationSteps(number, result);

            resultPanel.hidden = false;

            resultPanel.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });

        } catch (error) {
            showError(
                error.message ||
                "Unable to calculate the factorial. Please check your input."
            );
        }
    }


    /* =========================================
       Form submission
    ========================================= */

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        calculate();
    });


    /* =========================================
       Example buttons
    ========================================= */

    exampleButtons.forEach((button) => {
        button.addEventListener("click", () => {
            numberInput.value = button.dataset.number;

            clearError();
            calculate();
        });
    });


    /* =========================================
       Reset
    ========================================= */

    function resetCalculator() {
        numberInput.value = "5";

        clearError();
        clearResults();

        numberInput.focus();
    }


    resetButton.addEventListener("click", resetCalculator);


    /* =========================================
       Calculate again
    ========================================= */

    calculateAgainButton.addEventListener("click", () => {
        numberInput.focus();

        numberInput.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    });


    /* =========================================
       Copy results
    ========================================= */

    async function copyResults() {
        if (resultPanel.hidden) {
            return;
        }

        const lines = [
            "DigiiFox Factorial Calculator",
            `Input number: ${inputResult.textContent}`,
            `Factorial: ${equationElement.textContent}`,
            `Exact result: ${answerElement.textContent}`,
            `Number of digits: ${digitCount.textContent}`,
            `Formula: ${formulaElement.textContent}`,
            "",
            "Calculation steps:"
        ];

        Array.from(stepsElement.children).forEach((step, index) => {
            lines.push(`${index + 1}. ${step.textContent}`);
        });

        if (stepsNote.textContent) {
            lines.push("", stepsNote.textContent);
        }

        const textToCopy = lines.join("\n");

        try {
            await navigator.clipboard.writeText(textToCopy);

            copyFeedback.textContent = "Results copied successfully.";

        } catch {
            /*
             * Fallback for browsers where the Clipboard API
             * is unavailable or clipboard access is denied.
             */
            const textarea = document.createElement("textarea");

            textarea.value = textToCopy;
            textarea.setAttribute("readonly", "");

            textarea.style.position = "fixed";
            textarea.style.opacity = "0";

            document.body.appendChild(textarea);

            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);

            let copied = false;

            try {
                copied = document.execCommand("copy");
            } catch {
                copied = false;
            }

            textarea.remove();

            copyFeedback.textContent = copied
                ? "Results copied successfully."
                : "Copy was unavailable. Please select and copy the results manually.";
        }
    }


    copyButton.addEventListener("click", copyResults);


    /* =========================================
       Shared mobile navbar behavior
    ========================================= */

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const expanded =
                menuToggle.getAttribute("aria-expanded") === "true";

            menuToggle.setAttribute(
                "aria-expanded",
                String(!expanded)
            );

            mainNav.classList.toggle("active");
        });

        mainNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                mainNav.classList.remove("active");

                menuToggle.setAttribute("aria-expanded", "false");
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                mainNav.classList.remove("active");

                menuToggle.setAttribute("aria-expanded", "false");
            }
        });
    }


    /* =========================================
       Initial state
    ========================================= */

    clearError();
    clearResults();

});