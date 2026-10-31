/* =========================================
   DIGIIFOX DAYS BETWEEN DATES CALCULATOR
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("daysBetweenForm");
    const startInput = document.getElementById("daysStartDate");
    const endInput = document.getElementById("daysEndDate");
    const includeBothDates = document.getElementById("includeBothDates");

    const swapButton = document.getElementById("daysSwap");
    const todayButton = document.getElementById("daysUseToday");
    const resetButton = document.getElementById("daysReset");
    const copyButton = document.getElementById("daysCopy");

    const errorBox = document.getElementById("daysBetweenError");
    const resultsSection = document.getElementById("daysBetweenResults");
    const copyMessage = document.getElementById("daysCopyMessage");

    const DAY_MS = 24 * 60 * 60 * 1000;

    let hasCalculated = false;
    let lastResultText = "";

    /* -----------------------------------------
       Date utilities
    ----------------------------------------- */

    function parseLocalDate(value) {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return null;
        }

        const [year, month, day] = value.split("-").map(Number);

        const date = new Date(year, month - 1, day);

        // Reject invalid dates rather than allowing JavaScript
        // to roll them into the following month.
        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null;
        }

        return date;
    }

    function getToday() {
        const today = new Date();

        return new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );
    }

    function formatInputDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatDisplayDate(date) {
        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function getWeekdayName(date) {
        return new Intl.DateTimeFormat("en-IN", {
            weekday: "long"
        }).format(date);
    }

    function getUtcDayNumber(date) {
        return Math.floor(
            Date.UTC(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            ) / DAY_MS
        );
    }

    function getElapsedDays(start, end) {
        return getUtcDayNumber(end) - getUtcDayNumber(start);
    }

    function formatNumber(value) {
        return value.toLocaleString("en-IN");
    }

    function pluralize(value, singular, plural = `${singular}s`) {
        return value === 1 ? singular : plural;
    }

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    /* -----------------------------------------
       Count weekdays and weekend days

       If inclusive:
       Count from the start date through the end date.

       If exclusive:
       Count from the day after the start date through
       the end date.

       The algorithm counts complete weeks first, then
       checks only the remaining zero to six days.
    ----------------------------------------- */

    function countWeekdays(start, totalDays, inclusive) {
        if (totalDays <= 0) {
            return 0;
        }

        const completeWeeks = Math.floor(totalDays / 7);
        const remainingDays = totalDays % 7;

        let weekdays = completeWeeks * 5;

        const firstCountedDay = inclusive
            ? start.getDay()
            : (start.getDay() + 1) % 7;

        for (let i = 0; i < remainingDays; i++) {
            const weekday = (firstCountedDay + i) % 7;

            // Sunday = 0; Saturday = 6.
            if (weekday !== 0 && weekday !== 6) {
                weekdays++;
            }
        }

        return weekdays;
    }

    /* -----------------------------------------
       Error handling
    ----------------------------------------- */

    function clearError() {
        errorBox.textContent = "";
        errorBox.hidden = true;
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        resultsSection.hidden = true;

        copyMessage.textContent = "";
        lastResultText = "";
    }

    /* -----------------------------------------
       Main calculation
    ----------------------------------------- */

    function calculateDaysBetween() {
        clearError();
        copyMessage.textContent = "";

        const firstDate = parseLocalDate(startInput.value);
        const secondDate = parseLocalDate(endInput.value);

        if (!startInput.value || !endInput.value) {
            showError("Please select both the start date and end date.");
            return;
        }

        if (!firstDate || !secondDate) {
            showError("Please select two valid calendar dates.");
            return;
        }

        // Sort the dates so the result is always non-negative.
        const start =
            firstDate <= secondDate ? firstDate : secondDate;

        const end =
            firstDate <= secondDate ? secondDate : firstDate;

        const inclusive = includeBothDates.checked;

        const elapsedDays = getElapsedDays(start, end);

        // Inclusive counting adds the starting date.
        const totalDays = elapsedDays + (inclusive ? 1 : 0);

        const totalWeeks = Math.floor(totalDays / 7);
        const remainingDays = totalDays % 7;

        const weekdays = countWeekdays(
            start,
            totalDays,
            inclusive
        );

        const weekendDays = totalDays - weekdays;

        /*
           Approximate calendar-month equivalent.

           This is intentionally labelled approximate because
           calendar months have different lengths.
        */
        const approximateMonths = totalDays / 30.436875;

        /* Main result */

        setText("daysTotal", formatNumber(totalDays));

        setText(
            "daysTotalLabel",
            pluralize(totalDays, "day")
        );

        setText(
            "daysBetweenResultCaption",
            inclusive ? "Total days, including both dates" : "Total elapsed days"
        );

        setText(
            "daysRangeText",
            `${formatDisplayDate(start)} → ${formatDisplayDate(end)}`
        );

        /* Breakdown */

        setText("daysTotalWeeks", formatNumber(totalWeeks));

        setText(
            "daysExtraDays",
            `${formatNumber(remainingDays)} ${pluralize(remainingDays, "remaining day")}`
        );

        setText("daysWeekdays", formatNumber(weekdays));
        setText("daysWeekendDays", formatNumber(weekendDays));

        setText(
            "daysCalendarMonths",
            approximateMonths.toFixed(1)
        );

        /* Calculation details */

        setText("daysDetailStart", formatDisplayDate(start));
        setText("daysDetailEnd", formatDisplayDate(end));

        setText(
            "daysDetailStartWeekday",
            getWeekdayName(start)
        );

        setText(
            "daysDetailEndWeekday",
            getWeekdayName(end)
        );

        setText(
            "daysDetailMethod",
            inclusive
                ? "Both dates included"
                : "Start excluded, end included"
        );

        /* Copy summary */

        lastResultText = [
            "DigiiFox Days Between Dates Calculator",
            `Start date: ${formatDisplayDate(start)}`,
            `End date: ${formatDisplayDate(end)}`,
            `Total days: ${formatNumber(totalDays)}`,
            `Elapsed days: ${formatNumber(elapsedDays)}`,
            `Counting method: ${inclusive ? "Both dates included" : "Start excluded, end included"}`,
            `Complete weeks: ${formatNumber(totalWeeks)}`,
            `Remaining days: ${formatNumber(remainingDays)}`,
            `Weekdays: ${formatNumber(weekdays)}`,
            `Weekend days: ${formatNumber(weekendDays)}`,
            `Approximate months: ${approximateMonths.toFixed(1)}`
        ].join("\n");

        resultsSection.hidden = false;
        hasCalculated = true;
    }

    /* -----------------------------------------
       Form submission
    ----------------------------------------- */

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        calculateDaysBetween();
    });

    /*
       Recalculate automatically after changing an input,
       once the user has calculated at least once.
    */

    [startInput, endInput, includeBothDates].forEach((input) => {
        input.addEventListener("change", () => {
            clearError();
            copyMessage.textContent = "";

            if (hasCalculated) {
                calculateDaysBetween();
            }
        });
    });

    /* -----------------------------------------
       Swap dates
    ----------------------------------------- */

    swapButton.addEventListener("click", () => {
        const originalStart = startInput.value;

        startInput.value = endInput.value;
        endInput.value = originalStart;

        clearError();
        copyMessage.textContent = "";

        if (hasCalculated) {
            calculateDaysBetween();
        }
    });

    /* -----------------------------------------
       Use today
    ----------------------------------------- */

    todayButton.addEventListener("click", () => {
        endInput.value = formatInputDate(getToday());

        clearError();
        copyMessage.textContent = "";

        if (hasCalculated) {
            calculateDaysBetween();
        }
    });

    /* -----------------------------------------
       Reset
    ----------------------------------------- */

    resetButton.addEventListener("click", () => {
        const today = formatInputDate(getToday());

        startInput.value = today;
        endInput.value = today;
        includeBothDates.checked = false;

        clearError();

        copyMessage.textContent = "";
        resultsSection.hidden = true;

        lastResultText = "";
        hasCalculated = false;
    });

    /* -----------------------------------------
       Copy results
    ----------------------------------------- */

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement("textarea");

        textarea.value = text;
        textarea.setAttribute("readonly", "");

        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";

        document.body.appendChild(textarea);
        textarea.select();

        const successful = document.execCommand("copy");

        textarea.remove();

        if (!successful) {
            throw new Error("Copy failed.");
        }
    }

    copyButton.addEventListener("click", async () => {
        if (!lastResultText) {
            copyMessage.textContent = "Calculate the result first.";
            return;
        }

        try {
            await copyText(lastResultText);
            copyMessage.textContent = "Results copied successfully!";
        } catch (error) {
            copyMessage.textContent =
                "Your browser blocked copying. Please copy the results manually.";
        }
    });

    /* -----------------------------------------
       Mobile navigation
    ----------------------------------------- */

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

        document.addEventListener("click", (event) => {
            if (
                !mainNav.contains(event.target) &&
                !menuToggle.contains(event.target)
            ) {
                mainNav.classList.remove("active");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Toggle navigation");
            }
        });
    }

    /* -----------------------------------------
       Footer year
    ----------------------------------------- */

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    /* -----------------------------------------
       Initial setup
    ----------------------------------------- */

    const today = formatInputDate(getToday());

    startInput.value = today;
    endInput.value = today;

    startInput.removeAttribute("max");
    endInput.removeAttribute("max");
});