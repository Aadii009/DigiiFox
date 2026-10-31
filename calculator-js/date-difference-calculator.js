/* =========================================
   DIGIIFOX DATE DIFFERENCE CALCULATOR
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("dateDiffForm");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");

    const swapButton = document.getElementById("dateDiffSwap");
    const todayButton = document.getElementById("dateDiffToday");
    const resetButton = document.getElementById("dateDiffReset");
    const copyButton = document.getElementById("dateDiffCopy");

    const errorBox = document.getElementById("dateDiffError");
    const resultsSection = document.getElementById("dateDiffResults");
    const copyMessage = document.getElementById("dateDiffCopyMessage");

    let lastResultText = "";

    const DAY_MS = 24 * 60 * 60 * 1000;

    /* -----------------------------------------
       Date utilities
    ----------------------------------------- */

    // Use local calendar dates, not UTC-parsed date strings.
    // This avoids dates shifting in some time zones.
    function parseLocalDate(value) {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return null;
        }

        const parts = value.split("-").map(Number);
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];

        const date = new Date(year, month - 1, day);

        // Reject invalid dates such as 31 February.
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

    function formatShortDate(date) {
        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function getDayName(date) {
        return new Intl.DateTimeFormat("en-IN", {
            weekday: "long"
        }).format(date);
    }

    // UTC-based day numbers prevent daylight-saving changes
    // from affecting elapsed calendar-day calculations.
    function getUtcDayNumber(date) {
        return Math.floor(
            Date.UTC(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            ) / DAY_MS
        );
    }

    function getDaysBetween(start, end) {
        return getUtcDayNumber(end) - getUtcDayNumber(start);
    }

    function daysInMonth(year, monthIndex) {
        return new Date(year, monthIndex + 1, 0).getDate();
    }

    /*
       Count weekdays in the interval:
       (start date, end date]

       The start date is excluded.
       The end date is included.

       This calculation uses full weeks and a short remainder,
       so it does not need to loop through every day in a
       potentially very long date range.
    */
    function countWeekdays(start, totalDays) {
        if (totalDays <= 0) {
            return 0;
        }

        const fullWeeks = Math.floor(totalDays / 7);
        const remainingDays = totalDays % 7;

        let weekdays = fullWeeks * 5;

        // Start checking on the calendar day after start.
        const startWeekday = (start.getDay() + 1) % 7;

        for (let i = 0; i < remainingDays; i++) {
            const weekday = (startWeekday + i) % 7;

            // Sunday = 0, Saturday = 6.
            if (weekday !== 0 && weekday !== 6) {
                weekdays++;
            }
        }

        return weekdays;
    }

    /* -----------------------------------------
       Calendar difference
    ----------------------------------------- */

    /*
       Returns calendar years, months, and days using
       calendar-field subtraction with day/month borrowing.

       Example:
       10 January to 25 March
       = 0 years, 2 months, 15 days.

       Calendar months are not assumed to contain 30 days.
    */
    function calculateCalendarDifference(start, end) {
        let years = end.getFullYear() - start.getFullYear();
        let months = end.getMonth() - start.getMonth();
        let days = end.getDate() - start.getDate();

        if (days < 0) {
            // Borrow the number of days in the preceding
            // calendar month relative to the end date.
            const previousMonthIndex = end.getMonth() - 1;
            const previousMonthYear =
                previousMonthIndex < 0
                    ? end.getFullYear() - 1
                    : end.getFullYear();

            const normalizedPreviousMonth =
                (previousMonthIndex + 12) % 12;

            days += daysInMonth(
                previousMonthYear,
                normalizedPreviousMonth
            );

            months--;
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        return {
            years,
            months,
            days
        };
    }

    /* -----------------------------------------
       Error and display helpers
    ----------------------------------------- */

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        resultsSection.hidden = true;
        copyMessage.textContent = "";
        lastResultText = "";
    }

    function clearError() {
        errorBox.textContent = "";
        errorBox.hidden = true;
    }

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function formatNumber(value) {
        return value.toLocaleString("en-IN");
    }

    function pluralize(value, singular, plural = `${singular}s`) {
        return value === 1 ? singular : plural;
    }

    /* -----------------------------------------
       Main calculation
    ----------------------------------------- */

    function calculateDateDifference() {
        clearError();
        copyMessage.textContent = "";

        const firstDate = parseLocalDate(startDateInput.value);
        const secondDate = parseLocalDate(endDateInput.value);

        if (!startDateInput.value || !endDateInput.value) {
            showError("Please select both the start date and end date.");
            return;
        }

        if (!firstDate || !secondDate) {
            showError("Please enter two valid calendar dates.");
            return;
        }

        // Automatically order the dates chronologically.
        const start =
            firstDate <= secondDate ? firstDate : secondDate;

        const end =
            firstDate <= secondDate ? secondDate : firstDate;

        const totalDays = getDaysBetween(start, end);

        const calendarDifference =
            calculateCalendarDifference(start, end);

        const totalWeeks = Math.floor(totalDays / 7);
        const remainingDays = totalDays % 7;

        const weekdays = countWeekdays(start, totalDays);
        const weekendDays = totalDays - weekdays;

        /* Calendar result */

        setText("diffYears", formatNumber(calendarDifference.years));
        setText("diffMonths", formatNumber(calendarDifference.months));
        setText("diffDays", formatNumber(calendarDifference.days));

        /* Elapsed time result */

        setText("diffTotalDays", formatNumber(totalDays));
        setText("diffTotalWeeks", formatNumber(totalWeeks));

        setText(
            "diffRemainingDays",
            `${formatNumber(remainingDays)} ${pluralize(remainingDays, "extra day")}`
        );

        setText("diffWeekdays", formatNumber(weekdays));
        setText("diffWeekendDays", formatNumber(weekendDays));

        /* Date range */

        setText(
            "dateDiffRangeText",
            `${formatDisplayDate(start)} → ${formatDisplayDate(end)}`
        );

        /* Calculation details */

        setText("detailStartDate", formatDisplayDate(start));
        setText("detailEndDate", formatDisplayDate(end));

        setText(
            "detailDayNames",
            `${getDayName(start)} → ${getDayName(end)}`
        );

        /* Copyable result */

        const calendarSummary = [
            `${calendarDifference.years} ${pluralize(calendarDifference.years, "year")}`,
            `${calendarDifference.months} ${pluralize(calendarDifference.months, "month")}`,
            `${calendarDifference.days} ${pluralize(calendarDifference.days, "day")}`
        ].join(", ");

        lastResultText = [
            "DigiiFox Date Difference Calculator",
            `Start date: ${formatDisplayDate(start)}`,
            `End date: ${formatDisplayDate(end)}`,
            `Calendar difference: ${calendarSummary}`,
            `Total elapsed days: ${formatNumber(totalDays)}`,
            `Total complete weeks: ${formatNumber(totalWeeks)}`,
            `Remaining days after complete weeks: ${formatNumber(remainingDays)}`,
            `Weekdays: ${formatNumber(weekdays)}`,
            `Weekend days: ${formatNumber(weekendDays)}`,
            "Counting convention: Start date excluded, end date included."
        ].join("\n");

        resultsSection.hidden = false;

        // Update the document title when the user calculates.
        document.title = "Date Difference Results | DigiiFox";
    }

    /* -----------------------------------------
       Form submission
    ----------------------------------------- */

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        calculateDateDifference();
    });

    /*
       Recalculate after a date is changed only if the user
       has already generated a result.
    */
    let hasCalculated = false;

    form.addEventListener("submit", () => {
        hasCalculated = true;
    });

    [startDateInput, endDateInput].forEach((input) => {
        input.addEventListener("change", () => {
            clearError();
            copyMessage.textContent = "";

            if (hasCalculated) {
                calculateDateDifference();
            }
        });
    });

    /* -----------------------------------------
       Swap dates
    ----------------------------------------- */

    swapButton.addEventListener("click", () => {
        const originalStart = startDateInput.value;

        startDateInput.value = endDateInput.value;
        endDateInput.value = originalStart;

        clearError();
        copyMessage.textContent = "";

        if (hasCalculated) {
            calculateDateDifference();
        }
    });

    /* -----------------------------------------
       Use today's date as the end date
    ----------------------------------------- */

    todayButton.addEventListener("click", () => {
        endDateInput.value = formatInputDate(getToday());

        clearError();
        copyMessage.textContent = "";

        if (hasCalculated) {
            calculateDateDifference();
        }
    });

    /* -----------------------------------------
       Reset
    ----------------------------------------- */

    resetButton.addEventListener("click", () => {
        const today = formatInputDate(getToday());

        startDateInput.value = today;
        endDateInput.value = today;

        clearError();
        copyMessage.textContent = "";
        resultsSection.hidden = true;
        lastResultText = "";
        hasCalculated = false;

        document.title = "Date Difference Calculator | DigiiFox";
    });

    /* -----------------------------------------
       Copy results
    ----------------------------------------- */

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        // Fallback for browsers or local environments
        // where the Clipboard API is unavailable.
        const temporaryTextarea = document.createElement("textarea");

        temporaryTextarea.value = text;
        temporaryTextarea.setAttribute("readonly", "");
        temporaryTextarea.style.position = "fixed";
        temporaryTextarea.style.left = "-9999px";
        temporaryTextarea.style.top = "0";

        document.body.appendChild(temporaryTextarea);
        temporaryTextarea.select();

        const successful = document.execCommand("copy");

        temporaryTextarea.remove();

        if (!successful) {
            throw new Error("Copy command was not successful.");
        }
    }

    copyButton.addEventListener("click", async () => {
        if (!lastResultText) {
            copyMessage.textContent = "Calculate the date difference first.";
            return;
        }

        try {
            await copyText(lastResultText);
            copyMessage.textContent = "Results copied successfully!";
        } catch (error) {
            copyMessage.textContent =
                "Copying was blocked by your browser. Please copy the results manually.";
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

    startDateInput.value = today;
    endDateInput.value = today;

    // Allow the user to select any valid date through
    // the date inputs, without imposing a future-date limit.
    startDateInput.removeAttribute("max");
    endDateInput.removeAttribute("max");
});