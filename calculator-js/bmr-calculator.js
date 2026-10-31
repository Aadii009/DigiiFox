/* =========================================
   DIGIIFOX BMR CALCULATOR
   Formula: Mifflin–St Jeor
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bmrForm");
    const results = document.getElementById("bmrResults");
    const errorBox = document.getElementById("bmrError");

    const metricHeightGroup = document.getElementById("bmrMetricHeightGroup");
    const imperialHeightGroup = document.getElementById("bmrImperialHeightGroup");

    const heightCmInput = document.getElementById("bmrHeightCm");
    const heightFtInput = document.getElementById("bmrHeightFt");
    const heightInInput = document.getElementById("bmrHeightIn");

    const weightInput = document.getElementById("bmrWeight");
    const weightUnitSelect = document.getElementById("bmrWeightUnit");

    const ageInput = document.getElementById("bmrAge");
    const sexInput = document.getElementById("bmrSex");
    const activityInput = document.getElementById("bmrActivity");

    const resetButton = document.getElementById("bmrReset");
    const copyButton = document.getElementById("bmrCopy");
    const copyMessage = document.getElementById("bmrCopyMessage");

    const numberFormatter = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0
    });

    const decimalFormatter = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 1
    });

    let lastResultText = "";

    // -----------------------------------------
    // Shared site functionality
    // -----------------------------------------

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("active");

            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });
    }

    // -----------------------------------------
    // Unit selection
    // -----------------------------------------

    function getUnitSystem() {
        const selected = document.querySelector(
            'input[name="bmrUnitSystem"]:checked'
        );

        return selected ? selected.value : "metric";
    }

    function updateUnitSystem() {
        const system = getUnitSystem();
        const isMetric = system === "metric";

        metricHeightGroup.hidden = !isMetric;
        imperialHeightGroup.hidden = isMetric;

        heightCmInput.disabled = !isMetric;
        heightFtInput.disabled = isMetric;
        heightInInput.disabled = isMetric;

        heightCmInput.required = isMetric;
        heightFtInput.required = !isMetric;
        heightInInput.required = !isMetric;

        heightCmInput.setAttribute("aria-hidden", String(!isMetric));
        heightFtInput.setAttribute("aria-hidden", String(isMetric));
        heightInInput.setAttribute("aria-hidden", String(isMetric));

        weightUnitSelect.value = isMetric ? "kg" : "lb";

        clearError();
    }

    document.querySelectorAll('input[name="bmrUnitSystem"]').forEach(input => {
        input.addEventListener("change", updateUnitSystem);
    });

    // -----------------------------------------
    // Error and result helpers
    // -----------------------------------------

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        results.hidden = true;
        copyMessage.textContent = "";
    }

    function clearError() {
        errorBox.textContent = "";
        errorBox.hidden = true;
    }

    function formatNumber(value) {
        return numberFormatter.format(value);
    }

    function formatDecimal(value) {
        return decimalFormatter.format(value);
    }

    // -----------------------------------------
    // Read and validate user input
    // -----------------------------------------

    function getMeasurements() {
        const age = Number(ageInput.value);
        const weight = Number(weightInput.value);
        const system = getUnitSystem();

        if (
            ageInput.value.trim() === "" ||
            !Number.isFinite(age) ||
            !Number.isInteger(age) ||
            age < 18 ||
            age > 120
        ) {
            throw new Error(
                "Please enter a whole-number age between 18 and 120 years."
            );
        }

        if (
            weightInput.value.trim() === "" ||
            !Number.isFinite(weight) ||
            weight <= 0
        ) {
            throw new Error("Please enter a valid weight greater than zero.");
        }

        let weightKg;

        if (system === "metric") {
            if (weight < 20 || weight > 500) {
                throw new Error(
                    "For this calculator, metric weight must be between 20 and 500 kg."
                );
            }

            if (weightUnitSelect.value !== "kg") {
                throw new Error(
                    "Please use kilograms when metric units are selected."
                );
            }

            weightKg = weight;
        } else {
            if (weight < 44 || weight > 1102.31) {
                throw new Error(
                    "For this calculator, imperial weight must be between 44 and 1102.31 lb."
                );
            }

            if (weightUnitSelect.value !== "lb") {
                throw new Error(
                    "Please use pounds when imperial units are selected."
                );
            }

            weightKg = weight * 0.45359237;
        }

        let heightCm;
        let heightDescription;

        if (system === "metric") {
            const height = Number(heightCmInput.value);

            if (
                heightCmInput.value.trim() === "" ||
                !Number.isFinite(height) ||
                height < 80 ||
                height > 250
            ) {
                throw new Error(
                    "Please enter a height between 80 and 250 cm."
                );
            }

            heightCm = height;
            heightDescription = `${formatDecimal(height)} cm`;
        } else {
            const feetText = heightFtInput.value.trim();
            const inchesText = heightInInput.value.trim();

            const feet = Number(feetText);
            const inches = Number(inchesText);

            if (
                feetText === "" ||
                inchesText === "" ||
                !Number.isFinite(feet) ||
                !Number.isFinite(inches) ||
                !Number.isInteger(feet) ||
                feet < 2 ||
                feet > 8 ||
                inches < 0 ||
                inches >= 12
            ) {
                throw new Error(
                    "Please enter valid height values: feet from 2 to 8 and inches from 0 up to, but not including, 12."
                );
            }

            const totalInches = (feet * 12) + inches;

            if (totalInches < 31.5 || totalInches > 98.43) {
                throw new Error(
                    "Please enter a realistic height within the calculator's supported range."
                );
            }

            heightCm = totalInches * 2.54;
            heightDescription =
                `${feet} ft ${formatDecimal(inches)} in`;
        }

        return {
            age,
            weightKg,
            heightCm,
            heightDescription,
            system,
            originalWeight: weight,
            weightDescription: `${formatDecimal(weight)} ${weightUnitSelect.value}`
        };
    }

    // -----------------------------------------
    // Mifflin–St Jeor calculation
    //
    // Male:
    // BMR = 10W + 6.25H - 5A + 5
    //
    // Female:
    // BMR = 10W + 6.25H - 5A - 161
    //
    // W = weight in kg
    // H = height in cm
    // A = age in years
    // -----------------------------------------

    function calculateBMR(data) {
        const weightTerm = 10 * data.weightKg;
        const heightTerm = 6.25 * data.heightCm;
        const ageTerm = 5 * data.age;

        const coefficient = sexInput.value === "male" ? 5 : -161;

        const bmr =
            weightTerm +
            heightTerm -
            ageTerm +
            coefficient;

        const activityFactor = Number(activityInput.value);
        const dailyCalories = bmr * activityFactor;

        return {
            bmr,
            dailyCalories,
            activityFactor,
            weightTerm,
            heightTerm,
            ageTerm,
            coefficient
        };
    }

    // -----------------------------------------
    // Display the calculation
    // -----------------------------------------

    function displayResults(data, calculation) {
        document.getElementById("bmrScore").textContent =
            formatNumber(calculation.bmr);

        document.getElementById("bmrDailyCalories").textContent =
            formatNumber(calculation.dailyCalories);

        document.getElementById("bmrDetailAge").textContent =
            `${data.age} years`;

        document.getElementById("bmrDetailHeight").textContent =
            data.heightDescription;

        document.getElementById("bmrDetailWeight").textContent =
            data.weightDescription;

        document.getElementById("bmrDetailActivity").textContent =
            `${calculation.activityFactor}×`;

        const equationName =
            sexInput.value === "male"
                ? "Male equation"
                : "Female equation";

        const coefficientText =
            calculation.coefficient > 0
                ? `+ ${calculation.coefficient}`
                : `− ${Math.abs(calculation.coefficient)}`;

        const formulaText =
            `BMR = (10 × ${formatDecimal(data.weightKg)}) + ` +
            `(6.25 × ${formatDecimal(data.heightCm)}) − ` +
            `(5 × ${data.age}) ${coefficientText}`;

        document.getElementById("bmrCalculation").textContent =
            `${equationName}: ${formulaText}. ` +
            `Estimated BMR = ${formatNumber(calculation.bmr)} kcal/day. ` +
            `Daily calorie estimate = ${formatNumber(calculation.bmr)} × ` +
            `${calculation.activityFactor} = ` +
            `${formatNumber(calculation.dailyCalories)} kcal/day.`;

        lastResultText =
            "DigiiFox BMR Calculator Results\n" +
            `Equation: ${equationName}\n` +
            `Age: ${data.age} years\n` +
            `Height: ${data.heightDescription}\n` +
            `Weight: ${data.weightDescription}\n` +
            `Estimated BMR: ${formatNumber(calculation.bmr)} kcal/day\n` +
            `Activity factor: ${calculation.activityFactor}\n` +
            `Estimated daily calories: ${formatNumber(calculation.dailyCalories)} kcal/day\n` +
            "Formula: Mifflin–St Jeor equation\n" +
            "Note: These figures are estimates, not individualized medical advice.";

        results.hidden = false;
        clearError();
        copyMessage.textContent = "";

        // Move the result into view on smaller screens.
        if (window.matchMedia("(max-width: 900px)").matches) {
            results.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    // -----------------------------------------
    // Form submission
    // -----------------------------------------

    form.addEventListener("submit", event => {
        event.preventDefault();

        try {
            const data = getMeasurements();
            const calculation = calculateBMR(data);

            if (
                !Number.isFinite(calculation.bmr) ||
                !Number.isFinite(calculation.dailyCalories) ||
                calculation.bmr <= 0
            ) {
                throw new Error(
                    "Unable to calculate a valid result. Please check your details."
                );
            }

            displayResults(data, calculation);
        } catch (error) {
            showError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please check your entries."
            );
        }
    });

    // -----------------------------------------
    // Reset form
    // -----------------------------------------

    resetButton.addEventListener("click", () => {
        // The reset event fires after the default form reset.
        setTimeout(() => {
            updateUnitSystem();
            results.hidden = true;
            clearError();
            copyMessage.textContent = "";
            lastResultText = "";
        }, 0);
    });

    form.addEventListener("reset", () => {
        setTimeout(() => {
            updateUnitSystem();
        }, 0);
    });

    // -----------------------------------------
    // Copy results
    // -----------------------------------------

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const temporaryTextArea = document.createElement("textarea");

        temporaryTextArea.value = text;
        temporaryTextArea.setAttribute("readonly", "");
        temporaryTextArea.style.position = "fixed";
        temporaryTextArea.style.opacity = "0";
        temporaryTextArea.style.pointerEvents = "none";

        document.body.appendChild(temporaryTextArea);
        temporaryTextArea.select();

        const successful = document.execCommand("copy");

        temporaryTextArea.remove();

        if (!successful) {
            throw new Error("Copy is not supported by this browser.");
        }
    }

    copyButton.addEventListener("click", async () => {
        if (!lastResultText) {
            copyMessage.textContent =
                "Calculate your BMR before copying the results.";
            return;
        }

        try {
            await copyText(lastResultText);
            copyMessage.textContent = "Results copied successfully.";
        } catch {
            copyMessage.textContent =
                "Unable to copy automatically. Please select and copy the result.";
        }
    });

    // -----------------------------------------
    // Initial setup
    // -----------------------------------------

    updateUnitSystem();
});