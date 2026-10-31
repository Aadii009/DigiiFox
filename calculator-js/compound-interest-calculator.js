/* =====================================================
   DIGIIFOX — COMPOUND INTEREST CALCULATOR
   JavaScript
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("compoundInterestForm");

    if (!form) return;

    // ================= DOM ELEMENTS =================

    const currencySelect = document.getElementById("ciCurrency");
    const currencySymbol = document.getElementById("ciCurrencySymbol");

    const principalInput = document.getElementById("ciPrincipal");
    const rateInput = document.getElementById("ciRate");
    const timeInput = document.getElementById("ciTime");
    const timeUnitSelect = document.getElementById("ciTimeUnit");
    const frequencySelect = document.getElementById("ciFrequency");

    const errorBox = document.getElementById("ciError");
    const resultsCard = document.getElementById("ciResults");
    const resultBadge = document.getElementById("ciResultBadge");

    const finalAmountOutput = document.getElementById("ciFinalAmount");
    const principalOutput = document.getElementById("ciPrincipalResult");
    const interestOutput = document.getElementById("ciInterestResult");
    const growthOutput = document.getElementById("ciGrowthResult");
    const effectiveRateOutput = document.getElementById("ciEffectiveRate");

    const compositionLabel = document.getElementById("ciCompositionLabel");
    const compositionBar = document.getElementById("ciCompositionBar");
    const principalSegment = document.getElementById("ciPrincipalSegment");
    const interestSegment = document.getElementById("ciInterestSegment");

    const stepsContainer = document.getElementById("ciSteps");
    const formulaStep = document.getElementById("ciFormulaStep");
    const substitutionStep = document.getElementById("ciSubstitutionStep");
    const finalStep = document.getElementById("ciFinalStep");

    const resetButton = document.getElementById("ciReset");
    const copyButton = document.getElementById("ciCopy");
    const copyMessage = document.getElementById("ciCopyMessage");

    // ================= CONFIGURATION =================

    const currencySymbols = {
        INR: "₹",
        USD: "$",
        EUR: "€",
        GBP: "£",
        CAD: "CA$",
        AUD: "A$",
        SGD: "S$",
        AED: "AED "
    };

    const currencyLocales = {
        INR: "en-IN",
        USD: "en-US",
        EUR: "de-DE",
        GBP: "en-GB",
        CAD: "en-CA",
        AUD: "en-AU",
        SGD: "en-SG",
        AED: "en-AE"
    };

    let lastCalculation = null;

    // ================= FORMATTING =================

    function formatMoney(amount, currency = currencySelect.value) {
        try {
            return new Intl.NumberFormat(
                currencyLocales[currency] || "en-US",
                {
                    style: "currency",
                    currency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            ).format(amount);
        } catch (error) {
            return `${currencySymbols[currency] || ""}${amount.toFixed(2)}`;
        }
    }

    function formatNumber(number, maximumFractionDigits = 6) {
        return new Intl.NumberFormat("en-US", {
            maximumFractionDigits
        }).format(number);
    }

    function formatPercent(number) {
        return `${formatNumber(number, 4)}%`;
    }

    function getCurrency() {
        return currencySelect.value;
    }

    function getTimeInYears(time, unit) {
        if (unit === "months") return time / 12;
        if (unit === "days") return time / 365;

        return time;
    }

    function getTimeLabel(time, unit) {
        const labels = {
            years: "year",
            months: "month",
            days: "day"
        };

        const label = labels[unit] || "year";

        return `${formatNumber(time)} ${label}${time === 1 ? "" : "s"}`;
    }

    function getFrequencyLabel(frequency) {
        const labels = {
            1: "Yearly",
            2: "Half-yearly",
            4: "Quarterly",
            12: "Monthly",
            365: "Daily"
        };

        return labels[frequency] || `${frequency} times per year`;
    }

    function getEffectiveAnnualRate(annualRate, frequency) {
        if (annualRate === 0) return 0;

        const periodicRate = annualRate / (100 * frequency);

        return (
            (Math.pow(1 + periodicRate, frequency) - 1) * 100
        );
    }

    // ================= MESSAGES =================

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
    }

    function clearError() {
        errorBox.textContent = "";
        errorBox.hidden = true;
    }

    function clearCopyMessage() {
        copyMessage.textContent = "";
    }

    function updateCurrencySymbol() {
        currencySymbol.textContent =
            currencySymbols[getCurrency()] || "";
    }

    // ================= DEFAULT RESULTS =================

    function setDefaultResults() {
        finalAmountOutput.textContent = "—";
        principalOutput.textContent = "—";
        interestOutput.textContent = "—";
        growthOutput.textContent = "—";
        effectiveRateOutput.textContent = "—";

        resultBadge.textContent = "Ready to calculate";
        resultBadge.classList.remove("ci-calculated");
        resultBadge.removeAttribute("aria-label");

        compositionLabel.textContent = "Principal + Interest";

        principalSegment.style.width = "100%";
        interestSegment.style.width = "0%";

        compositionBar.setAttribute(
            "aria-label",
            "Investment composition will appear after calculation"
        );

        stepsContainer.hidden = true;

        formulaStep.textContent = "";
        substitutionStep.textContent = "";
        finalStep.textContent = "";

        resultsCard.setAttribute("aria-label", "Investment calculation results");

        lastCalculation = null;
    }

    // ================= VALIDATION =================

    function validateInputs() {
        const principal = principalInput.valueAsNumber;
        const annualRate = rateInput.valueAsNumber;
        const time = timeInput.valueAsNumber;
        const timeUnit = timeUnitSelect.value;
        const frequency = Number(frequencySelect.value);

        if (
            principalInput.value.trim() === "" ||
            rateInput.value.trim() === "" ||
            timeInput.value.trim() === ""
        ) {
            return {
                valid: false,
                message: "Please enter the principal amount, annual interest rate, and investment duration."
            };
        }

        if (!Number.isFinite(principal) || principal <= 0) {
            return {
                valid: false,
                message: "Please enter a principal amount greater than zero."
            };
        }

        if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) {
            return {
                valid: false,
                message: "Please enter an annual interest rate between 0% and 100%."
            };
        }

        if (!Number.isFinite(time) || time <= 0) {
            return {
                valid: false,
                message: "Please enter an investment duration greater than zero."
            };
        }

        if (!["years", "months", "days"].includes(timeUnit)) {
            return {
                valid: false,
                message: "Please select a valid duration unit."
            };
        }

        if (![1, 2, 4, 12, 365].includes(frequency)) {
            return {
                valid: false,
                message: "Please select a valid compounding frequency."
            };
        }

        const years = getTimeInYears(time, timeUnit);

        if (!Number.isFinite(years) || years <= 0) {
            return {
                valid: false,
                message: "The selected duration cannot be calculated."
            };
        }

        // Limit computational workload and prevent impractical inputs.
        if (years > 1000) {
            return {
                valid: false,
                message: "Please enter an investment duration of 1,000 years or less."
            };
        }

        const periodicRate = annualRate / (100 * frequency);
        const periods = frequency * years;

        const finalAmount =
            principal * Math.pow(1 + periodicRate, periods);

        const interest = finalAmount - principal;

        if (
            !Number.isFinite(finalAmount) ||
            !Number.isFinite(interest) ||
            finalAmount <= 0
        ) {
            return {
                valid: false,
                message: "These values produce a result that is too large to calculate reliably. Please enter smaller values."
            };
        }

        const effectiveAnnualRate =
            getEffectiveAnnualRate(annualRate, frequency);

        if (!Number.isFinite(effectiveAnnualRate)) {
            return {
                valid: false,
                message: "The effective annual rate could not be calculated. Please check your inputs."
            };
        }

        return {
            valid: true,
            principal,
            annualRate,
            time,
            timeUnit,
            years,
            frequency,
            periodicRate,
            periods,
            finalAmount,
            interest,
            effectiveAnnualRate,
            currency: getCurrency()
        };
    }

    // ================= CALCULATE =================

    function calculateCompoundInterest(event) {
        if (event) event.preventDefault();

        clearError();
        clearCopyMessage();

        const result = validateInputs();

        if (!result.valid) {
            showError(result.message);
            return;
        }

        lastCalculation = result;

        renderResults(result);
    }

    // ================= RENDER RESULTS =================

    function renderResults(data) {
        const {
            principal,
            annualRate,
            time,
            timeUnit,
            years,
            frequency,
            periodicRate,
            periods,
            finalAmount,
            interest,
            effectiveAnnualRate,
            currency
        } = data;

        finalAmountOutput.textContent =
            formatMoney(finalAmount, currency);

        principalOutput.textContent =
            formatMoney(principal, currency);

        interestOutput.textContent =
            formatMoney(interest, currency);

        // Percentage increase relative to the original principal.
        const totalGrowthPercentage = (interest / principal) * 100;

        growthOutput.textContent =
            formatPercent(totalGrowthPercentage);

        effectiveRateOutput.textContent =
            formatPercent(effectiveAnnualRate);

        resultBadge.textContent = "Calculation complete";
        resultBadge.classList.add("ci-calculated");
        resultBadge.setAttribute(
            "aria-label",
            `Calculation complete for ${getTimeLabel(time, timeUnit)}.`
        );

        // Investment composition.
        const principalPercentage = (principal / finalAmount) * 100;
        const interestPercentage = (interest / finalAmount) * 100;

        principalSegment.style.width =
            `${principalPercentage}%`;

        interestSegment.style.width =
            `${interestPercentage}%`;

        compositionLabel.textContent =
            `${principalPercentage.toFixed(1)}% principal · ${interestPercentage.toFixed(1)}% interest`;

        compositionBar.setAttribute(
            "aria-label",
            `Principal represents ${principalPercentage.toFixed(2)}% of the final amount. Interest represents ${interestPercentage.toFixed(2)}%.`
        );

        // Explanation of the mathematical steps.
        formulaStep.textContent =
            "Formula: A = P × (1 + r/n)^(n × t), where r is the annual rate as a decimal.";

        substitutionStep.textContent =
            `Substitute: A = ${formatMoney(principal, currency)} × (1 + ${formatNumber(annualRate / 100)} ÷ ${frequency})^(${formatNumber(frequency)} × ${formatNumber(years)}).`;

        finalStep.textContent =
            `Final amount = ${formatMoney(finalAmount, currency)}. Compound interest = ${formatMoney(finalAmount, currency)} − ${formatMoney(principal, currency)} = ${formatMoney(interest, currency)}.`;

        stepsContainer.hidden = false;

        resultsCard.setAttribute(
            "aria-label",
            `Calculation complete. Final amount: ${formatMoney(finalAmount, currency)}. Compound interest: ${formatMoney(interest, currency)}.`
        );
    }

    // ================= FORM SUBMISSION =================

    form.addEventListener("submit", calculateCompoundInterest);

    // ================= CURRENCY =================

    currencySelect.addEventListener("change", () => {
        updateCurrencySymbol();
        clearCopyMessage();

        // Currency selection changes formatting only.
        // No foreign exchange conversion is performed.
        if (lastCalculation) {
            lastCalculation.currency = getCurrency();
            renderResults(lastCalculation);
        }
    });

    // ================= RESET =================

    resetButton.addEventListener("click", () => {
        clearError();
        clearCopyMessage();
        setDefaultResults();
    });

    form.addEventListener("reset", () => {
        clearError();
        clearCopyMessage();
        setDefaultResults();

        window.setTimeout(updateCurrencySymbol, 0);
    });

    [
        principalInput,
        rateInput,
        timeInput,
        timeUnitSelect,
        frequencySelect
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

    // ================= COPY RESULTS =================

    async function copyResults() {
        clearCopyMessage();

        if (!lastCalculation) {
            copyMessage.textContent =
                "Calculate compound interest before copying the results.";
            return;
        }

        const data = lastCalculation;

        const textToCopy = [
            "DigiiFox — Compound Interest Calculator",
            "",
            `Initial Principal: ${formatMoney(data.principal, data.currency)}`,
            `Annual Interest Rate: ${formatNumber(data.annualRate)}%`,
            `Investment Duration: ${getTimeLabel(data.time, data.timeUnit)}`,
            `Compounding Frequency: ${getFrequencyLabel(data.frequency)}`,
            `Time in Years: ${formatNumber(data.years)}`,
            `Final Amount: ${formatMoney(data.finalAmount, data.currency)}`,
            `Compound Interest: ${formatMoney(data.interest, data.currency)}`,
            `Total Growth: ${formatPercent((data.interest / data.principal) * 100)}`,
            `Effective Annual Rate: ${formatPercent(data.effectiveAnnualRate)}`,
            "",
            "Formula: A = P(1 + r/n)^(nt)",
            "Note: Estimate based on a fixed rate and the selected compounding convention."
        ].join("\n");

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const temporaryTextArea = document.createElement("textarea");

                temporaryTextArea.value = textToCopy;
                temporaryTextArea.setAttribute("readonly", "");
                temporaryTextArea.style.position = "fixed";
                temporaryTextArea.style.left = "-9999px";

                document.body.appendChild(temporaryTextArea);
                temporaryTextArea.select();

                const copied = document.execCommand("copy");

                temporaryTextArea.remove();

                if (!copied) {
                    throw new Error("Copy command failed.");
                }
            }

            copyMessage.textContent = "Results copied successfully!";
        } catch (error) {
            copyMessage.textContent =
                "Copy was blocked by your browser. Please copy the results manually.";
        }
    }

    copyButton.addEventListener("click", copyResults);

    // ================= MOBILE NAVIGATION =================

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("active");

            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation" : "Toggle navigation"
            );
        });

        mainNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                mainNav.classList.remove("active");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Toggle navigation");
            });
        });
    }

    // ================= FOOTER YEAR =================

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    // ================= INITIALIZE =================

    updateCurrencySymbol();
    setDefaultResults();
});