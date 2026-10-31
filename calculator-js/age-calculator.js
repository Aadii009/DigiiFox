/* =====================================================
   DIGIIFOX AGE CALCULATOR
   File: age-calculator.js
===================================================== */

"use strict";


/* ================= DOM ELEMENTS ================= */

const ageForm = document.getElementById("ageForm");

const birthDateInput = document.getElementById("birthDate");
const ageAsOfInput = document.getElementById("ageAsOfDate");

const ageResetButton = document.getElementById("ageReset");
const ageCopyButton = document.getElementById("ageCopy");

const ageError = document.getElementById("ageError");
const ageResults = document.getElementById("ageResults");
const ageCopyMessage = document.getElementById("ageCopyMessage");


/* ================= DATE HELPERS ================= */

/*
   Read a YYYY-MM-DD string as a local calendar date.

   Using the numeric year/month/day components avoids
   UTC timezone shifts that can happen with:
   new Date("YYYY-MM-DD")
*/

function parseLocalDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const parts = value.split("-").map(Number);

    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    const date = new Date(year, month - 1, day);

    /*
       Reject invalid dates such as February 30.
       JavaScript otherwise rolls invalid dates into
       the following month.
    */

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}


/*
   Create today's date at local midnight.
*/

function getToday() {
    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}


/*
   Convert a date into a sortable YYYY-MM-DD string.
*/

function formatDateInput(date) {
    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/*
   Format a date for human-readable results.
*/

function formatDisplayDate(date) {
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}


/*
   Return a new local date without mutating the original.
*/

function cloneDate(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}


/*
   Calculate the number of whole calendar days between
   two local dates.

   UTC day numbers avoid daylight-saving issues in
   environments that use daylight-saving time.
*/

function getDaysBetween(startDate, endDate) {
    const startUTC = Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
    );

    const endUTC = Date.UTC(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
    );

    return Math.round(
        (endUTC - startUTC) / 86400000
    );
}


/*
   Find the number of days in a calendar month.
*/

function getDaysInMonth(year, monthIndex) {
    return new Date(
        year,
        monthIndex + 1,
        0
    ).getDate();
}


/* ================= AGE CALCULATION ================= */

/*
   Calculate calendar age in complete years, months,
   and days.

   The day-of-month borrowing rule uses the number of
   days in the previous calendar month.

   Example:
   15 January to 14 February = 0 months, 30 days.

   This is a calendar calculation, not an estimate
   based on dividing days by 30 or 365.
*/

function calculateCalendarAge(birthDate, endDate) {
    let years =
        endDate.getFullYear() - birthDate.getFullYear();

    let months =
        endDate.getMonth() - birthDate.getMonth();

    let days =
        endDate.getDate() - birthDate.getDate();


    // Borrow a calendar month if the end day is earlier.
    if (days < 0) {
        months -= 1;

        const previousMonthDays = getDaysInMonth(
            endDate.getFullYear(),
            endDate.getMonth() - 1
        );

        days += previousMonthDays;
    }


    // Borrow a year if the remaining month count is negative.
    if (months < 0) {
        years -= 1;
        months += 12;
    }


    return {
        years,
        months,
        days
    };
}


/* ================= BIRTHDAY HELPERS ================= */

/*
   JavaScript normalizes invalid dates, so explicitly
   clamp the day when a month does not contain the
   original birth day.

   For a February 29 birthday in a non-leap year,
   this calculator uses February 28 as the anniversary.

   This is a calculation convention; legal birthday
   rules can differ by jurisdiction.
*/

function makeBirthdayInYear(birthDate, year) {
    const birthMonth = birthDate.getMonth();

    const birthDay = birthDate.getDate();

    const maximumDay = getDaysInMonth(
        year,
        birthMonth
    );

    const adjustedDay = Math.min(
        birthDay,
        maximumDay
    );

    return new Date(
        year,
        birthMonth,
        adjustedDay
    );
}


/*
   Determine the most recent birthday on or before
   the selected end date.
*/

function getLastBirthday(birthDate, endDate) {
    let anniversary = makeBirthdayInYear(
        birthDate,
        endDate.getFullYear()
    );

    if (anniversary > endDate) {
        anniversary = makeBirthdayInYear(
            birthDate,
            endDate.getFullYear() - 1
        );
    }

    return anniversary;
}


/*
   Determine the next birthday strictly after the
   selected end date.

   If the selected date is the birthday itself,
   the next birthday is one year later.
*/

function getNextBirthday(birthDate, endDate) {
    let anniversary = makeBirthdayInYear(
        birthDate,
        endDate.getFullYear()
    );

    if (anniversary <= endDate) {
        anniversary = makeBirthdayInYear(
            birthDate,
            endDate.getFullYear() + 1
        );
    }

    return anniversary;
}


/* ================= DISPLAY HELPERS ================= */

function formatNumber(number) {
    return new Intl.NumberFormat("en-IN").format(number);
}


function pluralize(value, singular, plural) {
    return value === 1 ? singular : plural;
}


