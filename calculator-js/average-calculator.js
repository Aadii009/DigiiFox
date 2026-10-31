/* =========================================
   DIGIIFOX AVERAGE CALCULATOR
   File: average-calculator.js
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    "use strict";


    /* =====================================
       1. SELECT ELEMENTS
    ===================================== */

    const numberInputList = document.getElementById("numberInputList");

    const addNumberButton = document.getElementById("addNumberButton");

    const calculateButton = document.getElementById("calculateButton");

    const resetButton = document.getElementById("resetButton");

    const inputCount = document.getElementById("inputCount");

    const errorMessage = document.getElementById("errorMessage");

    const resultPanel = document.getElementById("resultPanel");

    const averageResult = document.getElementById("averageResult");

    const sumResult = document.getElementById("sumResult");

    const countResult = document.getElementById("countResult");

    const sumExplanation = document.getElementById("sumExplanation");

    const averageExplanation = document.getElementById(
        "averageExplanation"
    );

    const roundingNote = document.getElementById("roundingNote");

    const currentYearElement = document.getElementById("currentYear");

    const mobileMenuButton = document.getElementById("mobileMenuButton");

    const mainNavigation = document.getElementById("mainNavigation");


    /* =====================================
       2. CONFIGURATION
    ===================================== */

    const MIN_NUMBERS = 2;

    const MAX_NUMBERS = 50;

    let nextInputId = 4;


    /* =====================================
       3. NUMBER FORMATTING
    ===================================== */

    const numberFormatter = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 10,
        useGrouping: true
    });


    function formatNumber(value) {

        /*
         * Prevent non-finite numbers from being displayed
         * as ordinary calculation results.
         */

        if (!Number.isFinite(value)) {
            return "Invalid result";
        }

        /*
         * Avoid displaying negative zero.
         */

        if (Object.is(value, -0)) {
            value = 0;
        }

        return numberFormatter.format(value);

    }


    /* =====================================
       4. GET CURRENT NUMBER INPUTS
    ===================================== */

    function getNumberRows() {

        return Array.from(
            numberInputList.querySelectorAll(".number-row")
        );

    }


    function getNumberInputs() {

        return Array.from(
            numberInputList.querySelectorAll(".number-input")
        );

    }


    /* =====================================
       5. UPDATE INPUT LABELS AND CONTROLS
    ===================================== */

    function updateInputControls() {

        const rows = getNumberRows();

        const count = rows.length;

        rows.forEach(function (row, index) {

            const position = index + 1;

            const label = row.querySelector("label");

            const input = row.querySelector(".number-input");

            const removeButton = row.querySelector(
                ".remove-number-button"
            );

            /*
             * Keep the field labels and IDs synchronized
             * after adding or removing inputs.
             */

            const inputId = "number" + position;

            input.id = inputId;

            input.name = "number";

            label.htmlFor = inputId;

            label.textContent = "Number " + position;

            removeButton.setAttribute(
                "aria-label",
                "Remove number " + position
            );

            /*
             * At least two rows must remain.
             */

            removeButton.disabled = count <= MIN_NUMBERS;

        });


        /*
         * Update the number of values displayed.
         */

        inputCount.textContent =
            count + (count === 1 ? " value" : " values");


        /*
         * Disable adding when the maximum is reached.
         */

        addNumberButton.disabled = count >= MAX_NUMBERS;

        addNumberButton.setAttribute(
            "aria-label",
            count >= MAX_NUMBERS
                ? "Maximum of 50 numbers reached"
                : "Add another number"
        );

    }


    /* =====================================
       6. HIDE OLD RESULTS
    ===================================== */

    function clearResults() {

        resultPanel.hidden = true;

        averageResult.textContent = "0";

        sumResult.textContent = "0";

        countResult.textContent = "0";

        sumExplanation.textContent = "";

        averageExplanation.textContent = "";

        roundingNote.textContent =
            "The displayed average is rounded when necessary.";

    }


    /* =====================================
       7. SHOW AND CLEAR ERRORS
    ===================================== */

    function showError(message, inputToFocus = null) {

        errorMessage.textContent = message;

        errorMessage.hidden = false;

        clearResults();

        if (inputToFocus) {

            inputToFocus.focus();

        }

    }


    function clearError() {

        errorMessage.textContent = "";

        errorMessage.hidden = true;

    }


    /* =====================================
       8. ADD A NUMBER INPUT
    ===================================== */

    function addNumberInput() {

        const rows = getNumberRows();

        if (rows.length >= MAX_NUMBERS) {

            showError(
                "You can enter a maximum of 50 numbers."
            );

            return;

        }

        const newId = "number" + nextInputId;

        nextInputId++;


        /*
         * Create elements safely with DOM methods.
         * No user-entered text is inserted as HTML.
         */

        const row = document.createElement("div");

        row.className = "number-row";


        const label = document.createElement("label");

        label.htmlFor = newId;

        label.textContent = "Number " + (rows.length + 1);


        const input = document.createElement("input");

        input.type = "number";

        input.id = newId;

        input.className = "number-input";

        input.name = "number";

        input.step = "any";

        input.inputMode = "decimal";

        input.placeholder = "Enter a number";

        input.autocomplete = "off";

        input.required = true;


        const removeButton = document.createElement("button");

        removeButton.type = "button";

        removeButton.className = "remove-number-button";

        removeButton.setAttribute(
            "aria-label",
            "Remove number " + (rows.length + 1)
        );

        removeButton.textContent = "\u00D7";


        row.appendChild(label);

        row.appendChild(input);

        row.appendChild(removeButton);

        numberInputList.appendChild(row);


        updateInputControls();

        clearError();

        clearResults();

        input.focus();

    }


    addNumberButton.addEventListener("click", function () {

        addNumberInput();

    });


    /* =====================================
       9. REMOVE A NUMBER INPUT
    ===================================== */

    numberInputList.addEventListener("click", function (event) {

        const removeButton = event.target.closest(
            ".remove-number-button"
        );

        if (!removeButton) {
            return;
        }

        const rows = getNumberRows();

        if (rows.length <= MIN_NUMBERS) {

            showError(
                "At least two number fields are required."
            );

            return;

        }

        const row = removeButton.closest(".number-row");

        if (!row) {
            return;
        }

        /*
         * Select the next useful field before removing the row.
         */

        const remainingRows = rows.filter(function (item) {
            return item !== row;
        });

        const nextRow =
            remainingRows[rows.indexOf(row)] ||
            remainingRows[remainingRows.length - 1];

        row.remove();

        updateInputControls();

        clearError();

        clearResults();

        const nextInput = nextRow
            ? nextRow.querySelector(".number-input")
            : null;

        if (nextInput) {
            nextInput.focus();
        }

    });


    /* =====================================
       10. VALIDATE ALL NUMBER INPUTS
    ===================================== */

    function validateInputs() {

        const inputs = getNumberInputs();

        if (inputs.length < MIN_NUMBERS) {

            return {
                valid: false,
                message: "Enter at least two numbers.",
                input: null
            };

        }


        if (inputs.length > MAX_NUMBERS) {

            return {
                valid: false,
                message: "A maximum of 50 numbers is allowed.",
                input: null
            };

        }


        const values = [];


        for (let index = 0; index < inputs.length; index++) {

            const input = inputs[index];

            input.removeAttribute("aria-invalid");


            /*
             * An empty field is not treated as zero.
             */

            if (input.value.trim() === "") {

                input.setAttribute("aria-invalid", "true");

                return {
                    valid: false,
                    message:
                        "Please enter a number in every field, " +
                        "or remove fields you do not need.",
                    input: input
                };

            }


            /*
             * valueAsNumber rejects malformed and non-finite values.
             * Zero and negative numbers remain valid.
             */

            const value = input.valueAsNumber;

            if (!Number.isFinite(value)) {

                input.setAttribute("aria-invalid", "true");

                return {
                    valid: false,
                    message:
                        "One of your inputs is invalid. " +
                        "Please enter a valid number.",
                    input: input
                };

            }

            values.push(value);

        }


        return {
            valid: true,
            values: values
        };

    }


    /* =====================================
       11. CALCULATE SUM SAFELY
    ===================================== */

    function calculateSum(values) {

        let sum = 0;

        for (const value of values) {

            sum += value;

            /*
             * Very large finite inputs can overflow
             * when added together.
             */

            if (!Number.isFinite(sum)) {

                return {
                    valid: false,
                    message:
                        "The total is too large to calculate safely. " +
                        "Please use smaller values."
                };

            }

        }

        return {
            valid: true,
            sum: sum
        };

    }


    /* =====================================
       12. DISPLAY RESULTS
    ===================================== */

    function displayResults(values, sum, average) {

        averageResult.textContent = formatNumber(average);

        sumResult.textContent = formatNumber(sum);

        countResult.textContent = String(values.length);


        /*
         * Display the sum as a readable calculation.
         * Limit the expanded expression to avoid an
         * excessively long line with 50 values.
         */

        const previewLimit = 8;

        let sumExpression;

        if (values.length <= previewLimit) {

            sumExpression = values
                .map(formatNumber)
                .join(" + ");

        } else {

            const firstValues = values
                .slice(0, previewLimit)
                .map(formatNumber)
                .join(" + ");

            sumExpression =
                firstValues +
                " + ... (" +
                (values.length - previewLimit) +
                " more values)";

        }


        sumExplanation.textContent =
            "Sum: " + sumExpression + " = " + formatNumber(sum);


        averageExplanation.textContent =
            "Average = " +
            formatNumber(sum) +
            " \u00F7 " +
            values.length +
            " = " +
            formatNumber(average);


        roundingNote.textContent =
            "The average is calculated from the entered values. " +
            "Displayed numbers use up to 10 decimal places; " +
            "the display may therefore be rounded.";


        resultPanel.hidden = false;

    }


    /* =====================================
       13. MAIN CALCULATION
    ===================================== */

    function calculateAverage() {

        clearError();

        const validation = validateInputs();


        /*
         * Stop if an input is missing or invalid.
         */

        if (!validation.valid) {

            showError(
                validation.message,
                validation.input
            );

            return;

        }


        const values = validation.values;


        /*
         * Add all values.
         */

        const sumResultObject = calculateSum(values);


        if (!sumResultObject.valid) {

            showError(sumResultObject.message);

            return;

        }


        const sum = sumResultObject.sum;


        /*
         * Calculate the arithmetic mean.
         *
         * Average = Sum / Number of values
         */

        const average = sum / values.length;


        if (!Number.isFinite(average)) {

            showError(
                "The average could not be represented safely. " +
                "Please check your input values."
            );

            return;

        }


        /*
         * Display the verified calculation.
         */

        displayResults(values, sum, average);

    }


    calculateButton.addEventListener("click", function () {

        calculateAverage();

    });


    /* =====================================
       14. CLEAR RESULTS WHEN INPUTS CHANGE
    ===================================== */

    numberInputList.addEventListener("input", function (event) {

        if (!event.target.matches(".number-input")) {
            return;
        }

        event.target.removeAttribute("aria-invalid");

        clearError();

        clearResults();

    });


    /* =====================================
       15. RESET THE CALCULATOR
    ===================================== */

    function resetCalculator() {

        /*
         * Restore the original three empty inputs.
         */

        numberInputList.replaceChildren();

        nextInputId = 1;


        for (let index = 1; index <= 3; index++) {

            const row = document.createElement("div");

            row.className = "number-row";


            const label = document.createElement("label");

            label.htmlFor = "number" + index;

            label.textContent = "Number " + index;


            const input = document.createElement("input");

            input.type = "number";

            input.id = "number" + index;

            input.className = "number-input";

            input.name = "number";

            input.step = "any";

            input.inputMode = "decimal";

            input.placeholder = "Enter a number";

            input.autocomplete = "off";

            input.required = true;


            const removeButton = document.createElement("button");

            removeButton.type = "button";

            removeButton.className = "remove-number-button";

            removeButton.setAttribute(
                "aria-label",
                "Remove number " + index
            );

            removeButton.textContent = "\u00D7";


            row.appendChild(label);

            row.appendChild(input);

            row.appendChild(removeButton);

            numberInputList.appendChild(row);

        }


        nextInputId = 4;

        updateInputControls();

        clearError();

        clearResults();

        const firstInput = numberInputList.querySelector(".number-input");

        if (firstInput) {
            firstInput.focus();
        }

    }


    resetButton.addEventListener("click", function () {

        resetCalculator();

    });


    /* =====================================
       16. MOBILE NAVIGATION
    ===================================== */

    function closeMobileMenu() {

        if (!mobileMenuButton || !mainNavigation) {
            return;
        }

        mainNavigation.classList.remove("is-open");

        mobileMenuButton.setAttribute(
            "aria-expanded",
            "false"
        );

        mobileMenuButton.setAttribute(
            "aria-label",
            "Open navigation menu"
        );

    }


    if (mobileMenuButton && mainNavigation) {

        mobileMenuButton.addEventListener("click", function () {

            const isExpanded =
                mobileMenuButton.getAttribute("aria-expanded") === "true";

            if (isExpanded) {

                closeMobileMenu();

            } else {

                mainNavigation.classList.add("is-open");

                mobileMenuButton.setAttribute(
                    "aria-expanded",
                    "true"
                );

                mobileMenuButton.setAttribute(
                    "aria-label",
                    "Close navigation menu"
                );

            }

        });


        mainNavigation.querySelectorAll("a").forEach(function (link) {

            link.addEventListener("click", function () {

                closeMobileMenu();

            });

        });


        document.addEventListener("keydown", function (event) {

            if (event.key === "Escape") {

                closeMobileMenu();

            }

        });


        document.addEventListener("click", function (event) {

            const clickedInsideNavigation =
                mainNavigation.contains(event.target);

            const clickedMenuButton =
                mobileMenuButton.contains(event.target);

            if (!clickedInsideNavigation && !clickedMenuButton) {

                closeMobileMenu();

            }

        });


        window.addEventListener("resize", function () {

            if (window.innerWidth > 760) {

                closeMobileMenu();

            }

        });

    }


    /* =====================================
       17. DYNAMIC COPYRIGHT YEAR
    ===================================== */

    if (currentYearElement) {

        currentYearElement.textContent =
            new Date().getFullYear();

    }


    /* =====================================
       18. INITIALIZE
    ===================================== */

    updateInputControls();

    clearError();

    clearResults();

});