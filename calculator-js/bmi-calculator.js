/* =========================================
   DIGIIFOX - BMI CALCULATOR
   File: bmi-calculator.js
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("bmiForm");

    if (!form) return;

    const metricRadio = document.querySelector(
        'input[name="bmiUnitSystem"][value="metric"]'
    );

    const imperialRadio = document.querySelector(
        'input[name="bmiUnitSystem"][value="imperial"]'
    );

    const metricHeightGroup = document.getElementById("bmiMetricHeightGroup");
    const imperialHeightGroup = document.getElementById("bmiImperialHeightGroup");

    const heightCmInput = document.getElementById("bmiHeightCm");
    const heightFtInput = document.getElementById("bmiHeightFt");
    const heightInInput = document.getElementById("bmiHeightIn");
    const weightInput = document.getElementById("bmiWeight");
    const weightUnit = document.getElementById("bmiWeightUnit");

    const errorBox = document.getElementById("bmiError");
    const resultsSection = document.getElementById("bmiResults");
    const resetButton = document.getElementById("bmiReset");
    const copyButton = document.getElementById("bmiCopy");
    const copyMessage = document.getElementById("bmiCopyMessage");

    let latestResult = null;

    /* -----------------------------------------
       HELPERS
       ----------------------------------------- */

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function formatNumber(value, maximumFractionDigits = 2) {
        return new Intl.NumberFormat("en-IN", {
            maximumFractionDigits,
            useGrouping: true
        }).format(value);
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
    }

    function clearError() {
        errorBox.textContent = "";
        errorBox.hidden = true;
    }

    function getUnitSystem() {
        return imperialRadio.checked ? "imperial" : "metric";
    }

    function isValidPositiveNumber(value) {
        return Number.isFinite(value) && value > 0;
    }

    function resetResults() {
        latestResult = null;
        resultsSection.hidden = true;
        copyMessage.textContent = "";

        const marker = document.getElementById("bmiScaleMarker");

        if (marker) {
            marker.hidden = true;
        }
    }

    /* -----------------------------------------
       UNIT SWITCHING
       ----------------------------------------- */

    function updateUnitSystem() {
        const system = getUnitSystem();
        const isMetric = system === "metric";

        metricHeightGroup.classList.toggle("bmi-hidden", !isMetric);
        imperialHeightGroup.classList.toggle("bmi-hidden", isMetric);

        heightCmInput.required = isMetric;
        heightFtInput.required = !isMetric;
        heightInInput.required = !isMetric;

        weightUnit.textContent = isMetric ? "kg" : "lb";

        weightInput.min = isMetric ? "1" : "2.2";
        weightInput.max = isMetric ? "700" : "1543.2";

        weightInput.placeholder = isMetric ? "e.g. 65" : "e.g. 143";

        clearError();
        resetResults();
    }

    metricRadio.addEventListener("change", updateUnitSystem);
    imperialRadio.addEventListener("change", updateUnitSystem);

    /* -----------------------------------------
       BMI CATEGORY
       Standard categories for adults aged 20+
       ----------------------------------------- */

    function getBMICategory(bmi) {
        if (bmi < 18.5) {
            return {
                name: "Underweight",
                key: "underweight",
                description:
                    "Your BMI is below the standard healthy-weight range for adults."
            };
        }

        if (bmi < 25) {
            return {
                name: "Healthy weight",
                key: "healthy",
                description:
                    "Your BMI falls within the standard healthy-weight range for adults."
            };
        }

        if (bmi < 30) {
            return {
                name: "Overweight",
                key: "overweight",
                description:
                    "Your BMI falls within the standard adult overweight range."
            };
        }

        if (bmi < 35) {
            return {
                name: "Obesity — Class 1",
                key: "obesity",
                description:
                    "Your BMI falls within the standard adult Class 1 obesity range."
            };
        }

        if (bmi < 40) {
            return {
                name: "Obesity — Class 2",
                key: "obesity",
                description:
                    "Your BMI falls within the standard adult Class 2 obesity range."
            };
        }

        return {
            name: "Obesity — Class 3",
            key: "obesity",
            description:
                "Your BMI falls within the standard adult Class 3 obesity range."
        };
    }

    /* -----------------------------------------
       BMI SCALE MARKER
       The display is divided into four visual
       category sections, not a linear scale.
       ----------------------------------------- */

    function getMarkerPosition(bmi) {
        const first = 1;
        const second = 1.25;
        const third = 1;
        const fourth = 1;

        const total = first + second + third + fourth;

        const firstEnd = (first / total) * 100;
        const secondEnd = ((first + second) / total) * 100;
        const thirdEnd = ((first + second + third) / total) * 100;

        if (bmi < 18.5) {
            const fraction = Math.max(0, Math.min(1, (bmi - 10) / 8.5));
            return fraction * firstEnd;
        }

        if (bmi < 25) {
            const fraction = (bmi - 18.5) / (25 - 18.5);
            return firstEnd + fraction * (secondEnd - firstEnd);
        }

        if (bmi < 30) {
            const fraction = (bmi - 25) / 5;
            return secondEnd + fraction * (thirdEnd - secondEnd);
        }

        // The upper category has no finite maximum.
        // Cap the indicator position for display purposes.
        const fraction = Math.max(0, Math.min(1, (bmi - 30) / 15));
        return thirdEnd + fraction * (100 - thirdEnd);
    }

    function updateScale(bmi) {
        const marker = document.getElementById("bmiScaleMarker");
        const markerLabel = document.getElementById("bmiMarkerLabel");

        const position = Math.max(1, Math.min(99, getMarkerPosition(bmi)));

        marker.style.left = `${position}%`;
        marker.hidden = false;

        markerLabel.textContent = `BMI ${formatNumber(bmi, 1)}`;
    }

    /* -----------------------------------------
       READ AND VALIDATE INPUTS
       ----------------------------------------- */

    function getMeasurements() {
        const system = getUnitSystem();
        const weightValue = Number(weightInput.value);

        if (
            weightInput.value.trim() === "" ||
            !isValidPositiveNumber(weightValue)
        ) {
            return {
                error: "Please enter a valid weight greater than zero."
            };
        }

        let heightMetres;
        let heightDescription;
        let weightKg;
        let weightDescription;

        if (system === "metric") {
            const heightCm = Number(heightCmInput.value);

            if (
                heightCmInput.value.trim() === "" ||
                !isValidPositiveNumber(heightCm)
            ) {
                return {
                    error: "Please enter a valid height in centimetres."
                };
            }

            if (heightCm < 50 || heightCm > 300) {
                return {
                    error: "Please enter a height between 50 cm and 300 cm."
                };
            }

            if (weightValue < 1 || weightValue > 700) {
                return {
                    error: "Please enter a weight between 1 kg and 700 kg."
                };
            }

            heightMetres = heightCm / 100;
            heightDescription = `${formatNumber(heightCm, 2)} cm`;
            weightKg = weightValue;
            weightDescription = `${formatNumber(weightValue, 2)} kg`;
        } else {
            const feetValue = heightFtInput.value.trim();
            const inchesValue = heightInInput.value.trim();

            if (feetValue === "" || inchesValue === "") {
                return {
                    error: "Please enter your height in both feet and inches."
                };
            }

            const feet = Number(feetValue);
            const inches = Number(inchesValue);

            if (
                !Number.isFinite(feet) ||
                !Number.isFinite(inches) ||
                !Number.isInteger(feet) ||
                feet < 1 ||
                feet > 9 ||
                inches < 0 ||
                inches >= 12
            ) {
                return {
                    error: "Enter valid height values: feet from 1 to 9 and inches from 0 to less than 12."
                };
            }

            const totalInches = feet * 12 + inches;

            if (totalInches < 20 || totalInches > 118) {
                return {
                    error: "Please enter a realistic height between 20 and 118 inches."
                };
            }

            if (weightValue < 2.2 || weightValue > 1543.2) {
                return {
                    error: "Please enter a weight between 2.2 lb and 1,543.2 lb."
                };
            }

            heightMetres = totalInches * 0.0254;
            heightDescription =
                `${feet} ft ${formatNumber(inches, 2)} in`;

            weightKg = weightValue * 0.45359237;
            weightDescription = `${formatNumber(weightValue, 2)} lb`;
        }

        if (!Number.isFinite(heightMetres) || heightMetres <= 0) {
            return { error: "Please enter a valid height." };
        }

        if (!Number.isFinite(weightKg) || weightKg <= 0) {
            return { error: "Please enter a valid weight." };
        }

        return {
            system,
            heightMetres,
            heightDescription,
            weightKg,
            weightDescription,
            enteredWeight: weightValue
        };
    }

    /* -----------------------------------------
       CALCULATE AND DISPLAY BMI
       ----------------------------------------- */

    function calculateBMI(event) {
        if (event) {
            event.preventDefault();
        }

        clearError();
        copyMessage.textContent = "";

        const measurements = getMeasurements();

        if (measurements.error) {
            showError(measurements.error);
            resetResults();
            return;
        }

        const {
            system,
            heightMetres,
            heightDescription,
            weightKg,
            weightDescription,
            enteredWeight
        } = measurements;

        // BMI = weight in kilograms / height in metres squared.
        const bmi = weightKg / (heightMetres * heightMetres);

        if (!Number.isFinite(bmi) || bmi <= 0) {
            showError("We could not calculate your BMI. Please check your inputs.");
            resetResults();
            return;
        }

        const roundedBMI = Number(bmi.toFixed(1));
        const category = getBMICategory(bmi);

        setText("bmiScore", formatNumber(roundedBMI, 1));
        setText("bmiCategory", category.name);
        setText("bmiCategoryDescription", category.description);

        const badge = document.getElementById("bmiCategory");
        badge.dataset.category = category.key;

        setText("bmiDetailHeight", heightDescription);
        setText("bmiDetailWeight", weightDescription);

        if (system === "metric") {
            setText("bmiDetailFormula", "Weight (kg) ÷ Height (m)²");

            setText(
                "bmiDetailCalculation",
                `${formatNumber(weightKg, 2)} ÷ (${formatNumber(heightMetres, 3)} × ${formatNumber(heightMetres, 3)})`
            );
        } else {
            const totalInches =
                heightMetres / 0.0254;

            setText("bmiDetailFormula", "703 × Weight (lb) ÷ Height (in)²");

            setText(
                "bmiDetailCalculation",
                `703 × ${formatNumber(enteredWeight, 2)} ÷ (${formatNumber(totalInches, 2)} × ${formatNumber(totalInches, 2)})`
            );
        }

        updateScale(bmi);

        latestResult = {
            bmi: roundedBMI,
            category: category.name,
            height: heightDescription,
            weight: weightDescription,
            formula: system === "metric"
                ? "Weight (kg) ÷ Height (m)²"
                : "703 × Weight (lb) ÷ Height (in)²"
        };

        resultsSection.hidden = false;
    }

    form.addEventListener("submit", calculateBMI);

    /* -----------------------------------------
       RESET
       ----------------------------------------- */

    resetButton.addEventListener("click", () => {
        form.reset();

        updateUnitSystem();
        clearError();
        resetResults();
    });

    /* -----------------------------------------
       COPY RESULT
       ----------------------------------------- */

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const temporaryInput = document.createElement("textarea");

        temporaryInput.value = text;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.left = "-9999px";
        temporaryInput.style.top = "0";

        document.body.appendChild(temporaryInput);
        temporaryInput.select();

        const copied = document.execCommand("copy");

        temporaryInput.remove();

        if (!copied) {
            throw new Error("Copy command was unsuccessful.");
        }
    }

    copyButton.addEventListener("click", async () => {
        if (!latestResult) {
            copyMessage.textContent = "Calculate your BMI first.";
            return;
        }

        const resultText = [
            "DigiiFox - BMI Calculator",
            `BMI: ${latestResult.bmi} kg/m²`,
            `Adult BMI category: ${latestResult.category}`,
            `Height: ${latestResult.height}`,
            `Weight: ${latestResult.weight}`,
            `Formula: ${latestResult.formula}`,
            "",
            "BMI is a screening measure, not a diagnosis."
        ].join("\n");

        try {
            await copyText(resultText);
            copyMessage.textContent = "BMI result copied successfully.";
        } catch (error) {
            copyMessage.textContent =
                "Unable to copy automatically. Please copy the result manually.";
        }
    });

    /* -----------------------------------------
       MOBILE NAVIGATION
       ----------------------------------------- */

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", () => {
            const isOpen = mainNav.classList.toggle("active");

            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });

        mainNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                mainNav.classList.remove("active");
                menuToggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    /* -----------------------------------------
       FOOTER YEAR
       ----------------------------------------- */

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    // Set initial field visibility and units.
    updateUnitSystem();
});