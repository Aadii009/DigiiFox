/* =========================================
   DIGIIFOX EMI CALCULATOR
   ========================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------------------
    // ELEMENTS
    // -----------------------------------------

    const form = document.getElementById("emiForm");

    const loanAmountInput = document.getElementById("loanAmount");

    const interestRateInput = document.getElementById("interestRate");

    const loanTenureInput = document.getElementById("loanTenure");

    const tenureUnitInput = document.getElementById("tenureUnit");

    const tenureHelp = document.getElementById("tenureHelp");

    const errorBox = document.getElementById("emiError");

    const resetButton = document.getElementById("emiReset");

    const emptyState = document.getElementById("emiEmpty");

    const output = document.getElementById("emiOutput");

    const resultsCard = document.getElementById("emiResults");

    const scheduleCard = document.getElementById("scheduleCard");

    const scheduleFilter = document.getElementById("scheduleFilter");

    const scheduleBody = document.getElementById("scheduleBody");

    const scheduleInfo = document.getElementById("scheduleInfo");

    const copyButton = document.getElementById("copyEMIResults");

    const copyStatus = document.getElementById("emiCopyStatus");


    // -----------------------------------------
    // CONFIGURATION
    // -----------------------------------------

    const MAX_LOAN_AMOUNT = 1_000_000_000_000;

    const MAX_ANNUAL_RATE = 100;

    const MAX_MONTHS = 600;

    const DISPLAY_DECIMALS = 2;


    // -----------------------------------------
    // FORMATTERS
    // -----------------------------------------

    const currencyFormatter = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: DISPLAY_DECIMALS,
        maximumFractionDigits: DISPLAY_DECIMALS
    });

    const numberFormatter = new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2
    });


    function formatCurrency(value) {

        if (!Number.isFinite(value)) {
            return "—";
        }

        return currencyFormatter.format(
            Math.abs(value) < 0.0000001 ? 0 : value
        );

    }


    function formatNumber(value) {

        if (!Number.isFinite(value)) {
            return "—";
        }

        return numberFormatter.format(value);

    }


    function formatPercentage(value) {

        return `${formatNumber(value)}%`;

    }


    // -----------------------------------------
    // ERROR HANDLING
    // -----------------------------------------

    function showError(message) {

        errorBox.textContent = message;

        errorBox.classList.add("is-visible");

    }


    function clearError() {

        errorBox.textContent = "";

        errorBox.classList.remove("is-visible");

    }


    // -----------------------------------------
    // INPUT VALIDATION
    // -----------------------------------------

    function readLoanInputs() {

        const principal = Number(loanAmountInput.value);

        const annualRate = Number(interestRateInput.value);

        const tenureValue = Number(loanTenureInput.value);

        const tenureUnit = tenureUnitInput.value;


        if (
            loanAmountInput.value.trim() === "" ||
            !Number.isFinite(principal) ||
            principal <= 0 ||
            principal > MAX_LOAN_AMOUNT
        ) {

            return {
                error:
                    "Enter a loan amount greater than ₹0 and no greater " +
                    "than ₹1,000,000,000,000."
            };

        }


        if (
            interestRateInput.value.trim() === "" ||
            !Number.isFinite(annualRate) ||
            annualRate < 0 ||
            annualRate > MAX_ANNUAL_RATE
        ) {

            return {
                error:
                    "Enter an annual interest rate between 0% and 100%."
            };

        }


        if (
            loanTenureInput.value.trim() === "" ||
            !Number.isFinite(tenureValue) ||
            !Number.isInteger(tenureValue) ||
            tenureValue < 1
        ) {

            return {
                error: "Enter a whole number for the loan tenure."
            };

        }


        const months = tenureUnit === "years"
            ? tenureValue * 12
            : tenureValue;


        if (months > MAX_MONTHS) {

            return {
                error:
                    "The maximum supported loan tenure is 600 months " +
                    "(50 years)."
            };

        }


        if (months < 1 || !Number.isInteger(months)) {

            return {
                error: "Please enter a valid loan tenure."
            };

        }


        return {
            principal,
            annualRate,
            months,
            tenureValue,
            tenureUnit
        };

    }


    // -----------------------------------------
    // EMI FORMULA
    // -----------------------------------------

    function calculateEMI(principal, annualRate, months) {

        /*
         * Annual percentage rate -> monthly decimal rate.
         *
         * Example:
         * 12% annual interest -> 0.01 monthly interest.
         */

        const monthlyRate = annualRate / 1200;


        /*
         * Special case:
         * When interest is zero, principal is divided equally
         * across the number of monthly payments.
         */

        if (monthlyRate === 0) {
            return principal / months;
        }


        /*
         * EMI = P * r * (1 + r)^n
         *       -------------------
         *          (1 + r)^n - 1
         *
         * Equivalent stable form:
         * EMI = P * r / (1 - (1 + r)^(-n))
         */

        const denominator =
            1 - Math.pow(1 + monthlyRate, -months);

        if (denominator <= 0 || !Number.isFinite(denominator)) {
            throw new Error("Unable to calculate EMI with these values.");
        }


        const emi = principal * monthlyRate / denominator;


        if (!Number.isFinite(emi) || emi <= 0) {
            throw new Error("The EMI calculation produced an invalid result.");
        }


        return emi;

    }


    // -----------------------------------------
    // AMORTIZATION SCHEDULE
    // -----------------------------------------

    function calculateAmortization(principal, annualRate, months, emi) {

        const monthlyRate = annualRate / 1200;

        const schedule = [];

        let outstandingBalance = principal;

        let totalInterest = 0;

        let totalPaid = 0;


        for (let month = 1; month <= months; month++) {

            const openingBalance = outstandingBalance;

            const interest = openingBalance * monthlyRate;

            let payment = emi;

            let principalPaid = payment - interest;


            /*
             * The final payment settles the remaining balance.
             * This also prevents tiny negative balances caused
             * by floating-point arithmetic.
             */

            if (month === months || principalPaid >= openingBalance) {

                principalPaid = openingBalance;

                payment = principalPaid + interest;

            }


            if (principalPaid < 0) {

                throw new Error(
                    "The calculated payment does not cover the interest."
                );

            }


            outstandingBalance = Math.max(
                0,
                openingBalance - principalPaid
            );


            // Normalize negligible floating-point residuals.

            if (outstandingBalance < 0.000001) {
                outstandingBalance = 0;
            }


            totalInterest += interest;

            totalPaid += payment;


            schedule.push({

                month,

                openingBalance,

                payment,

                principalPaid,

                interest,

                closingBalance: outstandingBalance

            });


            if (outstandingBalance === 0) {
                break;
            }

        }


        return {

            schedule,

            totalInterest,

            totalPaid,

            actualMonths: schedule.length,

            monthlyRate

        };

    }


    // -----------------------------------------
    // COMPLETE CALCULATION
    // -----------------------------------------

    function calculateLoan(inputs) {

        const emi = calculateEMI(
            inputs.principal,
            inputs.annualRate,
            inputs.months
        );


        const amortization = calculateAmortization(
            inputs.principal,
            inputs.annualRate,
            inputs.months,
            emi
        );


        const interestRatio =
            amortization.totalInterest / inputs.principal * 100;


        return {

            ...inputs,

            emi,

            totalInterest: amortization.totalInterest,

            totalPayment: amortization.totalPaid,

            schedule: amortization.schedule,

            actualMonths: amortization.actualMonths,

            interestRatio,

            monthlyRate: amortization.monthlyRate

        };

    }


    // -----------------------------------------
    // DISPLAY HELPERS
    // -----------------------------------------

    function setText(id, text) {

        const element = document.getElementById(id);

        if (element) {
            element.textContent = text;
        }

    }


    function showResults() {

        emptyState.hidden = true;

        output.hidden = false;

        scheduleCard.hidden = false;

    }


    function showEmptyState() {

        emptyState.hidden = false;

        output.hidden = true;

        scheduleCard.hidden = true;

    }


    // -----------------------------------------
    // RENDER LOAN SUMMARY
    // -----------------------------------------

    function renderSummary(result) {

        setText(
            "monthlyEMI",
            formatCurrency(result.emi)
        );


        setText(
            "monthlyEMIDetail",
            `${formatNumber(result.actualMonths)} monthly installments`
        );


        setText(
            "principalAmount",
            formatCurrency(result.principal)
        );


        setText(
            "totalInterest",
            formatCurrency(result.totalInterest)
        );


        setText(
            "totalPayment",
            formatCurrency(result.totalPayment)
        );


        setText(
            "displayTenure",
            result.actualMonths === 1
                ? "1 month"
                : `${formatNumber(result.actualMonths)} months`
        );


        setText(
            "displayRate",
            formatPercentage(result.annualRate)
        );


        setText(
            "interestRatio",
            formatPercentage(result.interestRatio)
        );


        setText(
            "repaymentCount",
            `${formatNumber(result.actualMonths)} payments`
        );


        /*
         * The bar widths are based on the full repayment amount.
         * They represent principal versus interest.
         */

        const principalShare =
            result.totalPayment > 0
                ? result.principal / result.totalPayment * 100
                : 100;

        const interestShare =
            result.totalPayment > 0
                ? result.totalInterest / result.totalPayment * 100
                : 0;


        const principalBar = document.getElementById("principalBar");

        const interestBar = document.getElementById("interestBar");


        principalBar.style.width = `${principalShare}%`;

        interestBar.style.width = `${interestShare}%`;


        principalBar.title =
            `Principal: ${formatPercentage(principalShare)}`;

        interestBar.title =
            `Interest: ${formatPercentage(interestShare)}`;


        showResults();

    }


    // -----------------------------------------
    // RENDER AMORTIZATION TABLE
    // -----------------------------------------

    function renderSchedule(result) {

        const filterValue = scheduleFilter.value;

        const requestedRows = filterValue === "all"
            ? result.schedule.length
            : Number(filterValue);


        const visibleRows = result.schedule.slice(0, requestedRows);

        const fragment = document.createDocumentFragment();


        visibleRows.forEach(row => {

            const tr = document.createElement("tr");


            const values = [

                row.month,

                formatCurrency(row.openingBalance),

                formatCurrency(row.payment),

                formatCurrency(row.principalPaid),

                formatCurrency(row.interest),

                formatCurrency(row.closingBalance)

            ];


            values.forEach((value, index) => {

                const td = document.createElement("td");

                td.textContent = value;


                if (index === 0) {
                    td.setAttribute("scope", "row");
                }

                tr.appendChild(td);

            });


            fragment.appendChild(tr);

        });


        scheduleBody.replaceChildren(fragment);


        if (visibleRows.length < result.schedule.length) {

            scheduleInfo.textContent =
                `Showing ${visibleRows.length} of ` +
                `${result.schedule.length} monthly payments.`;

        } else {

            scheduleInfo.textContent =
                `Showing all ${result.schedule.length} monthly payments.`;

        }

    }


    // -----------------------------------------
    // CALCULATE AND RENDER
    // -----------------------------------------

    let lastResult = null;


    function performCalculation() {

        clearError();

        copyStatus.textContent = "";


        const inputs = readLoanInputs();


        if (inputs.error) {

            showError(inputs.error);

            return;

        }


        try {

            const result = calculateLoan(inputs);

            lastResult = result;


            renderSummary(result);

            renderSchedule(result);


            if (window.innerWidth <= 950) {

                resultsCard.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }

        } catch (error) {

            console.error("EMI calculation error:", error);

            showError(
                "Unable to calculate your EMI with these inputs. " +
                "Please review your loan details and try again."
            );

        }

    }


    form.addEventListener("submit", event => {

        event.preventDefault();

        performCalculation();

    });


    // -----------------------------------------
    // SCHEDULE FILTER
    // -----------------------------------------

    scheduleFilter.addEventListener("change", () => {

        if (lastResult) {
            renderSchedule(lastResult);
        }

    });


    // -----------------------------------------
    // EXAMPLE BUTTONS
    // -----------------------------------------

    document.querySelectorAll(".emi-example-btn")
        .forEach(button => {

            button.addEventListener("click", () => {

                loanAmountInput.value = button.dataset.amount;

                interestRateInput.value = button.dataset.rate;

                loanTenureInput.value = button.dataset.tenure;

                tenureUnitInput.value = button.dataset.unit;


                clearError();

                copyStatus.textContent = "";


                /*
                 * Load the example into the inputs.
                 * The user can change the values before calculating.
                 */

                loanAmountInput.focus();

            });

        });


    // -----------------------------------------
    // TENURE HELP TEXT
    // -----------------------------------------

    function updateTenureHelp() {

        if (tenureUnitInput.value === "years") {

            tenureHelp.textContent =
                "Maximum supported tenure: 50 years.";

        } else {

            tenureHelp.textContent =
                "Enter a whole number between 1 and 600 months.";

        }

    }


    tenureUnitInput.addEventListener("change", updateTenureHelp);


    // -----------------------------------------
    // RESET
    // -----------------------------------------

    resetButton.addEventListener("click", () => {

        form.reset();

        clearError();

        copyStatus.textContent = "";

        lastResult = null;


        scheduleBody.replaceChildren();

        scheduleInfo.textContent = "";


        document.getElementById("principalBar").style.width = "0";

        document.getElementById("interestBar").style.width = "0";


        scheduleFilter.value = "12";


        updateTenureHelp();

        showEmptyState();

    });


    // -----------------------------------------
    // COPY LOAN SUMMARY
    // -----------------------------------------

    function createCopyText(result) {

        return [

            "DigiiFox EMI Calculator",

            "=======================",

            `Loan Amount: ${formatCurrency(result.principal)}`,

            `Annual Interest Rate: ${formatPercentage(result.annualRate)}`,

            `Loan Tenure: ${result.actualMonths} months`,

            "",

            `Monthly EMI: ${formatCurrency(result.emi)}`,

            `Principal Amount: ${formatCurrency(result.principal)}`,

            `Total Interest: ${formatCurrency(result.totalInterest)}`,

            `Total Repayment: ${formatCurrency(result.totalPayment)}`,

            `Interest / Principal: ${formatPercentage(result.interestRatio)}`,

            "",

            "Calculation based on a fixed annual interest rate " +
            "and monthly reducing balance.",

            "This is an estimate, not a lender quote."

        ].join("\n");

    }


    async function copyResults() {

        if (!lastResult) {

            copyStatus.textContent =
                "Calculate your EMI before copying the summary.";

            return;

        }


        const textToCopy = createCopyText(lastResult);


        try {

            if (navigator.clipboard && window.isSecureContext) {

                await navigator.clipboard.writeText(textToCopy);

            } else {

                /*
                 * Fallback for local previews where Clipboard API
                 * access may not be available.
                 */

                const temporaryTextarea =
                    document.createElement("textarea");

                temporaryTextarea.value = textToCopy;

                temporaryTextarea.setAttribute("readonly", "");

                temporaryTextarea.style.position = "fixed";

                temporaryTextarea.style.opacity = "0";

                temporaryTextarea.style.pointerEvents = "none";


                document.body.appendChild(temporaryTextarea);

                temporaryTextarea.select();


                const successful =
                    document.execCommand("copy");


                temporaryTextarea.remove();


                if (!successful) {
                    throw new Error("Copy command failed.");
                }

            }


            copyStatus.textContent =
                "Loan summary copied successfully!";

        } catch (error) {

            console.error("Copy error:", error);

            copyStatus.textContent =
                "Unable to copy automatically. Try using Live Server or a secure browser context.";

        }

    }


    copyButton.addEventListener("click", copyResults);


    // -----------------------------------------
    // MOBILE NAVIGATION
    // -----------------------------------------

    const menuToggle = document.getElementById("menuToggle");

    const mainNav = document.getElementById("mainNav");


    if (menuToggle && mainNav) {

        menuToggle.addEventListener("click", () => {

            const isOpen =
                mainNav.classList.toggle("active");

            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

        });


        mainNav.querySelectorAll("a").forEach(link => {

            link.addEventListener("click", () => {

                mainNav.classList.remove("active");

                menuToggle.setAttribute("aria-expanded", "false");

            });

        });

    }


    // -----------------------------------------
    // DYNAMIC FOOTER YEAR
    // -----------------------------------------

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {

        currentYear.textContent = new Date().getFullYear();

    }


    // -----------------------------------------
    // INITIAL STATE
    // -----------------------------------------

    updateTenureHelp();

    showEmptyState();

});