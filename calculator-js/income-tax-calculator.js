/* =========================================
   DIGIIFOX INCOME TAX CALCULATOR
   India — Simplified Estimate
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // -----------------------------------------
    // Configuration
    // Review these assumptions when tax rules change.
    // -----------------------------------------

    const TAX_CONFIG = {
        taxYear: "2026–27",

        cessRate: 0.04,

        standardDeduction: {
            new: 75000,
            old: 50000
        },

        newRegime: {
            slabs: [
                { limit: 400000, rate: 0.00 },
                { limit: 800000, rate: 0.05 },
                { limit: 1200000, rate: 0.10 },
                { limit: 1600000, rate: 0.15 },
                { limit: 2000000, rate: 0.20 },
                { limit: 2400000, rate: 0.25 },
                { limit: Infinity, rate: 0.30 }
            ],

            rebateLimit: 1200000,
            rebateMaximum: 60000
        },

        oldRegime: {
            rebateLimit: 500000,
            rebateMaximum: 12500,

            slabs: {
                below60: [
                    { limit: 250000, rate: 0.00 },
                    { limit: 500000, rate: 0.05 },
                    { limit: 1000000, rate: 0.20 },
                    { limit: Infinity, rate: 0.30 }
                ],

                "60to79": [
                    { limit: 300000, rate: 0.00 },
                    { limit: 500000, rate: 0.05 },
                    { limit: 1000000, rate: 0.20 },
                    { limit: Infinity, rate: 0.30 }
                ],

                "80plus": [
                    { limit: 500000, rate: 0.00 },
                    { limit: 1000000, rate: 0.20 },
                    { limit: Infinity, rate: 0.30 }
                ]
            }
        }
    };


    // -----------------------------------------
    // Elements
    // -----------------------------------------

    const form = document.getElementById("itForm");

    const regimeInput = document.getElementById("itRegime");
    const ageInput = document.getElementById("itAge");

    const salaryInput = document.getElementById("itSalary");
    const otherIncomeInput = document.getElementById("itOtherIncome");
    const deductionsInput = document.getElementById("itDeductions");

    const resetButton = document.getElementById("itReset");
    const errorElement = document.getElementById("itError");

    const resultsElement = document.getElementById("itResults");
    const regimeBadge = document.getElementById("itRegimeBadge");

    const taxElement = document.getElementById("itTax");
    const taxableIncomeElement = document.getElementById("itTaxableIncome");
    const takeHomeElement = document.getElementById("itTakeHome");
    const monthlyTakeHomeElement = document.getElementById("itMonthlyTakeHome");

    const comparisonElement = document.getElementById("itComparison");
    const oldTaxElement = document.getElementById("itOldTax");
    const newTaxElement = document.getElementById("itNewTax");
    const oldTaxableElement = document.getElementById("itOldTaxable");
    const newTaxableElement = document.getElementById("itNewTaxable");
    const savingsNote = document.getElementById("itSavingsNote");

    const grossElement = document.getElementById("itGross");
    const standardDeductionElement = document.getElementById("itStandardDeduction");
    const otherDeductionsElement = document.getElementById("itOtherDeductions");
    const taxBeforeRebateElement = document.getElementById("itTaxBeforeRebate");
    const rebateElement = document.getElementById("itRebate");
    const cessElement = document.getElementById("itCess");
    const totalTaxElement = document.getElementById("itTotalTax");

    const visualBar = document.getElementById("itVisualBar");
    const visualTax = document.getElementById("itVisualTax");
    const visualNet = document.getElementById("itVisualNet");
    const visualCaption = document.getElementById("itVisualCaption");

    const stepOne = document.getElementById("itStepOne");
    const stepTwo = document.getElementById("itStepTwo");
    const stepThree = document.getElementById("itStepThree");
    const stepFour = document.getElementById("itStepFour");

    const copyButton = document.getElementById("itCopy");
    const copyMessage = document.getElementById("itCopyMessage");


    // -----------------------------------------
    // State
    // -----------------------------------------

    let latestSummary = null;


    // -----------------------------------------
    // Formatting
    // -----------------------------------------

    function money(value) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        }).format(value);
    }

    function number(value) {
        return new Intl.NumberFormat("en-IN", {
            maximumFractionDigits: 2
        }).format(value);
    }

    function wholeRupees(value) {
        return new Intl.NumberFormat("en-IN", {
            maximumFractionDigits: 0
        }).format(value);
    }


    // -----------------------------------------
    // Helpers
    // -----------------------------------------

    function clearError() {
        errorElement.textContent = "";
    }

    function clearCopyMessage() {
        copyMessage.textContent = "";
    }

    function showError(message) {
        errorElement.textContent = message;
        resultsElement.hidden = true;
        latestSummary = null;
    }


    // -----------------------------------------
    // Input Validation
    // -----------------------------------------

    function readAmount(input, label) {
        const raw = input.value.trim();

        if (raw === "") {
            throw new Error(`Please enter ${label}.`);
        }

        const value = Number(raw);

        if (!Number.isFinite(value) || value < 0) {
            throw new Error(
                `${label.charAt(0).toUpperCase() + label.slice(1)} must be zero or more.`
            );
        }

        if (value > 100000000000) {
            throw new Error(
                "Please enter amounts no greater than ₹100,000,000,000 per field."
            );
        }

        return value;
    }

    function readInputs() {
        const salary = readAmount(salaryInput, "annual salary or pension income");
        const otherIncome = readAmount(otherIncomeInput, "other taxable income");
        const deductions = readAmount(deductionsInput, "eligible deductions");

        if (salary + otherIncome > 200000000000) {
            throw new Error("The combined income is too large to calculate.");
        }

        return {
            salary,
            otherIncome,
            deductions,
            age: ageInput.value,
            regime: regimeInput.value
        };
    }


    // -----------------------------------------
    // Progressive Slab Calculation
    // -----------------------------------------

    function calculateSlabTax(taxableIncome, slabs) {
        const income = Math.max(0, taxableIncome);

        let previousLimit = 0;
        let totalTax = 0;

        for (const slab of slabs) {
            if (income <= previousLimit) {
                break;
            }

            const amountInSlab =
                Math.min(income, slab.limit) - previousLimit;

            if (amountInSlab > 0) {
                totalTax += amountInSlab * slab.rate;
            }

            if (income <= slab.limit) {
                break;
            }

            previousLimit = slab.limit;
        }

        return totalTax;
    }


    // -----------------------------------------
    // Calculate One Regime
    // -----------------------------------------

    function calculateRegime(inputs, regime) {
        const grossIncome = inputs.salary + inputs.otherIncome;

        const standardDeduction =
            TAX_CONFIG.standardDeduction[regime];

        // New-regime deductions are not accepted through this
        // generic deductions field.
        const eligibleOtherDeductions =
            regime === "old" ? inputs.deductions : 0;

        const taxableIncome = Math.max(
            0,
            grossIncome -
            standardDeduction -
            eligibleOtherDeductions
        );

        let slabs;
        let rawTax;

        if (regime === "new") {
            slabs = TAX_CONFIG.newRegime.slabs;

            rawTax = calculateSlabTax(taxableIncome, slabs);

        } else {
            slabs = TAX_CONFIG.oldRegime.slabs[inputs.age];

            rawTax = calculateSlabTax(taxableIncome, slabs);
        }


        // -------------------------------------
        // Rebate and marginal relief estimate
        // -------------------------------------

        let rebate = 0;
        let taxAfterRebate = rawTax;

        if (regime === "new") {
            const rebateLimit = TAX_CONFIG.newRegime.rebateLimit;
            const rebateMaximum = TAX_CONFIG.newRegime.rebateMaximum;

            if (taxableIncome <= rebateLimit) {
                rebate = Math.min(rawTax, rebateMaximum);

                taxAfterRebate = Math.max(0, rawTax - rebate);

            } else {
                // Simplified marginal-relief estimate:
                // tax after rebate is not more than the income
                // exceeding the configured rebate threshold,
                // while the regular calculated tax is lower.
                const incomeAboveThreshold =
                    taxableIncome - rebateLimit;

                const taxAfterMarginalRelief =
                    Math.min(rawTax, Math.max(0, incomeAboveThreshold));

                taxAfterRebate = taxAfterMarginalRelief;

                rebate = Math.max(0, rawTax - taxAfterRebate);
            }

        } else {
            const rebateLimit = TAX_CONFIG.oldRegime.rebateLimit;
            const rebateMaximum = TAX_CONFIG.oldRegime.rebateMaximum;

            // Section 87A rebate estimate for eligible resident
            // individuals under the simplified old-regime rules.
            if (taxableIncome <= rebateLimit) {
                rebate = Math.min(rawTax, rebateMaximum);
            }

            taxAfterRebate = Math.max(0, rawTax - rebate);
        }


        // Health and education cess estimate.
        const cess = taxAfterRebate * TAX_CONFIG.cessRate;

        const totalTax = taxAfterRebate + cess;

        const incomeAfterTax = Math.max(0, grossIncome - totalTax);

        return {
            regime,
            grossIncome,
            standardDeduction,
            eligibleOtherDeductions,
            taxableIncome,
            rawTax,
            rebate,
            taxAfterRebate,
            cess,
            totalTax,
            incomeAfterTax,
            monthlyIncomeAfterTax: incomeAfterTax / 12
        };
    }


    // -----------------------------------------
    // Calculate Required Regime(s)
    // -----------------------------------------

    function calculateAll(inputs) {
        const oldResult = calculateRegime(inputs, "old");
        const newResult = calculateRegime(inputs, "new");

        let selectedResult;

        if (inputs.regime === "old") {
            selectedResult = oldResult;
        } else if (inputs.regime === "new") {
            selectedResult = newResult;
        } else {
            selectedResult =
                oldResult.totalTax <= newResult.totalTax
                    ? oldResult
                    : newResult;
        }

        return {
            oldResult,
            newResult,
            selectedResult,
            requestedRegime: inputs.regime
        };
    }


    // -----------------------------------------
    // Render Comparison
    // -----------------------------------------

    function renderComparison(oldResult, newResult) {
        oldTaxElement.textContent = money(oldResult.totalTax);
        newTaxElement.textContent = money(newResult.totalTax);

        oldTaxableElement.textContent =
            "Taxable income: " + money(oldResult.taxableIncome);

        newTaxableElement.textContent =
            "Taxable income: " + money(newResult.taxableIncome);

        const difference = Math.abs(
            oldResult.totalTax - newResult.totalTax
        );

        if (Math.abs(oldResult.totalTax - newResult.totalTax) < 0.01) {
            savingsNote.textContent =
                "Both regimes produce approximately the same estimated tax.";

        } else if (newResult.totalTax < oldResult.totalTax) {
            savingsNote.textContent =
                `The new regime shows approximately ${money(difference)} less estimated tax than the old regime.`;

        } else {
            savingsNote.textContent =
                `The old regime shows approximately ${money(difference)} less estimated tax than the new regime, based on the deductions entered.`;
        }
    }


    // -----------------------------------------
    // Render Main Results
    // -----------------------------------------

    function renderResults(inputs, calculation) {
        const result = calculation.selectedResult;

        taxElement.textContent = money(result.totalTax);
        taxableIncomeElement.textContent = money(result.taxableIncome);

        takeHomeElement.textContent = money(result.incomeAfterTax);

        monthlyTakeHomeElement.textContent =
            money(result.monthlyIncomeAfterTax);

        grossElement.textContent = money(result.grossIncome);

        standardDeductionElement.textContent =
            "− " + money(result.standardDeduction);

        otherDeductionsElement.textContent =
            "− " + money(result.eligibleOtherDeductions);

        taxBeforeRebateElement.textContent = money(result.rawTax);

        rebateElement.textContent = "− " + money(result.rebate);

        cessElement.textContent = money(result.cess);

        totalTaxElement.textContent = money(result.totalTax);


        // Regime badge.
        if (inputs.regime === "compare") {
            regimeBadge.textContent =
                result.regime === "new"
                    ? "Lower estimate: New"
                    : "Lower estimate: Old";

        } else {
            regimeBadge.textContent =
                result.regime === "new"
                    ? "New Regime"
                    : "Old Regime";
        }


        // Comparison is shown when selected.
        comparisonElement.hidden = inputs.regime !== "compare";

        if (inputs.regime === "compare") {
            renderComparison(
                calculation.oldResult,
                calculation.newResult
            );
        }


        // Income visual.
        const totalIncome = result.grossIncome;
        const totalForVisual = Math.max(0, totalIncome);

        let taxPercentage = 0;
        let netPercentage = 100;

        if (totalForVisual > 0) {
            taxPercentage = Math.min(
                100,
                (result.totalTax / totalForVisual) * 100
            );

            netPercentage = Math.max(0, 100 - taxPercentage);
        }

        visualTax.style.width = taxPercentage + "%";
        visualNet.style.width = netPercentage + "%";

        visualBar.setAttribute(
            "aria-label",
            `Estimated tax ${money(result.totalTax)} and income after tax ${money(result.incomeAfterTax)}`
        );

        visualCaption.textContent =
            `Tax: ${taxPercentage.toFixed(2)}% of gross income`;


        // Calculation steps.
        stepOne.textContent =
            `Gross income = ${money(inputs.salary)} salary/pension + ${money(inputs.otherIncome)} other income = ${money(result.grossIncome)}.`;

        stepTwo.textContent =
            `Taxable income = ${money(result.grossIncome)} − ${money(result.standardDeduction)} standard deduction − ${money(result.eligibleOtherDeductions)} other eligible deductions = ${money(result.taxableIncome)}.`;

        stepThree.textContent =
            `Estimated tax before rebate = ${money(result.rawTax)}. Estimated rebate = ${money(result.rebate)}. Cess = ${money(result.cess)}.`;

        stepFour.textContent =
            `Estimated total tax = ${money(result.totalTax)}. Estimated income after tax = ${money(result.incomeAfterTax)}.`;

        latestSummary = {
            inputs,
            calculation
        };

        resultsElement.hidden = false;
        clearError();
    }


    // -----------------------------------------
    // Submit
    // -----------------------------------------

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        clearCopyMessage();

        try {
            const inputs = readInputs();
            const calculation = calculateAll(inputs);

            renderResults(inputs, calculation);

        } catch (error) {
            showError(error.message);
        }
    });


    // -----------------------------------------
    // Reset
    // -----------------------------------------

    resetButton.addEventListener("click", () => {
        form.reset();

        regimeInput.value = "compare";
        ageInput.value = "below60";
        salaryInput.value = "1200000";
        otherIncomeInput.value = "0";
        deductionsInput.value = "150000";

        resultsElement.hidden = true;
        comparisonElement.hidden = true;

        latestSummary = null;

        clearError();
        clearCopyMessage();

        salaryInput.focus();
    });


    // -----------------------------------------
    // Clear Messages on Input
    // -----------------------------------------

    [
        regimeInput,
        ageInput,
        salaryInput,
        otherIncomeInput,
        deductionsInput
    ].forEach((element) => {
        element.addEventListener("input", () => {
            clearError();
            clearCopyMessage();
        });

        element.addEventListener("change", () => {
            clearError();
            clearCopyMessage();
        });
    });


    // -----------------------------------------
    // Copy Tax Summary
    // -----------------------------------------

    copyButton.addEventListener("click", async () => {
        if (!latestSummary) {
            copyMessage.textContent =
                "Calculate income tax first, then copy your summary.";

            return;
        }

        const { inputs, calculation } = latestSummary;
        const result = calculation.selectedResult;

        const lines = [
            "DigiiFox Income Tax Calculator",
            "Tax year: " + TAX_CONFIG.taxYear,
            "Selected regime: " + result.regime,
            "Gross income: " + money(result.grossIncome),
            "Standard deduction: " + money(result.standardDeduction),
            "Other eligible deductions: " +
            money(result.eligibleOtherDeductions),
            "Taxable income: " + money(result.taxableIncome),
            "Tax before rebate: " + money(result.rawTax),
            "Estimated rebate: " + money(result.rebate),
            "Estimated cess: " + money(result.cess),
            "Estimated total tax: " + money(result.totalTax),
            "Estimated annual income after tax: " +
            money(result.incomeAfterTax),
            "Estimated monthly income after tax: " +
            money(result.monthlyIncomeAfterTax)
        ];

        if (inputs.regime === "compare") {
            lines.push(
                "",
                "Old regime estimated tax: " +
                money(calculation.oldResult.totalTax),
                "New regime estimated tax: " +
                money(calculation.newResult.totalTax)
            );
        }

        lines.push(
            "",
            "Disclaimer: Simplified estimate only. Verify current tax rules and your actual tax liability."
        );

        const textToCopy = lines.join("\n");

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const textarea = document.createElement("textarea");

                textarea.value = textToCopy;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";

                document.body.appendChild(textarea);
                textarea.select();

                const successful = document.execCommand("copy");

                textarea.remove();

                if (!successful) {
                    throw new Error("Copy failed.");
                }
            }

            copyMessage.textContent = "Tax summary copied successfully.";

        } catch (error) {
            copyMessage.textContent =
                "Copy failed. Please copy the results manually.";
        }
    });


    // -----------------------------------------
    // Mobile Navigation
    // -----------------------------------------

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


    // -----------------------------------------
    // Dynamic Footer Year
    // -----------------------------------------

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

});