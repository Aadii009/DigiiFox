/* =========================================
   DIGIIFOX — BODY FAT CALCULATOR
   U.S. Navy circumference method
   All calculations run in the browser.
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bodyFatForm");

    if (!form) return;

    const unitRadios = document.querySelectorAll(
        'input[name="bfUnitSystem"]'
    );

    const sexInput = document.getElementById("bfSex");
    const heightInput = document.getElementById("bfHeight");
    const weightInput = document.getElementById("bfWeight");
    const neckInput = document.getElementById("bfNeck");
    const waistInput = document.getElementById("bfWaist");
    const hipInput = document.getElementById("bfHip");

    const hipGroup = document.getElementById("bfHipGroup");
    const errorBox = document.getElementById("bfError");
    const resultsPanel = document.getElementById("bfResults");

    const resetButton = document.getElementById("bfReset");
    const copyButton = document.getElementById("bfCopy");
    const copyMessage = document.getElementById("bfCopyMessage");

    const heightLabel = document.getElementById("bfHeightLabel");
    const weightLabel = document.getElementById("bfWeightLabel");
    const neckLabel = document.getElementById("bfNeckLabel");
    const waistLabel = document.getElementById("bfWaistLabel");
    const waistHelp = document.getElementById("bfWaistHelp");
    const hipLabel = document.getElementById("bfHipLabel");

    const KG_TO_LB = 2.2046226218;
    const CM_PER_INCH = 2.54;

    let lastResults = null;

    function getUnitSystem() {
        const selected = document.querySelector(
            'input[name="bfUnitSystem"]:checked'
        );

        return selected ? selected.value : "metric";
    }

    function isMetric() {
        return getUnitSystem() === "metric";
    }

    function formatNumber(value, decimals = 1) {
        return Number(value).toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
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

    function updateUnitLabels() {
        const unit = isMetric() ? "cm" : "in";
        const weightUnit = isMetric() ? "kg" : "lb";

        heightLabel.textContent = `Height (${unit})`;
        weightLabel.textContent = `Weight (${weightUnit})`;
        neckLabel.textContent = `Neck circumference (${unit})`;

        updateSexFields();

        clearError();
        hideResults();
    }

    function updateSexFields() {
        const sex = sexInput.value;
        const unit = isMetric() ? "cm" : "in";

        hipGroup.hidden = sex !== "female";
        hipInput.required = sex === "female";

        if (sex === "female") {
            waistLabel.textContent = `Waist circumference (${unit})`;

            waistHelp.textContent =
                "Measure your waist horizontally at the level specified by your chosen measurement protocol.";

            hipLabel.textContent = `Hip circumference (${unit})`;
        } else {
            waistLabel.textContent = `Abdomen circumference (${unit})`;

            waistHelp.textContent =
                "Measure around the abdomen at approximately navel level, keeping the tape horizontal.";
        }
    }

    function readNumber(input, label) {
        const raw = input.value.trim();

        if (raw === "") {
            throw new Error(`Please enter ${label.toLowerCase()}.`);
        }

        const value = Number(raw);

        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`Enter a valid positive value for ${label.toLowerCase()}.`);
        }

        return value;
    }

    function getMeasurements() {
        const metric = isMetric();
        const sex = sexInput.value;

        let height = readNumber(heightInput, "height");
        let weight = readNumber(weightInput, "weight");
        let neck = readNumber(neckInput, "neck circumference");
        let waist = readNumber(waistInput, "abdomen circumference");

        let hip = null;

        if (sex === "female") {
            hip = readNumber(hipInput, "hip circumference");
        }

        // Convert metric inputs to inches and kilograms.
        const heightIn = metric ? height / CM_PER_INCH : height;
        const neckIn = metric ? neck / CM_PER_INCH : neck;
        const waistIn = metric ? waist / CM_PER_INCH : waist;
        const hipIn = hip === null
            ? null
            : (metric ? hip / CM_PER_INCH : hip);

        const weightKg = metric ? weight : weight / KG_TO_LB;

        // Basic plausible input ranges.
        if (heightIn < 39.37 || heightIn > 98.43) {
            throw new Error(
                metric
                    ? "Enter a height between 100 cm and 250 cm."
                    : "Enter a height between 39.4 inches and 98.4 inches."
            );
        }

        if (weightKg < 20 || weightKg > 500) {
            throw new Error(
                metric
                    ? "Enter a weight between 20 kg and 500 kg."
                    : "Enter a weight between 44 lb and 1,102 lb."
            );
        }

        if (neckIn < 5.9 || neckIn > 39.4) {
            throw new Error("Check your neck circumference measurement.");
        }

        if (waistIn < 11.8 || waistIn > 98.4) {
            throw new Error("Check your abdomen or waist circumference measurement.");
        }

        if (sex === "female" && (hipIn < 15.7 || hipIn > 98.4)) {
            throw new Error("Check your hip circumference measurement.");
        }

        if (sex === "male" && waistIn <= neckIn) {
            throw new Error(
                "Abdomen circumference must be greater than neck circumference for this formula."
            );
        }

        if (sex === "female" && waistIn + hipIn <= neckIn) {
            throw new Error(
                "Check your waist, hip, and neck measurements. Their values do not form a valid input for this formula."
            );
        }

        return {
            sex,
            heightIn,
            weightKg,
            neckIn,
            waistIn,
            hipIn,
            heightDisplay: height,
            weightDisplay: weight,
            weightUnit: metric ? "kg" : "lb",
            heightUnit: metric ? "cm" : "in"
        };
    }

    /*
       U.S. Navy circumference equations.

       Male reference:
       86.010 * log10(abdomen - neck)
       - 70.041 * log10(height) + 36.76

       Female reference:
       163.205 * log10(waist + hip - neck)
       - 97.684 * log10(height) - 78.387

       All lengths in the equations are inches.
    */

    function calculateBodyFat(measurements) {
        const {
            sex,
            heightIn,
            neckIn,
            waistIn,
            hipIn
        } = measurements;

        let bodyFat;

        if (sex === "male") {
            const difference = waistIn - neckIn;

            bodyFat =
                86.010 * Math.log10(difference) -
                70.041 * Math.log10(heightIn) +
                36.76;
        } else {
            const measurementSum = waistIn + hipIn - neckIn;

            bodyFat =
                163.205 * Math.log10(measurementSum) -
                97.684 * Math.log10(heightIn) -
                78.387;
        }

        if (!Number.isFinite(bodyFat)) {
            throw new Error(
                "Unable to calculate an estimate. Please check your measurements."
            );
        }

        // Do not silently clamp extreme results to an arbitrary percentage.
        if (bodyFat <= 0 || bodyFat >= 75) {
            throw new Error(
                "The entered measurements produced an implausible estimate. Please recheck your measurements and tape placement."
            );
        }

        return bodyFat;
    }

    function renderResults(measurements, bodyFat) {
        const weightKg = measurements.weightKg;

        const fatMassKg = weightKg * bodyFat / 100;
        const fatFreeMassKg = weightKg - fatMassKg;

        const metric = isMetric();

        const fatMass = metric ? fatMassKg : fatMassKg * KG_TO_LB;
        const fatFreeMass = metric
            ? fatFreeMassKg
            : fatFreeMassKg * KG_TO_LB;

        const weightUnit = metric ? "kg" : "lb";

        document.getElementById("bfPercentage").textContent =
            formatNumber(bodyFat, 1);

        document.getElementById("bfFatMass").textContent =
            `${formatNumber(fatMass)} ${weightUnit}`;

        document.getElementById("bfLeanMass").textContent =
            `${formatNumber(fatFreeMass)} ${weightUnit}`;

        document.getElementById("bfBarCaption").textContent =
            `${formatNumber(bodyFat)}% fat`;

        document.getElementById("bfFatSegment").style.width =
            `${bodyFat}%`;

        document.getElementById("bfLeanSegment").style.width =
            `${100 - bodyFat}%`;

        document.getElementById("bfCompositionBar").setAttribute(
            "aria-label",
            `Estimated composition: ${formatNumber(bodyFat)} percent fat and ${formatNumber(100 - bodyFat)} percent fat-free mass`
        );

        document.getElementById("bfReference").textContent =
            measurements.sex === "male"
                ? "Male reference"
                : "Female reference";

        document.getElementById("bfDetailHeight").textContent =
            `${formatNumber(measurements.heightDisplay)} ${measurements.heightUnit}`;

        document.getElementById("bfDetailWeight").textContent =
            `${formatNumber(measurements.weightDisplay)} ${weightUnit}`;

        lastResults = {
            measurements,
            bodyFat,
            fatMass,
            fatFreeMass,
            weightUnit
        };

        resultsPanel.hidden = false;
        copyMessage.textContent = "";
    }

    function calculate(event) {
        event.preventDefault();

        clearError();
        copyMessage.textContent = "";

        try {
            const measurements = getMeasurements();
            const bodyFat = calculateBodyFat(measurements);

            renderResults(measurements, bodyFat);
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
        const m = result.measurements;

        const textToCopy = [
            "DigiiFox — Body Fat Calculator",
            `Formula: U.S. Navy circumference method (${m.sex} reference)`,
            `Height: ${formatNumber(m.heightDisplay)} ${m.heightUnit}`,
            `Weight: ${formatNumber(m.weightDisplay)} ${result.weightUnit}`,
            `Estimated body fat: ${formatNumber(result.bodyFat)}%`,
            `Estimated fat mass: ${formatNumber(result.fatMass)} ${result.weightUnit}`,
            `Estimated fat-free mass: ${formatNumber(result.fatFreeMass)} ${result.weightUnit}`,
            "",
            "These are estimates, not direct measurements or medical advice."
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
                    throw new Error("Copy failed");
                }
            }

            copyMessage.textContent = "Results copied successfully.";
        } catch {
            copyMessage.textContent =
                "Unable to copy automatically. Please copy the results manually.";
        }
    }

    // Form events
    form.addEventListener("submit", calculate);

    unitRadios.forEach(radio => {
        radio.addEventListener("change", updateUnitLabels);
    });

    sexInput.addEventListener("change", () => {
        updateSexFields();
        clearError();
        hideResults();
    });

    resetButton.addEventListener("click", () => {
        window.setTimeout(() => {
            updateUnitLabels();
            clearError();
            hideResults();
        }, 0);
    });

    copyButton.addEventListener("click", copyResults);

    // Hide stale results when a measurement changes.
    [
        heightInput,
        weightInput,
        neckInput,
        waistInput,
        hipInput
    ].forEach(input => {
        input.addEventListener("input", () => {
            hideResults();
            clearError();
        });
    });

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

    // Initial setup
    updateUnitLabels();
});