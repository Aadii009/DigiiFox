/* =========================================
   DigiiFox LCM & HCF Calculator
   File: lcm-hcf-calculator.js
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("lcmForm");
    const numbersInput = document.getElementById("lcmNumbers");

    const errorMessage = document.getElementById("lcmError");
    const resultPanel = document.getElementById("lcmResultPanel");
    const resultSummary = document.getElementById("lcmResultSummary");

    const lcmResultNumber = document.getElementById("lcmResultNumber");
    const hcfResultNumber = document.getElementById("hcfResultNumber");

    const formulaNote = document.getElementById("lcmFormulaNote");
    const stepsList = document.getElementById("lcmSteps");

    const resetButton = document.getElementById("lcmResetButton");
    const copyButton = document.getElementById("lcmCopyButton");
    const calculateAgainButton = document.getElementById(
        "lcmCalculateAgainButton"
    );

    const copyFeedback = document.getElementById("lcmCopyFeedback");

    const exampleButtons = document.querySelectorAll(
        ".lcm-example-button"
    );

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const currentYear = document.getElementById("currentYear");


    /* =========================================
       Footer year
    ========================================= */

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    /* =========================================
       Number utilities
    ========================================= */

    /**
     * Return the absolute value of a BigInt.
     */
    function absoluteValue(number) {
        return number < 0n ? -number : number;
    }


    /**
     * Calculate the HCF/GCD of two positive integers
     * using the Euclidean algorithm.
     *
     * Also records the intermediate division steps.
     */
    function calculateGCD(first, second, steps = null, label = "") {
        let a = absoluteValue(first);
        let b = absoluteValue(second);

        if (a === 0n && b === 0n) {
            throw new Error("HCF of zero and zero is undefined.");
        }

        if (a === 0n) {
            return b;
        }

        if (b === 0n) {
            return a;
        }

        if (steps) {
            steps.push(
                `${label}Find the HCF of ${a} and ${b} using the Euclidean algorithm.`
            );
        }

        while (b !== 0n) {
            const remainder = a % b;

            if (steps) {
                steps.push(
                    `${a} = ${b} × ${a / b} + ${remainder}`
                );
            }

            a = b;
            b = remainder;
        }

        if (steps) {
            steps.push(`${label}HCF = ${a}.`);
        }

        return a;
    }


    /**
     * Calculate the LCM of two positive integers.
     *
     * Formula:
     * LCM(a, b) = (a / HCF(a, b)) × b
     *
     * Dividing before multiplying helps keep intermediate
     * values smaller.
     */
    function calculateLCM(first, second, steps = null, label = "") {
        const a = absoluteValue(first);
        const b = absoluteValue(second);

        if (a === 0n || b === 0n) {
            return 0n;
        }

        const gcd = calculateGCD(a, b);

        const result = (a / gcd) * b;

        if (steps) {
            steps.push(
                `${label}LCM(${a}, ${b}) = (${a} ÷ ${gcd}) × ${b} = ${result}.`
            );
        }

        return result;
    }


    /**
     * Calculate the HCF for any number of inputs.
     */
    function calculateMultipleGCD(numbers, steps = null) {
        let result = numbers[0];

        if (steps) {
            steps.push(
                `Start with the first number: ${result}.`
            );
        }

        for (let index = 1; index < numbers.length; index++) {
            const nextNumber = numbers[index];

            if (steps) {
                steps.push(
                    `Find the HCF of the current result ${result} and ${nextNumber}.`
                );
            }

            result = calculateGCD(result, nextNumber, steps);
        }

        return result;
    }


    /**
     * Calculate the LCM for any number of inputs.
     */
    function calculateMultipleLCM(numbers, steps = null) {
        let result = numbers[0];

        if (steps) {
            steps.push(
                `Start with the first number: ${result}.`
            );
        }

        for (let index = 1; index < numbers.length; index++) {
            const nextNumber = numbers[index];

            if (steps) {
                steps.push(
                    `Find the LCM of the current result ${result} and ${nextNumber}.`
                );
            }

            result = calculateLCM(result, nextNumber, steps);
        }

        return result;
    }


    /* =========================================
       Input validation
    ========================================= */

    function parseNumbers(value) {
        const trimmedValue = value.trim();

        if (!trimmedValue) {
            throw new Error("Please enter at least two positive whole numbers.");
        }

        /*
         * Accept comma-separated or whitespace-separated values.
         * Examples:
         * 12, 18, 24
         * 12 18 24
         * 12,18,24
         */
        const tokens = trimmedValue.split(/[\s,]+/);

        if (tokens.length < 2) {
            throw new Error(
                "Please enter at least two numbers to calculate LCM and HCF."
            );
        }

        if (tokens.length > 20) {
            throw new Error(
                "Please enter no more than 20 numbers at a time."
            );
        }

        const numbers = tokens.map((token) => {
            if (!/^\d+$/.test(token)) {
                throw new Error(
                    "Please enter positive whole numbers only. Separate numbers with commas or spaces."
                );
            }

            let number;

            try {
                number = BigInt(token);
            } catch {
                throw new Error(
                    "One of the entered values is not a valid whole number."
                );
            }

            if (number <= 0n) {
                throw new Error(
                    "Every number must be greater than zero."
                );
            }

            return number;
        });

        return numbers;
    }


    /* =========================================
       Display utilities
    ========================================= */

    function showError(message) {
        errorMessage.textContent = message;
        resultPanel.hidden = true;
    }


    function clearError() {
        errorMessage.textContent = "";
    }


    function clearResults() {
        resultPanel.hidden = true;

        resultSummary.textContent = "";
        lcmResultNumber.textContent = "";
        hcfResultNumber.textContent = "";
        formulaNote.textContent = "";

        stepsList.replaceChildren();

        copyFeedback.textContent = "";
    }


    function addStep(text) {
        const listItem = document.createElement("li");

        listItem.textContent = text;

        stepsList.appendChild(listItem);
    }


    function formatNumber(number) {
        return number.toLocaleString("en-US");
    }


    function renderSteps(steps) {
        stepsList.replaceChildren();

        steps.forEach(addStep);
    }


    /* =========================================
       Main calculation
    ========================================= */

    function calculate() {
        clearError();
        clearResults();

        let numbers;

        try {
            numbers = parseNumbers(numbersInput.value);
        } catch (error) {
            showError(error.message);
            numbersInput.focus();
            return;
        }

        const hcfSteps = [];
        const lcmSteps = [];

        let hcf;
        let lcm;

        try {
            hcf = calculateMultipleGCD(numbers, hcfSteps);
            lcm = calculateMultipleLCM(numbers, lcmSteps);
        } catch (error) {
            showError(
                error.message || "Unable to calculate the entered numbers."
            );
            return;
        }

        /*
         * Display results.
         */
        lcmResultNumber.textContent = formatNumber(lcm);
        hcfResultNumber.textContent = formatNumber(hcf);

        resultSummary.textContent =
            `For the numbers ${numbers.map(formatNumber).join(", ")}, ` +
            `the LCM is ${formatNumber(lcm)} and the HCF is ${formatNumber(hcf)}.`;

        /*
         * The familiar product relationship:
         *
         * LCM(a, b) × HCF(a, b) = a × b
         *
         * applies directly to two positive integers.
         * For more than two inputs, explain the pairwise approach.
         */
        if (numbers.length === 2) {
            const first = numbers[0];
            const second = numbers[1];

            formulaNote.textContent =
                `${formatNumber(lcm)} × ${formatNumber(hcf)} = ` +
                `${formatNumber(first)} × ${formatNumber(second)} = ` +
                `${formatNumber(first * second)}.`;
        } else {
            formulaNote.textContent =
                "For multiple numbers, the calculator applies the LCM and HCF operations successively to each number.";
        }

        /*
         * Build a complete solution.
         */
        const allSteps = [];

        allSteps.push(
            `Input numbers: ${numbers.map(formatNumber).join(", ")}.`
        );

        allSteps.push("HCF calculation:");

        allSteps.push(...hcfSteps);

        allSteps.push(
            `Final HCF of all entered numbers = ${formatNumber(hcf)}.`
        );

        allSteps.push("LCM calculation:");

        allSteps.push(...lcmSteps);

        allSteps.push(
            `Final LCM of all entered numbers = ${formatNumber(lcm)}.`
        );

        renderSteps(allSteps);

        resultPanel.hidden = false;

        copyFeedback.textContent = "";

        /*
         * Bring the results into view without changing
         * the page's layout or shared navigation.
         */
        resultPanel.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
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
            numbersInput.value = button.dataset.numbers || "";

            clearError();
            clearResults();

            calculate();
        });
    });


    /* =========================================
       Reset
    ========================================= */

    function resetCalculator() {
        numbersInput.value = "12, 18";

        clearError();
        clearResults();

        numbersInput.focus();
    }


    resetButton.addEventListener("click", resetCalculator);


    /* =========================================
       Calculate again
    ========================================= */

    calculateAgainButton.addEventListener("click", () => {
        numbersInput.focus();

        numbersInput.scrollIntoView({
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

        const inputNumbers = numbersInput.value.trim();

        const resultText = [
            "DigiiFox LCM & HCF Calculator",
            `Numbers: ${inputNumbers}`,
            `LCM: ${lcmResultNumber.textContent}`,
            `HCF: ${hcfResultNumber.textContent}`,
            "",
            "Calculation steps:",
            ...Array.from(stepsList.children).map(
                (item, index) => `${index + 1}. ${item.textContent}`
            )
        ].join("\n");

        try {
            await navigator.clipboard.writeText(resultText);

            copyFeedback.textContent = "Results copied successfully.";
        } catch {
            /*
             * Fallback for browsers where the Clipboard API
             * is unavailable or permission is denied.
             */
            const temporaryTextarea = document.createElement("textarea");

            temporaryTextarea.value = resultText;
            temporaryTextarea.setAttribute("readonly", "");
            temporaryTextarea.style.position = "fixed";
            temporaryTextarea.style.opacity = "0";

            document.body.appendChild(temporaryTextarea);

            temporaryTextarea.select();
            temporaryTextarea.setSelectionRange(
                0,
                temporaryTextarea.value.length
            );

            let copied = false;

            try {
                copied = document.execCommand("copy");
            } catch {
                copied = false;
            }

            temporaryTextarea.remove();

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
            const isExpanded =
                menuToggle.getAttribute("aria-expanded") === "true";

            menuToggle.setAttribute(
                "aria-expanded",
                String(!isExpanded)
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