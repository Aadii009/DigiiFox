/* =========================================
   DIGIIFOX GST CALCULATOR
   Calculation and UI Logic
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // -----------------------------------------
    // Elements
    // -----------------------------------------

    const form = document.getElementById("gstForm");

    const modeInput = document.getElementById("gstMode");
    const amountInput = document.getElementById("gstAmount");
    const currencyInput = document.getElementById("gstCurrency");
    const rateInput = document.getElementById("gstRate");
    const customRateInput = document.getElementById("gstCustomRate");
    const customRateField = document.getElementById("gstCustomRateField");
    const taxTypeInput = document.getElementById("gstTaxType");

    const amountLabel = document.getElementById("gstAmountLabel");
    const modeHelp = document.getElementById("gstModeHelp");

    const errorElement = document.getElementById("gstError");
    const resultsElement = document.getElementById("gstResults");

    const resultBadge = document.getElementById("gstResultBadge");
    const finalAmountLabel = document.getElementById("gstFinalAmountLabel");
    const finalAmountElement = document.getElementById("gstFinalAmount");
    const totalCaption = document.getElementById("gstTotalCaption");

    const baseLabel = document.getElementById("gstBaseLabel");
    const baseAmountElement = document.getElementById("gstBaseAmount");
    const taxAmountElement = document.getElementById("gstTaxAmount");

    const cgstRow = document.getElementById("gstCgstRow");
    const sgstRow = document.getElementById("gstSgstRow");
    const igstRow = document.getElementById("gstIgstRow");

    const cgstAmountElement = document.getElementById("gstCgstAmount");
    const sgstAmountElement = document.getElementById("gstSgstAmount");
    const igstAmountElement = document.getElementById("gstIgstAmount");

    const baseSegment = document.getElementById("gstBaseSegment");
    const taxSegment = document.getElementById("gstTaxSegment");

    const breakdownBar = document.getElementById("gstBreakdownBar");
    const breakdownCaption = document.getElementById("gstBreakdownCaption");

    const formulaStep = document.getElementById("gstFormulaStep");
    const substitutionStep = document.getElementById("gstSubstitutionStep");
    const finalStep = document.getElementById("gstFinalStep");

    const resetButton = document.getElementById("gstReset");
    const copyButton = document.getElementById("gstCopy");
    const copyMessage = document.getElementById("gstCopyMessage");


    // -----------------------------------------
    // State
    // -----------------------------------------

    let latestResult = null;


    // -----------------------------------------
    // Currency Formatting
    // -----------------------------------------

    function getCurrency() {
        return currencyInput.value || "INR";
    }

    function formatMoney(value) {
        const currency = getCurrency();

        try {
            return new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);
        } catch (error) {
            return currency + " " + Number(value).toFixed(2);
        }
    }

    function formatNumber(value, maximumFractionDigits = 4) {
        return new Intl.NumberFormat("en-IN", {
            maximumFractionDigits,
            minimumFractionDigits: 0
        }).format(value);
    }

    function formatRate(value) {
        return formatNumber(value, 4) + "%";
    }


    // -----------------------------------------
    // Error and Result Helpers
    // -----------------------------------------

    function showError(message) {
        errorElement.textContent = message;
        resultsElement.hidden = true;
        latestResult = null;
    }

    function clearError() {
        errorElement.textContent = "";
    }

    function clearCopyMessage() {
        copyMessage.textContent = "";
    }


    // -----------------------------------------
    // Update Form Labels
    // -----------------------------------------

    function updateModeLabels() {
        const mode = modeInput.value;

        if (mode === "add") {
            amountLabel.textContent = "Original amount";

            modeHelp.textContent =
                "Enter the amount before GST is added.";

        } else {
            amountLabel.textContent = "Amount including GST";

            modeHelp.textContent =
                "Enter the final price that already includes GST.";
        }

        clearError();
        clearCopyMessage();
    }


    // -----------------------------------------
    // Custom Rate Visibility
    // -----------------------------------------

    function updateCustomRateVisibility() {
        const isCustom = rateInput.value === "custom";

        customRateField.hidden = !isCustom;
        customRateInput.required = isCustom;

        if (!isCustom) {
            customRateInput.value = "";
        }

        clearError();
        clearCopyMessage();
    }


    // -----------------------------------------
    // Read and Validate Inputs
    // -----------------------------------------

    function getInputs() {
        const amount = Number(amountInput.value);

        if (
            amountInput.value.trim() === "" ||
            !Number.isFinite(amount) ||
            amount < 0
        ) {
            throw new Error("Please enter a valid amount of zero or more.");
        }

        if (amount > 1_000_000_000_000) {
            throw new Error(
                "Please enter an amount no greater than 1,000,000,000,000."
            );
        }

        let rate;

        if (rateInput.value === "custom") {
            rate = Number(customRateInput.value);

            if (
                customRateInput.value.trim() === "" ||
                !Number.isFinite(rate) ||
                rate < 0 ||
                rate > 1000
            ) {
                throw new Error(
                    "Enter a valid custom GST rate between 0% and 1000%."
                );
            }
        } else {
            rate = Number(rateInput.value);
        }

        if (!Number.isFinite(rate) || rate < 0 || rate > 1000) {
            throw new Error("Please select a valid GST rate.");
        }

        return {
            amount,
            rate,
            mode: modeInput.value,
            taxType: taxTypeInput.value
        };
    }


    // -----------------------------------------
    // Core GST Calculation
    // -----------------------------------------

    function calculateGST(amount, rate, mode) {
        let baseAmount;
        let gstAmount;
        let finalAmount;

        if (mode === "add") {
            // GST is calculated on the original amount.
            baseAmount = amount;

            gstAmount = baseAmount * (rate / 100);

            finalAmount = baseAmount + gstAmount;

        } else {
            // Extract GST from a price that already includes tax.
            finalAmount = amount;

            baseAmount = finalAmount / (1 + rate / 100);

            gstAmount = finalAmount - baseAmount;
        }

        // Handle very small floating-point differences.
        if (Math.abs(gstAmount) < 1e-10) {
            gstAmount = 0;
        }

        if (Math.abs(baseAmount) < 1e-10) {
            baseAmount = 0;
        }

        if (Math.abs(finalAmount) < 1e-10) {
            finalAmount = 0;
        }

        if (
            !Number.isFinite(baseAmount) ||
            !Number.isFinite(gstAmount) ||
            !Number.isFinite(finalAmount)
        ) {
            throw new Error(
                "The result is too large to calculate. Please enter a smaller amount."
            );
        }

        return {
            baseAmount,
            gstAmount,
            finalAmount
        };
    }


    // -----------------------------------------
    // Display Calculation Steps
    // -----------------------------------------

    function updateCalculationSteps(
        amount,
        rate,
        mode,
        baseAmount,
        gstAmount,
        finalAmount
    ) {
        const formattedAmount = formatMoney(amount);
        const formattedBase = formatMoney(baseAmount);
        const formattedGST = formatMoney(gstAmount);
        const formattedFinal = formatMoney(finalAmount);

        if (mode === "add") {
            formulaStep.textContent =
                "Formula: GST = Original Amount × GST Rate ÷ 100.";

            substitutionStep.textContent =
                `GST = ${formattedAmount} × ${formatRate(rate)} ÷ 100 = ${formattedGST}.`;

            finalStep.textContent =
                `Final Amount = ${formattedBase} + ${formattedGST} = ${formattedFinal}.`;

        } else {
            formulaStep.textContent =
                "Formula: Original Amount = Inclusive Amount ÷ (1 + GST Rate ÷ 100).";

            substitutionStep.textContent =
                `Original Amount = ${formattedAmount} ÷ (1 + ${formatRate(rate)} ÷ 100) = ${formattedBase}.`;

            finalStep.textContent =
                `GST = ${formattedAmount} − ${formattedBase} = ${formattedGST}.`;
        }
    }


    // -----------------------------------------
    // Display Tax Breakdown
    // -----------------------------------------

    function updateTaxBreakdown(gstAmount, rate, taxType) {
        const isIntraState = taxType === "intra";

        cgstRow.hidden = !isIntraState;
        sgstRow.hidden = !isIntraState;
        igstRow.hidden = isIntraState;

        if (isIntraState) {
            // Split total GST equally between CGST and SGST.
            const cgst = gstAmount / 2;
            const sgst = gstAmount - cgst;

            cgstAmountElement.textContent = formatMoney(cgst);
            sgstAmountElement.textContent = formatMoney(sgst);

        } else {
            igstAmountElement.textContent = formatMoney(gstAmount);
        }

        resultBadge.textContent = formatRate(rate) + " GST";
    }


    // -----------------------------------------
    // Visual Amount Breakdown
    // -----------------------------------------

    function updateBreakdown(baseAmount, gstAmount, finalAmount) {
        let basePercentage = 100;
        let taxPercentage = 0;

        if (finalAmount > 0) {
            basePercentage = (baseAmount / finalAmount) * 100;
            taxPercentage = (gstAmount / finalAmount) * 100;
        }

        baseSegment.style.width = basePercentage + "%";
        taxSegment.style.width = taxPercentage + "%";

        breakdownBar.setAttribute(
            "aria-label",
            `Base amount ${formatMoney(baseAmount)}, GST ${formatMoney(gstAmount)}`
        );

        breakdownCaption.textContent =
            `Base ${basePercentage.toFixed(2)}% · GST ${taxPercentage.toFixed(2)}%`;
    }


    // -----------------------------------------
    // Render Results
    // -----------------------------------------

    function renderResults(inputs, result) {
        const {
            amount,
            rate,
            mode,
            taxType
        } = inputs;

        const {
            baseAmount,
            gstAmount,
            finalAmount
        } = result;

        baseLabel.textContent = "Original amount";

        baseAmountElement.textContent = formatMoney(baseAmount);
        taxAmountElement.textContent = formatMoney(gstAmount);

        if (mode === "add") {
            finalAmountLabel.textContent = "Final amount including GST";

            totalCaption.textContent =
                "Original amount plus the calculated GST.";

        } else {
            finalAmountLabel.textContent = "Amount including GST";

            totalCaption.textContent =
                "The entered amount already includes GST.";
        }

        finalAmountElement.textContent = formatMoney(finalAmount);

        updateTaxBreakdown(gstAmount, rate, taxType);

        updateBreakdown(baseAmount, gstAmount, finalAmount);

        updateCalculationSteps(
            amount,
            rate,
            mode,
            baseAmount,
            gstAmount,
            finalAmount
        );

        latestResult = {
            ...inputs,
            ...result
        };

        resultsElement.hidden = false;
        clearError();
    }


    // -----------------------------------------
    // Submit Calculator
    // -----------------------------------------

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        clearCopyMessage();

        try {
            const inputs = getInputs();

            const result = calculateGST(
                inputs.amount,
                inputs.rate,
                inputs.mode
            );

            renderResults(inputs, result);

        } catch (error) {
            showError(error.message);
        }
    });


    // -----------------------------------------
    // Reset Calculator
    // -----------------------------------------

    resetButton.addEventListener("click", () => {
        form.reset();

        modeInput.value = "add";
        amountInput.value = "";
        currencyInput.value = "INR";
        rateInput.value = "18";
        customRateInput.value = "";
        taxTypeInput.value = "intra";

        customRateField.hidden = true;
        customRateInput.required = false;

        updateModeLabels();

        clearError();
        clearCopyMessage();

        latestResult = null;
        resultsElement.hidden = true;

        amountInput.focus();
    });


    // -----------------------------------------
    // Recalculate Display on Currency Change
    // -----------------------------------------

    currencyInput.addEventListener("change", () => {
        clearCopyMessage();

        if (latestResult) {
            renderResults(latestResult, latestResult);
        }
    });


    // -----------------------------------------
    // Clear Errors When Editing
    // -----------------------------------------

    [
        amountInput,
        rateInput,
        customRateInput,
        taxTypeInput
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


    modeInput.addEventListener("change", updateModeLabels);

    rateInput.addEventListener(
        "change",
        updateCustomRateVisibility
    );


    // -----------------------------------------
    // Copy Results
    // -----------------------------------------

    copyButton.addEventListener("click", async () => {
        if (!latestResult) {
            copyMessage.textContent =
                "Calculate GST first, then copy your results.";

            return;
        }

        const result = latestResult;

        const lines = [
            "DigiiFox GST Calculator",
            "Calculation type: " +
            (result.mode === "add" ? "Add GST" : "Remove GST"),
            "GST rate: " + formatRate(result.rate),
            "Transaction type: " +
            (result.taxType === "intra" ? "Intra-state" : "Inter-state"),
            "Original amount: " + formatMoney(result.baseAmount),
            "GST amount: " + formatMoney(result.gstAmount)
        ];

        if (result.taxType === "intra") {
            lines.push(
                "CGST: " + formatMoney(result.gstAmount / 2),
                "SGST: " + formatMoney(result.gstAmount - result.gstAmount / 2)
            );
        } else {
            lines.push("IGST: " + formatMoney(result.gstAmount));
        }

        lines.push(
            "Final amount: " + formatMoney(result.finalAmount),
            "",
            "Note: Verify the applicable GST rate before using this calculation for tax or invoicing purposes."
        );

        const textToCopy = lines.join("\n");

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                // Fallback for local development or older browsers.
                const temporaryTextArea = document.createElement("textarea");

                temporaryTextArea.value = textToCopy;
                temporaryTextArea.setAttribute("readonly", "");
                temporaryTextArea.style.position = "fixed";
                temporaryTextArea.style.left = "-9999px";

                document.body.appendChild(temporaryTextArea);

                temporaryTextArea.select();

                const successful = document.execCommand("copy");

                temporaryTextArea.remove();

                if (!successful) {
                    throw new Error("Copy command failed.");
                }
            }

            copyMessage.textContent = "Results copied successfully.";

        } catch (error) {
            copyMessage.textContent =
                "Copy failed. Please select and copy the results manually.";
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


    // -----------------------------------------
    // Initial Setup
    // -----------------------------------------

    updateModeLabels();
    updateCustomRateVisibility();

});