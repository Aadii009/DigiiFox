/* =========================================
   DIGIIFOX — IDEAL WEIGHT CALCULATOR
   All calculations run locally in browser.
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("idealWeightForm");

    if (!form) return;

    const metricGroup = document.getElementById("iwMetricGroup");
    const imperialGroup = document.getElementById("iwImperialGroup");

    const heightCmInput = document.getElementById("iwHeightCm");
    const heightFtInput = document.getElementById("iwHeightFt");
    const heightInInput = document.getElementById("iwHeightIn");
    const sexInput = document.getElementById("iwSex");

    const errorBox = document.getElementById("iwError");
    const resultsPanel = document.getElementById("iwResults");

    const resetButton = document.getElementById("iwReset");
    const copyButton = document.getElementById("iwCopy");
    const copyMessage = document.getElementById("iwCopyMessage");

    const KG_TO_LB = 2.2046226218;
    const CM_PER_INCH = 2.54;

    let lastResults = null;

    const unitRadios = document.querySelectorAll(
        'input[name="iwUnitSystem"]'
    );

    function getUnitSystem() {
        const selected = document.querySelector(
            'input[name="iwUnitSystem"]:checked'
        );

        return selected ? selected.value : "metric";
    }

    function getUnitLabel() {
        return getUnitSystem() === "metric" ? "kg" : "lb";
    }

    function formatNumber(value, decimals = 1) {
        return value.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function formatWeight(kg) {
        const value = getUnitSystem() === "metric"
            ? kg
            : kg * KG_TO_LB;

        return `${formatNumber(value)} ${getUnitLabel()}`;
    }

    function showError(message) {
        errorBox.textContent = message;
    }

    function clearError() {
        errorBox.textContent = "";
    }

    function hideResults() {
        resultsPanel.hidden = true;
        lastResults = null;
        copyMessage.textContent = "";
    }

    function updateUnitSystem() {
        const system = getUnitSystem();

        metricGroup.hidden = system !== "metric";
        imperialGroup.hidden = system !== "imperial";

        heightCmInput.required = system === "metric";
        heightFtInput.required = system === "imperial";

        clearError();
        hideResults();
    }

    function getHeightInCm() {
        if (getUnitSystem() === "metric") {
            const height = Number(heightCmInput.value);

            if (
                heightCmInput.value.trim() === "" ||
                !Number.isFinite(height) ||
                height < 100 ||
                height > 250
            ) {
                throw new Error(
                    "Enter a height between 100 cm and 250 cm."
                );
            }

            return height;
        }

        const feetText = heightFtInput.value.trim();
        const inchesText = heightInInput.value.trim();

        if (feetText === "") {
            throw new Error("Enter your height in feet.");
        }

        const feet = Number(feetText);
        const inches = inchesText === "" ? 0 : Number(inchesText);

        if (
            !Number.isFinite(feet) ||
            !Number.isFinite(inches) ||
            !Number.isInteger(feet) ||
            feet < 3 ||
            feet > 8 ||
            inches < 0 ||
            inches >= 12
        ) {
            throw new Error(
                "Enter a valid height: feet from 3 to 8 and inches from 0 to less than 12."
            );
        }

        const totalInches = feet * 12 + inches;

        if (totalInches < 36 || totalInches > 96) {
            throw new Error(
                "Enter a total height between 3 feet and 8 feet."
            );
        }

        return totalInches * CM_PER_INCH;
    }

    /*
       Traditional adult reference formulas.

       Height is converted to inches.
       The baseline is 60 inches (5 feet).

       Robinson:
       Male:   52 kg + 1.9 kg per inch above 5 ft
       Female: 49 kg + 1.7 kg per inch above 5 ft

       Miller:
       Male:   56.2 kg + 1.41 kg per inch above 5 ft
       Female: 53.1 kg + 1.36 kg per inch above 5 ft

       Devine:
       Male:   50 kg + 2.3 kg per inch above 5 ft
       Female: 45.5 kg + 2.3 kg per inch above 5 ft

       Hamwi:
       Male:   48 kg + 2.7 kg per inch above 5 ft
       Female: 45.5 kg + 2.2 kg per inch above 5 ft
    */

    function calculateFormulas(heightCm, sex) {
        const heightInches = heightCm / CM_PER_INCH;
        const inchesAboveFiveFeet = heightInches - 60;

        const formulas = sex === "male"
            ? {
                robinson: 52 + 1.9 * inchesAboveFiveFeet,
                miller: 56.2 + 1.41 * inchesAboveFiveFeet,
                devine: 50 + 2.3 * inchesAboveFiveFeet,
                hamwi: 48 + 2.7 * inchesAboveFiveFeet
            }
            : {
                robinson: 49 + 1.7 * inchesAboveFiveFeet,
                miller: 53.1 + 1.36 * inchesAboveFiveFeet,
                devine: 45.5 + 2.3 * inchesAboveFiveFeet,
                hamwi: 45.5 + 2.2 * inchesAboveFiveFeet
            };

        return formulas;
    }

    function updateFormulaDescriptions(sex) {
        const descriptions = sex === "male"
            ? {
                robinson: "Male: 52 kg + 1.9 kg per inch above 5 ft.",
                miller: "Male: 56.2 kg + 1.41 kg per inch above 5 ft.",
                devine: "Male: 50 kg + 2.3 kg per inch above 5 ft.",
                hamwi: "Male: 48 kg + 2.7 kg per inch above 5 ft."
            }
            : {
                robinson: "Female: 49 kg + 1.7 kg per inch above 5 ft.",
                miller: "Female: 53.1 kg + 1.36 kg per inch above 5 ft.",
                devine: "Female: 45.5 kg + 2.3 kg per inch above 5 ft.",
                hamwi: "Female: 45.5 kg + 2.2 kg per inch above 5 ft."
            };

        document.getElementById("iwRobinsonFormula").textContent =
            descriptions.robinson;

        document.getElementById("iwMillerFormula").textContent =
            descriptions.miller;

        document.getElementById("iwDevineFormula").textContent =
            descriptions.devine;

        document.getElementById("iwHamwiFormula").textContent =
            descriptions.hamwi;
    }

    function renderResults(heightCm, formulas) {
        const values = Object.values(formulas);

        const lowest = Math.min(...values);
        const highest = Math.max(...values);

        document.getElementById("iwOverallRange").textContent =
            `${formatNumber(
                getUnitSystem() === "metric"
                    ? lowest
                    : lowest * KG_TO_LB
            )} – ${formatNumber(
                getUnitSystem() === "metric"
                    ? highest
                    : highest * KG_TO_LB
            )}`;

        document.getElementById("iwRangeUnit").textContent =
            getUnitLabel();

        document.getElementById("iwRobinson").textContent =
            formatWeight(formulas.robinson);

        document.getElementById("iwMiller").textContent =
            formatWeight(formulas.miller);

        document.getElementById("iwDevine").textContent =
            formatWeight(formulas.devine);

        document.getElementById("iwHamwi").textContent =
            formatWeight(formulas.hamwi);

        lastResults = {
            heightCm,
            sex: sexInput.value,
            unit: getUnitLabel(),
            formulas,
            lowest,
            highest
        };

        resultsPanel.hidden = false;
        copyMessage.textContent = "";

        updateFormulaDescriptions(sexInput.value);
    }

    function calculateIdealWeight(event) {
        event.preventDefault();

        clearError();
        copyMessage.textContent = "";

        try {
            const heightCm = getHeightInCm();
            const sex = sexInput.value;

            if (!["male", "female"].includes(sex)) {
                throw new Error("Please select a formula reference.");
            }

            const formulas = calculateFormulas(heightCm, sex);

            if (
                Object.values(formulas).some(
                    value => !Number.isFinite(value) || value <= 0
                )
            ) {
                throw new Error(
                    "These formulas cannot provide a meaningful estimate for the entered height."
                );
            }

            renderResults(heightCm, formulas);

        } catch (error) {
            hideResults();
            showError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please check your entries."
            );
        }
    }

    async function copyResults() {
        if (!lastResults) {
            copyMessage.textContent = "Calculate your results first.";
            return;
        }

        const result = lastResults;
        const outputUnit = result.unit;

        const convert = kg => (
            getUnitSystem() === "metric"
                ? kg
                : kg * KG_TO_LB
        );

        const textToCopy = [
            "DigiiFox — Ideal Weight Calculator",
            `Height: ${formatNumber(result.heightCm, 1)} cm`,
            `Formula reference: ${result.sex}`,
            `Estimated range: ${formatNumber(convert(result.lowest))}–${formatNumber(convert(result.highest))} ${outputUnit}`,
            `Robinson: ${formatNumber(convert(result.formulas.robinson))} ${outputUnit}`,
            `Miller: ${formatNumber(convert(result.formulas.miller))} ${outputUnit}`,
            `Devine: ${formatNumber(convert(result.formulas.devine))} ${outputUnit}`,
            `Hamwi: ${formatNumber(convert(result.formulas.hamwi))} ${outputUnit}`,
            "",
            "These are formula-based estimates, not a medical diagnosis or personal treatment recommendation."
        ].join("\n");

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const temporary = document.createElement("textarea");
                temporary.value = textToCopy;
                temporary.setAttribute("readonly", "");
                temporary.style.position = "fixed";
                temporary.style.opacity = "0";

                document.body.appendChild(temporary);
                temporary.select();

                const copied = document.execCommand("copy");
                temporary.remove();

                if (!copied) {
                    throw new Error("Copy command failed");
                }
            }

            copyMessage.textContent = "Results copied successfully.";

        } catch {
            copyMessage.textContent =
                "Unable to copy automatically. Please select and copy the results.";
        }
    }

    form.addEventListener("submit", calculateIdealWeight);

    unitRadios.forEach(radio => {
        radio.addEventListener("change", updateUnitSystem);
    });

    sexInput.addEventListener("change", () => {
        updateFormulaDescriptions(sexInput.value);
        hideResults();
        clearError();
    });

    resetButton.addEventListener("click", () => {
        window.setTimeout(() => {
            updateUnitSystem();
            clearError();
            hideResults();
            updateFormulaDescriptions(sexInput.value);
        }, 0);
    });

    copyButton.addEventListener("click", copyResults);

    // Mobile navigation
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
    }

    // Dynamic footer year
    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    // Initial page setup
    updateUnitSystem();
    updateFormulaDescriptions(sexInput.value);
});