/*
   Display an error and hide stale results.
*/

function showAgeError(message) {
    ageError.textContent = message;
    ageError.hidden = false;

    ageResults.hidden = true;
    ageCopyMessage.textContent = "";
}


/*
   Clear validation messages.
*/

function clearAgeError() {
    ageError.textContent = "";
    ageError.hidden = true;
}


/* ================= CALCULATE AND DISPLAY ================= */

function calculateAndDisplayAge() {
    clearAgeError();

    const birthDate = parseLocalDate(
        birthDateInput.value
    );

    const endDate = parseLocalDate(
        ageAsOfInput.value
    );


    // Validate the birth date.
    if (!birthDate) {
        showAgeError(
            "Please enter a valid date of birth."
        );

        birthDateInput.focus();
        return;
    }


    // Validate the calculation date.
    if (!endDate) {
        showAgeError(
            "Please select a valid date for calculating your age."
        );

        ageAsOfInput.focus();
        return;
    }


    // A person cannot have a negative calendar age.
    if (birthDate > endDate) {
        showAgeError(
            "The date of birth cannot be later than the calculation date."
        );

        birthDateInput.focus();
        return;
    }


    // Calculate the calendar age.
    const age = calculateCalendarAge(
        birthDate,
        endDate
    );


    // Calculate the total elapsed calendar days.
    const totalDays = getDaysBetween(
        birthDate,
        endDate
    );

    const totalWeeks = Math.floor(
        totalDays / 7
    );

    const remainingWeeksDays = totalDays % 7;


    /*
       Total calendar months:
       Completed years × 12 + remaining months.
    */

    const totalMonths =
        age.years * 12 + age.months;


    // Birthday information.
    const lastBirthday = getLastBirthday(
        birthDate,
        endDate
    );

    const nextBirthday = getNextBirthday(
        birthDate,
        endDate
    );

    const daysSinceBirthday = getDaysBetween(
        lastBirthday,
        endDate
    );

    const daysUntilBirthday = getDaysBetween(
        endDate,
        nextBirthday
    );


    /* ---------- Primary Age ---------- */

    document.getElementById(
        "resultYears"
    ).textContent = formatNumber(age.years);

    document.getElementById(
        "resultMonths"
    ).textContent = formatNumber(age.months);

    document.getElementById(
        "resultDays"
    ).textContent = formatNumber(age.days);


    document.getElementById(
        "resultDateRange"
    ).textContent =
        `${formatDisplayDate(birthDate)} to ` +
        `${formatDisplayDate(endDate)}`;


    /* ---------- Total Age ---------- */

    document.getElementById(
        "resultTotalMonths"
    ).textContent = formatNumber(totalMonths);

    document.getElementById(
        "resultTotalWeeks"
    ).textContent = formatNumber(totalWeeks);

    document.getElementById(
        "resultTotalDays"
    ).textContent = formatNumber(totalDays);


    /* ---------- Birthday Countdown ---------- */

    document.getElementById(
        "nextBirthdayTitle"
    ).textContent =
        `Next birthday: ${formatDisplayDate(nextBirthday)}`;


    document.getElementById(
        "nextBirthdayMessage"
    ).textContent =
        daysUntilBirthday === 1
            ? "Your next birthday is tomorrow."
            : `Your next birthday is ${formatNumber(daysUntilBirthday)} days away.`;


    document.getElementById(
        "nextBirthdayDays"
    ).textContent = formatNumber(daysUntilBirthday);


    /* ---------- Calculation Details ---------- */

    document.getElementById(
        "detailBirthDate"
    ).textContent = formatDisplayDate(birthDate);

    document.getElementById(
        "detailAsOfDate"
    ).textContent = formatDisplayDate(endDate);

    document.getElementById(
        "detailLastBirthday"
    ).textContent = formatDisplayDate(lastBirthday);

    document.getElementById(
        "detailNextBirthday"
    ).textContent = formatDisplayDate(nextBirthday);


    document.getElementById(
        "detailDaysSinceBirthday"
    ).textContent =
        `${formatNumber(daysSinceBirthday)} ` +
        pluralize(daysSinceBirthday, "day", "days");


    /*
       Keep the additional total-weeks remainder
       available for copying and accessibility.
    */

    ageResults.dataset.remainingWeekDays =
        String(remainingWeeksDays);


    // Reveal the results after all calculations succeed.
    ageResults.hidden = false;

    ageCopyMessage.textContent = "";


    // Scroll results into view on smaller screens.
    if (window.innerWidth <= 600) {
        ageResults.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


/* ================= FORM SUBMISSION ================= */

ageForm.addEventListener("submit", function (event) {
    event.preventDefault();

    calculateAndDisplayAge();
});


/* ================= AUTOMATIC CALCULATION ================= */

/*
   Recalculate when the user changes either date.
   Do not display an error before the first calculation.
*/

let hasCalculatedAge = false;


ageForm.addEventListener("submit", function () {
    hasCalculatedAge = true;
});


birthDateInput.addEventListener("change", function () {
    if (hasCalculatedAge) {
        calculateAndDisplayAge();
    }
});


ageAsOfInput.addEventListener("change", function () {
    if (hasCalculatedAge) {
        calculateAndDisplayAge();
    }
});


/* ================= RESET ================= */

ageResetButton.addEventListener("click", function () {
    ageForm.reset();

    const today = getToday();

    ageAsOfInput.value = formatDateInput(today);

    birthDateInput.value = "";

    clearAgeError();

    ageResults.hidden = true;

    ageCopyMessage.textContent = "";

    hasCalculatedAge = false;

    birthDateInput.focus();
});


/* ================= COPY RESULTS ================= */

function buildAgeResultText() {
    const years = document.getElementById(
        "resultYears"
    ).textContent;

    const months = document.getElementById(
        "resultMonths"
    ).textContent;

    const days = document.getElementById(
        "resultDays"
    ).textContent;

    const totalMonths = document.getElementById(
        "resultTotalMonths"
    ).textContent;

    const totalWeeks = document.getElementById(
        "resultTotalWeeks"
    ).textContent;

    const totalDays = document.getElementById(
        "resultTotalDays"
    ).textContent;

    const birthdayDate = document.getElementById(
        "detailNextBirthday"
    ).textContent;

    const birthdayDays = document.getElementById(
        "nextBirthdayDays"
    ).textContent;

    const weekRemainder =
        ageResults.dataset.remainingWeekDays || "0";


    return [
        "DigiiFox Age Calculator",
        "-----------------------",
        `Date of Birth: ${formatDisplayDate(parseLocalDate(birthDateInput.value))}`,
        `Calculated As Of: ${formatDisplayDate(parseLocalDate(ageAsOfInput.value))}`,
        "",
        `Exact Age: ${years} years, ${months} months, ${days} days`,
        `Total Months: ${totalMonths}`,
        `Total Weeks: ${totalWeeks} weeks and ${weekRemainder} days`,
        `Total Days: ${totalDays}`,
        "",
        `Next Birthday: ${birthdayDate}`,
        `Days Until Next Birthday: ${birthdayDays}`,
        "",
        "Calculated locally by DigiiFox."
    ].join("\n");
}


/*
   Clipboard API is preferred. A fallback is provided
   for browsers where the Clipboard API is unavailable.
*/

async function copyTextToClipboard(text) {
    if (
        navigator.clipboard &&
        window.isSecureContext
    ) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const temporaryTextArea = document.createElement(
        "textarea"
    );

    temporaryTextArea.value = text;

    temporaryTextArea.setAttribute(
        "readonly",
        ""
    );

    temporaryTextArea.style.position = "fixed";
    temporaryTextArea.style.left = "-9999px";
    temporaryTextArea.style.top = "0";

    document.body.appendChild(temporaryTextArea);

    temporaryTextArea.select();

    const copied = document.execCommand("copy");

    temporaryTextArea.remove();

    if (!copied) {
        throw new Error("Clipboard copy was unsuccessful.");
    }
}


ageCopyButton.addEventListener("click", async function () {
    if (ageResults.hidden) {
        return;
    }

    ageCopyMessage.textContent = "";

    try {
        const resultText = buildAgeResultText();

        await copyTextToClipboard(resultText);

        ageCopyMessage.textContent =
            "Your age results have been copied successfully.";

    } catch (error) {
        ageCopyMessage.textContent =
            "Copying was unavailable. Please select and copy the results manually.";
    }
});


/* ================= MOBILE NAVIGATION ================= */

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");


if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", function () {
        const isExpanded =
            menuToggle.getAttribute("aria-expanded") === "true";

        menuToggle.setAttribute(
            "aria-expanded",
            String(!isExpanded)
        );

        mainNav.classList.toggle("active");

        menuToggle.setAttribute(
            "aria-label",
            isExpanded ? "Open navigation" : "Close navigation"
        );
    });


    // Close the mobile navigation after choosing a link.
    mainNav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            mainNav.classList.remove("active");

            menuToggle.setAttribute(
                "aria-expanded",
                "false"
            );

            menuToggle.setAttribute(
                "aria-label",
                "Open navigation"
            );
        });
    });
}


/* ================= FOOTER YEAR ================= */

const currentYearElement = document.getElementById(
    "currentYear"
);

if (currentYearElement) {
    currentYearElement.textContent =
        new Date().getFullYear();
}


/* ================= INITIAL SETUP ================= */

(function initializeAgeCalculator() {
    const today = getToday();

    const todayValue = formatDateInput(today);

    /*
       Restrict the end date to today or earlier.
       The user can still select any past date.
    */

    ageAsOfInput.max = todayValue;

    /*
       Future dates of birth are invalid for an
       ordinary age calculation as of today.
    */

    birthDateInput.max = todayValue;

    /*
       Default the calculation date to today.
       Leave the birth date empty until the user
       chooses a date.
    */

    ageAsOfInput.value = todayValue;

    ageResults.hidden = true;

    clearAgeError();
})();