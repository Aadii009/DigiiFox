/* =========================================
   DIGIIFOX INFLATION CALCULATOR
   File: inflation-calculator.js
========================================= */

"use strict";

document.addEventListener("DOMContentLoaded", function () {

    // =====================================
    // ELEMENTS
    // =====================================

    const form = document.getElementById("inflationForm");

    const currentAmountInput = document.getElementById("currentAmount");
    const inflationRateInput = document.getElementById("inflationRate");
    const timePeriodInput = document.getElementById("timePeriod");
    const currencyInput = document.getElementById("currency");

    const errorBox = document.getElementById("inflationError");
    const resultsSection = document.getElementById("inflationResults");

    const resetButton = document.getElementById("resetInflation");
    const copyButton = document.getElementById("copyInflationResults");

    const futureCostOutput = document.getElementById("futureCost");
    const totalIncreaseOutput = document.getElementById("totalIncrease");
    const cumulativeInflationOutput =
        document.getElementById("cumulativeInflation");

    const futurePurchasingPowerOutput =
        document.getElementById("futurePurchasingPower");

    const currentAmountLabel =
        document.getElementById("currentAmountLabel");

    const futureCostLabel =
        document.getElementById("futureCostLabel");

    const currentAmountBar =
        document.getElementById("currentAmountBar");

    const futureCostBar =
        document.getElementById("futureCostBar");

    const insightOutput =
        document.getElementById("inflationInsight");

    const stepsContainer =
        document.getElementById("inflationSteps");

    const tableBody =
        document.getElementById("inflationTableBody");


    // =====================================
    // DEFAULT VALUES
    // =====================================

    const defaultValues = {
        currentAmount: "10000",
        inflationRate: "6",
        timePeriod: "10",
        currency: "INR"
    };


    // =====================================
    // CURRENCY FORMATTING
    // =====================================

    function getCurrencyFormatter() {

        const currency = currencyInput.value;

        try {
            return new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        } catch (error) {

            return new Intl.NumberFormat("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    }


    function formatMoney(value) {

        return getCurrencyFormatter().format(value);
    }


    function formatNumber(value, maximumFractionDigits = 2) {

        return new Intl.NumberFormat("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: maximumFractionDigits
        }).format(value);
    }


    function formatPercentage(value) {

        return formatNumber(value, 2) + "%";
    }


    // =====================================
    // ERROR HANDLING
    // =====================================

    function showError(message) {

        errorBox.textContent = message;
        errorBox.classList.add("is-visible");

        resultsSection.hidden = true;
    }


    function clearError() {

        errorBox.textContent = "";
        errorBox.classList.remove("is-visible");
    }


    // =====================================
    // INPUT VALIDATION
    // =====================================

    function getValidatedInputs() {

        const currentAmount = Number(currentAmountInput.value);
        const inflationRate = Number(inflationRateInput.value);
        const years = Number(timePeriodInput.value);

        if (
            currentAmountInput.value.trim() === "" ||
            !Number.isFinite(currentAmount) ||
            currentAmount <= 0 ||
            currentAmount > 100000000000
        ) {
            throw new Error(
                "Please enter a current amount greater than zero and no more than 100,000,000,000."
            );
        }

        if (
            inflationRateInput.value.trim() === "" ||
            !Number.isFinite(inflationRate) ||
            inflationRate < 0 ||
            inflationRate > 100
        ) {
            throw new Error(
                "Please enter an annual inflation rate between 0% and 100%."
            );
        }

        if (
            timePeriodInput.value.trim() === "" ||
            !Number.isFinite(years) ||
            !Number.isInteger(years) ||
            years < 0 ||
            years > 100
        ) {
            throw new Error(
                "Please enter a whole number of years between 0 and 100."
            );
        }

        return {
            currentAmount,
            inflationRate,
            years
        };
    }


    // =====================================
    // INFLATION CALCULATION
    // =====================================

    function calculateInflation() {

        clearError();

        try {

            const inputs = getValidatedInputs();

            const currentAmount = inputs.currentAmount;
            const annualRate = inputs.inflationRate / 100;
            const years = inputs.years;

            /*
             * Formula:
             *
             * Future Cost = Current Amount × (1 + Rate)^Years
             *
             * Future Purchasing Power =
             * Current Amount / (1 + Rate)^Years
             */

            const inflationFactor = Math.pow(1 + annualRate, years);

            const futureCost = currentAmount * inflationFactor;

            const totalIncrease = futureCost - currentAmount;

            const cumulativeInflation =
                (inflationFactor - 1) * 100;

            const futurePurchasingPower =
                currentAmount / inflationFactor;


            // Check calculation results.

            const results = [
                futureCost,
                totalIncrease,
                cumulativeInflation,
                futurePurchasingPower
            ];

            if (!results.every(Number.isFinite)) {

                throw new Error(
                    "These values produced a result that is too large to calculate. Please use smaller inputs."
                );
            }


            // Render results.

            renderResults({
                currentAmount,
                inflationRate: inputs.inflationRate,
                years,
                annualRate,
                inflationFactor,
                futureCost,
                totalIncrease,
                cumulativeInflation,
                futurePurchasingPower
            });

            resultsSection.hidden = false;

        } catch (error) {

            showError(
                error.message ||
                "Unable to calculate inflation. Please check your inputs."
            );
        }
    }


    // =====================================
    // RENDER RESULTS
    // =====================================

    function renderResults(data) {

        const {
            currentAmount,
            inflationRate,
            years,
            annualRate,
            inflationFactor,
            futureCost,
            totalIncrease,
            cumulativeInflation,
            futurePurchasingPower
        } = data;


        // Result cards.

        futureCostOutput.textContent = formatMoney(futureCost);

        totalIncreaseOutput.textContent =
            formatMoney(totalIncrease);

        cumulativeInflationOutput.textContent =
            formatPercentage(cumulativeInflation);

        futurePurchasingPowerOutput.textContent =
            formatMoney(futurePurchasingPower);


        // Comparison labels.

        currentAmountLabel.textContent =
            formatMoney(currentAmount);

        futureCostLabel.textContent =
            formatMoney(futureCost);


        /*
         * Use the future cost as the maximum bar width.
         * When inflation is zero, both bars will be 100%.
         */

        const currentBarWidth =
            (currentAmount / futureCost) * 100;

        currentAmountBar.style.width =
            Math.min(100, currentBarWidth) + "%";

        futureCostBar.style.width = "100%";


        // Insight.

        if (years === 0) {

            insightOutput.textContent =
                "With a time period of zero years, no time has passed. " +
                "The estimated future cost remains equal to the current amount.";

        } else if (inflationRate === 0) {

            insightOutput.textContent =
                "With an assumed inflation rate of 0%, the estimated price " +
                "does not increase during the selected period. " +
                "This is a mathematical scenario, not a forecast.";

        } else {

            insightOutput.textContent =
                "At an assumed annual inflation rate of " +
                formatPercentage(inflationRate) +
                ", the price increases by " +
                formatMoney(totalIncrease) +
                " over " +
                years +
                (years === 1 ? " year. " : " years. ") +
                "The estimated future cost is " +
                formatMoney(futureCost) +
                ". Actual inflation may differ.";
        }


        // Formula steps.

        renderCalculationSteps(data);


        // Year-by-year table.

        renderYearlyTable(data);
    }


    // =====================================
    // CALCULATION STEPS
    // =====================================

    function renderCalculationSteps(data) {

        const {
            currentAmount,
            inflationRate,
            years,
            annualRate,
            inflationFactor,
            futureCost,
            totalIncrease,
            cumulativeInflation,
            futurePurchasingPower
        } = data;


        const steps = [

            {
                title: "Step 1: Identify your inputs",

                description:
                    "Current amount = " +
                    formatMoney(currentAmount) +
                    "; annual inflation rate = " +
                    formatPercentage(inflationRate) +
                    "; period = " +
                    years +
                    (years === 1 ? " year." : " years.")
            },

            {
                title: "Step 2: Convert the inflation rate",

                description:
                    inflationRate +
                    " ÷ 100 = " +
                    formatNumber(annualRate, 6) +
                    " as a decimal rate."
            },

            {
                title: "Step 3: Calculate the inflation factor",

                description:
                    "(1 + " +
                    formatNumber(annualRate, 6) +
                    ") ^ " +
                    years +
                    " = " +
                    formatNumber(inflationFactor, 8) +
                    "."
            },

            {
                title: "Step 4: Calculate the future cost",

                description:
                    formatMoney(currentAmount) +
                    " × " +
                    formatNumber(inflationFactor, 8) +
                    " = " +
                    formatMoney(futureCost) +
                    "."
            },

            {
                title: "Step 5: Calculate the total price increase",

                description:
                    formatMoney(futureCost) +
                    " − " +
                    formatMoney(currentAmount) +
                    " = " +
                    formatMoney(totalIncrease) +
                    ", equivalent to a cumulative increase of " +
                    formatPercentage(cumulativeInflation) +
                    "."
            },

            {
                title: "Step 6: Estimate future purchasing power",

                description:
                    formatMoney(currentAmount) +
                    " ÷ " +
                    formatNumber(inflationFactor, 8) +
                    " = " +
                    formatMoney(futurePurchasingPower) +
                    " in today's purchasing-power terms."
            }

        ];


        stepsContainer.replaceChildren();

        steps.forEach(function (step, index) {

            const stepElement = document.createElement("div");
            stepElement.className = "inf-step";

            const number = document.createElement("span");
            number.className = "inf-step-number";
            number.textContent = String(index + 1);

            const content = document.createElement("div");

            const title = document.createElement("h4");
            title.textContent = step.title;

            const description = document.createElement("p");
            description.textContent = step.description;

            content.appendChild(title);
            content.appendChild(description);

            stepElement.appendChild(number);
            stepElement.appendChild(content);

            stepsContainer.appendChild(stepElement);
        });
    }


    // =====================================
    // YEAR-BY-YEAR TABLE
    // =====================================

    function renderYearlyTable(data) {

        const {
            currentAmount,
            inflationRate,
            years
        } = data;

        tableBody.replaceChildren();


        /*
         * Display year 0 as today's price.
         * Display every subsequent year up to the selected period.
         */

        const fragment = document.createDocumentFragment();

        for (let year = 0; year <= years; year++) {

            const estimatedCost =
                currentAmount *
                Math.pow(1 + inflationRate / 100, year);

            const increase = estimatedCost - currentAmount;

            const row = document.createElement("tr");

            const yearCell = document.createElement("td");
            yearCell.textContent =
                year === 0 ? "Today (Year 0)" : "Year " + year;

            const costCell = document.createElement("td");
            costCell.textContent = formatMoney(estimatedCost);

            const increaseCell = document.createElement("td");
            increaseCell.textContent = formatMoney(increase);

            row.appendChild(yearCell);
            row.appendChild(costCell);
            row.appendChild(increaseCell);

            fragment.appendChild(row);
        }

        tableBody.appendChild(fragment);
    }


    // =====================================
    // COPY RESULTS
    // =====================================

    async function copyResults() {

        if (resultsSection.hidden) {
            showError("Calculate inflation before copying the results.");
            return;
        }

        const summary = [
            "DigiiFox Inflation Calculator",
            "--------------------------------",
            "Current Amount: " + currentAmountLabel.textContent,
            "Annual Inflation Rate: " +
                inflationRateInput.value + "%",
            "Time Period: " + timePeriodInput.value + " years",
            "Estimated Future Cost: " + futureCostOutput.textContent,
            "Total Price Increase: " + totalIncreaseOutput.textContent,
            "Cumulative Inflation: " +
                cumulativeInflationOutput.textContent,
            "Future Purchasing Power: " +
                futurePurchasingPowerOutput.textContent,
            "",
            "Estimate only. Actual inflation may differ."
        ].join("\n");


        try {

            if (navigator.clipboard && window.isSecureContext) {

                await navigator.clipboard.writeText(summary);

            } else {

                // Fallback for local or older browser contexts.

                const textArea = document.createElement("textarea");

                textArea.value = summary;
                textArea.setAttribute("readonly", "");
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";

                document.body.appendChild(textArea);

                textArea.select();

                const successful =
                    document.execCommand("copy");

                textArea.remove();

                if (!successful) {
                    throw new Error("Copy command was unsuccessful.");
                }
            }


            const originalText = copyButton.textContent;

            copyButton.textContent = "Copied!";

            window.setTimeout(function () {
                copyButton.textContent = originalText;
            }, 1800);

        } catch (error) {

            showError(
                "Unable to copy automatically. Please try again or copy the results manually."
            );
        }
    }


    // =====================================
    // RESET
    // =====================================

    function resetCalculator() {

        currentAmountInput.value = defaultValues.currentAmount;
        inflationRateInput.value = defaultValues.inflationRate;
        timePeriodInput.value = defaultValues.timePeriod;
        currencyInput.value = defaultValues.currency;

        clearError();

        resultsSection.hidden = true;

        futureCostOutput.textContent = "";
        totalIncreaseOutput.textContent = "";
        cumulativeInflationOutput.textContent = "";
        futurePurchasingPowerOutput.textContent = "";

        currentAmountLabel.textContent = "";
        futureCostLabel.textContent = "";

        currentAmountBar.style.width = "0%";
        futureCostBar.style.width = "0%";

        insightOutput.textContent = "";

        stepsContainer.replaceChildren();
        tableBody.replaceChildren();

        copyButton.textContent = "Copy Results";
    }


    // =====================================
    // NAVIGATION
    // =====================================

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {

        menuToggle.addEventListener("click", function () {

            const isActive = mainNav.classList.toggle("active");

            menuToggle.setAttribute(
                "aria-expanded",
                String(isActive)
            );
        });


        mainNav.querySelectorAll("a").forEach(function (link) {

            link.addEventListener("click", function () {

                mainNav.classList.remove("active");

                menuToggle.setAttribute("aria-expanded", "false");
            });
        });


        document.addEventListener("click", function (event) {

            if (
                !mainNav.contains(event.target) &&
                !menuToggle.contains(event.target)
            ) {

                mainNav.classList.remove("active");

                menuToggle.setAttribute("aria-expanded", "false");
            }
        });
    }


    // =====================================
    // FOOTER YEAR
    // =====================================

    const currentYearElement =
        document.getElementById("currentYear");

    if (currentYearElement) {
        currentYearElement.textContent =
            new Date().getFullYear();
    }


    // =====================================
    // EVENT LISTENERS
    // =====================================

    form.addEventListener("submit", function (event) {

        event.preventDefault();

        calculateInflation();
    });


    resetButton.addEventListener("click", resetCalculator);

    copyButton.addEventListener("click", copyResults);


    /*
     * Currency changes only the result formatting.
     * It does not change the numerical calculation.
     */

    currencyInput.addEventListener("change", function () {

        if (!resultsSection.hidden) {
            calculateInflation();
        }
    });


    /*
     * Remove old error messages as the user edits inputs.
     */

    [
        currentAmountInput,
        inflationRateInput,
        timePeriodInput
    ].forEach(function (input) {

        input.addEventListener("input", clearError);
    });


    // =====================================
    // INITIAL CALCULATION
    // =====================================

    calculateInflation();

});