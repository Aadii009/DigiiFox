/* =========================================
   DIGIIFOX FD CALCULATOR
   Fixed deposit maturity estimator
========================================= */

document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const form = document.getElementById("fdForm");
    const currencyInput = document.getElementById("fdCurrency");
    const principalInput = document.getElementById("fdPrincipal");
    const rateInput = document.getElementById("fdRate");
    const tenureInput = document.getElementById("fdTenure");
    const tenureUnitInput = document.getElementById("fdTenureUnit");
    const frequencyInput = document.getElementById("fdFrequency");

    const currencySymbol = document.getElementById("fdCurrencySymbol");
    const errorBox = document.getElementById("fdError");
    const resultsSection = document.getElementById("fdResults");

    const maturityOutput = document.getElementById("fdMaturity");
    const principalOutput = document.getElementById("fdPrincipalResult");
    const interestOutput = document.getElementById("fdInterest");
    const growthOutput = document.getElementById("fdGrowth");
    const breakdownTotal = document.getElementById("fdBreakdownTotal");

    const principalSegment = document.getElementById("fdPrincipalSegment");
    const interestSegment = document.getElementById("fdInterestSegment");

    const formulaStep = document.getElementById("fdFormulaStep");
    const substitutionStep = document.getElementById("fdSubstitutionStep");
    const finalStep = document.getElementById("fdFinalStep");

    const resetButton = document.getElementById("fdReset");
    const copyButton = document.getElementById("fdCopy");
    const copyMessage = document.getElementById("fdCopyMessage");

    const currencySymbols = {
        INR: "₹",
        USD: "$",
        EUR: "€",
        GBP: "£",
        CAD: "CA$",
        AUD: "A$",
        SGD: "S$",
        AED: "د.إ"
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

    let latestCalculation = null;

    /*
     * Currency formatting
     * Selecting a currency changes the display only.
     */

    function getCurrency() {
        return currencyInput.value || "INR";
    }

    function formatMoney(amount) {
        const currency = getCurrency();
        const locale = currencyLocales[currency] || "en-IN";

        const formattedNumber = new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);

        return (currencySymbols[currency] || "") + formattedNumber;
    }

    function updateCurrencySymbol() {
        currencySymbol.textContent =
            currencySymbols[getCurrency()] || "";

        if (latestCalculation) {
            displayResults(latestCalculation);
        }
    }

    /*
     * Validation helpers
     */

    function readNumber(input) {
        const value = input.value.trim();

        if (value === "") {
            return NaN;
        }

        return Number(value);
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
    }

    function clearError() {
        errorBox.textContent = "";
        errorBox.hidden = true;
    }

    function validateInputs() {
        const principal = readNumber(principalInput);
        const annualRate = readNumber(rateInput);
        const tenure = readNumber(tenureInput);
        const frequency = Number(frequencyInput.value);
        const tenureUnit = tenureUnitInput.value;

        if (
            !Number.isFinite(principal) ||
            principal <= 0 ||
            principal > 1e12
        ) {
            return {
                valid: false,
                message: "Enter a deposit amount greater than 0 and no more than 1,000,000,000,000."
            };
        }

        if (
            !Number.isFinite(annualRate) ||
            annualRate < 0 ||
            annualRate > 100
        ) {
            return {
                valid: false,
                message: "Enter an annual interest rate between 0% and 100%."
            };
        }

        if (
            !Number.isInteger(tenure) ||
            tenure < 1 ||
            tenure > 1200
        ) {
            return {
                valid: false,
                message: "Enter a whole-number tenure between 1 and 1200 in your selected unit."
            };
        }

        if (![1, 2, 4, 12].includes(frequency)) {
            return {
                valid: false,
                message: "Select a valid compounding frequency."
            };
        }

        let timeInYears;

        if (tenureUnit === "years") {
            timeInYears = tenure;
        } else if (tenureUnit === "months") {
            timeInYears = tenure / 12;
        } else if (tenureUnit === "days") {
            timeInYears = tenure / 365;
        } else {
            return {
                valid: false,
                message: "Select a valid tenure unit."
            };
        }

        return {
            valid: true,
            principal,
            annualRate,
            tenure,
            tenureUnit,
            frequency,
            timeInYears
        };
    }

    /*
     * FD calculation
     *
     * Formula:
     * A = P * (1 + r/n)^(n*t)
     *
     * P = principal
     * r = annual rate expressed as a decimal
     * n = compounding periods per year
     * t = tenure expressed in years
     *
     * For short or irregular tenures, actual bank
     * conventions may use different calculations.
     */

    function calculateFD(data) {
        const {
            principal,
            annualRate,
            tenure,
            tenureUnit,
            frequency,
            timeInYears
        } = data;

        const rate = annualRate / 100;

        const periodicRate = rate / frequency;
        const totalPeriods = frequency * timeInYears;

        const maturityAmount = principal *
            Math.pow(1 + periodicRate, totalPeriods);

        const interestEarned = maturityAmount - principal;

        const growthPercentage = principal > 0
            ? (interestEarned / principal) * 100
            : 0;

        return {
            principal,
            annualRate,
            tenure,
            tenureUnit,
            frequency,
            timeInYears,
            periodicRate,
            totalPeriods,
            maturityAmount,
            interestEarned,
            growthPercentage
        };
    }

    /*
     * Human-readable calculation details
     */

    function getFrequencyName(frequency) {
        const names = {
            1: "yearly",
            2: "half-yearly",
            4: "quarterly",
            12: "monthly"
        };

        return names[frequency] || "selected";
    }

    function getTenureDescription(result) {
        const unitNames = {
            years: result.tenure === 1 ? "year" : "years",
            months: result.tenure === 1 ? "month" : "months",
            days: result.tenure === 1 ? "day" : "days"
        };

        return result.tenure + " " +
            unitNames[result.tenureUnit];
    }

    function updateCalculationDetails(result) {
        const rateText = result.annualRate + "%";
        const frequencyName =
            getFrequencyName(result.frequency);

        formulaStep.textContent =
            "Formula: A = P × (1 + r/n)^(n × t), where P = " +
            formatMoney(result.principal) +
            ", r = " + rateText +
            ", n = " + result.frequency +
            ", and t = " + result.timeInYears +
            " years.";

        substitutionStep.textContent =
            "Substitution: A = " +
            formatMoney(result.principal) +
            " × (1 + " +
            (result.annualRate / 100).toFixed(6) +
            "/" + result.frequency +
            ")^(" + result.frequency +
            " × " + result.timeInYears + ").";

        finalStep.textContent =
            "Estimated maturity amount: " +
            formatMoney(result.maturityAmount) +
            ". Interest earned: " +
            formatMoney(result.interestEarned) +
            ". Compounding: " + frequencyName +
            ". Tenure: " + getTenureDescription(result) + ".";
    }

    /*
     * Display results
     */

    function displayResults(result) {
        maturityOutput.textContent =
            formatMoney(result.maturityAmount);

        principalOutput.textContent =
            formatMoney(result.principal);

        interestOutput.textContent =
            formatMoney(result.interestEarned);

        breakdownTotal.textContent =
            "Total: " + formatMoney(result.maturityAmount);

        growthOutput.textContent =
            result.growthPercentage.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) + "%";

        let principalPercentage = 100;
        let interestPercentage = 0;

        if (result.maturityAmount > 0) {
            principalPercentage =
                (result.principal / result.maturityAmount) * 100;

            interestPercentage =
                (result.interestEarned / result.maturityAmount) * 100;
        }

        principalPercentage = Math.max(
            0,
            Math.min(100, principalPercentage)
        );

        interestPercentage = Math.max(
            0,
            Math.min(100, interestPercentage)
        );

        principalSegment.style.width =
            principalPercentage + "%";

        interestSegment.style.width =
            interestPercentage + "%";

        principalSegment.title =
            "Initial deposit: " +
            principalPercentage.toFixed(2) + "%";

        interestSegment.title =
            "Interest earned: " +
            interestPercentage.toFixed(2) + "%";

        updateCalculationDetails(result);

        resultsSection.hidden = false;
    }

    /*
     * Calculate on form submission
     */

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        clearError();
        copyMessage.textContent = "";

        const validation = validateInputs();

        if (!validation.valid) {
            latestCalculation = null;
            resultsSection.hidden = true;
            showError(validation.message);
            return;
        }

        const result = calculateFD(validation);

        if (
            !Number.isFinite(result.maturityAmount) ||
            !Number.isFinite(result.interestEarned) ||
            !Number.isFinite(result.growthPercentage)
        ) {
            latestCalculation = null;
            resultsSection.hidden = true;

            showError(
                "The result is too large to calculate reliably. Reduce the deposit amount, interest rate, or tenure."
            );

            return;
        }

        latestCalculation = result;
        displayResults(result);

        resultsSection.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    });

    /*
     * Update currency display
     */

    currencyInput.addEventListener("change", function () {
        updateCurrencySymbol();
    });

    /*
     * Reset to default inputs
     */

    document.getElementById("fdReset").addEventListener(
        "click",
        function () {
            form.reset();

            currencyInput.value = "INR";
            principalInput.value = "100000";
            rateInput.value = "7";
            tenureInput.value = "5";
            tenureUnitInput.value = "years";
            frequencyInput.value = "4";

            latestCalculation = null;

            clearError();

            resultsSection.hidden = true;
            copyMessage.textContent = "";

            principalSegment.style.width = "100%";
            interestSegment.style.width = "0%";

            updateCurrencySymbol();

            principalInput.focus();
        }
    );

    /*
     * Copy results
     */

    function buildCopyText(result) {
        return [
            "DigiiFox FD Calculator Results",
            "------------------------------",
            "Initial deposit: " +
                formatMoney(result.principal),
            "Annual interest rate: " +
                result.annualRate + "%",
            "Deposit tenure: " +
                getTenureDescription(result),
            "Compounding frequency: " +
                getFrequencyName(result.frequency),
            "Estimated maturity amount: " +
                formatMoney(result.maturityAmount),
            "Interest earned: " +
                formatMoney(result.interestEarned),
            "Total growth: " +
                result.growthPercentage.toFixed(2) + "%",
            "",
            "Estimate only. Actual bank calculations may differ."
        ].join("\n");
    }

    async function copyResults() {
        if (!latestCalculation) {
            copyMessage.textContent =
                "Calculate your FD returns first.";
            return;
        }

        const textToCopy = buildCopyText(latestCalculation);

        try {
            if (
                navigator.clipboard &&
                window.isSecureContext
            ) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const temporaryTextArea =
                    document.createElement("textarea");

                temporaryTextArea.value = textToCopy;
                temporaryTextArea.setAttribute("readonly", "");
                temporaryTextArea.style.position = "fixed";
                temporaryTextArea.style.left = "-9999px";

                document.body.appendChild(temporaryTextArea);
                temporaryTextArea.select();

                const successful =
                    document.execCommand("copy");

                temporaryTextArea.remove();

                if (!successful) {
                    throw new Error("Copy failed.");
                }
            }

            copyMessage.textContent =
                "Results copied successfully.";
        } catch (error) {
            copyMessage.textContent =
                "Copy was unavailable. Please copy the results manually.";
        }
    }

    copyButton.addEventListener("click", copyResults);

    /*
     * Shared mobile navigation
     */

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", function () {
            const isOpen = mainNav.classList.toggle("active");

            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        });

        mainNav.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                mainNav.classList.remove("active");

                menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );
            });
        });
    }

    /*
     * Dynamic footer year
     */

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent =
            new Date().getFullYear();
    }

    /*
     * Initial setup
     */

    updateCurrencySymbol();
});