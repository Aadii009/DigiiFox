/* =====================================================
   DIGIIFOX DISCOUNT CALCULATOR
   Features:
   1. Sale price and discount amount
   2. Find discount percentage
   3. Successive discounts and additional savings
   4. Reverse discount / original price
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ================= SHARED ELEMENTS =================

    const currentYear = document.getElementById("currentYear");
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    // ================= FORMATTING =================

    function formatNumber(value) {
        if (!Number.isFinite(value)) {
            throw new Error("The result is too large to display.");
        }

        if (Object.is(value, -0)) {
            value = 0;
        }

        return Number(value.toPrecision(12)).toLocaleString("en-IN", {
            maximumFractionDigits: 2,
            useGrouping: true
        });
    }


    function formatMoney(value) {
        return "₹" + formatNumber(value);
    }


    function formatPercent(value) {
        return formatNumber(value) + "%";
    }


    // ================= INPUT VALIDATION =================

    function getNumber(id) {
        const input = document.getElementById(id);
        const rawValue = input.value.trim();

        if (rawValue === "") {
            throw new Error("Please fill in all required fields.");
        }

        const value = Number(rawValue);

        if (!Number.isFinite(value)) {
            throw new Error("Please enter a valid number.");
        }

        if (value < 0) {
            throw new Error("Values cannot be negative.");
        }

        return value;
    }


    function getDiscountPercent(id) {
        const value = getNumber(id);

        if (value > 100) {
            throw new Error("Discount must be between 0% and 100%.");
        }

        return value;
    }


    // ================= RESULT DISPLAY =================

    function showResult(resultId, heading, details = []) {

        const box = document.getElementById(resultId);

        box.classList.remove("error");
        box.replaceChildren();

        const label = document.createElement("span");
        label.className = "result-label";
        label.textContent = "Your result";

        const strong = document.createElement("strong");
        strong.textContent = heading;

        box.append(label, strong);

        details.forEach((detail) => {
            const line = document.createElement("span");
            line.className = "result-detail";
            line.textContent = detail;

            box.appendChild(line);
        });
    }


    function showError(resultId, message) {

        const box = document.getElementById(resultId);

        box.classList.add("error");
        box.replaceChildren();

        const label = document.createElement("span");
        label.className = "result-label";
        label.textContent = "Unable to calculate";

        const strong = document.createElement("strong");
        strong.textContent = message;

        box.append(label, strong);
    }


    function runCalculation(resultId, callback) {
        try {
            callback();
        } catch (error) {
            showError(
                resultId,
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please try again."
            );
        }
    }


    // ================= 1. SALE PRICE & SAVINGS =================

    const saleForm = document.getElementById("saleForm");

    saleForm.addEventListener("submit", (event) => {
        event.preventDefault();

        runCalculation("saleResult", () => {

            const originalPrice = getNumber("saleOriginal");
            const discountPercent = getDiscountPercent("salePercent");

            const discountAmount =
                originalPrice * discountPercent / 100;

            const finalPrice = originalPrice - discountAmount;

            showResult(
                "saleResult",
                formatMoney(finalPrice),
                [
                    "Original price: " + formatMoney(originalPrice),
                    "Discount amount: " + formatMoney(discountAmount),
                    "You save " + formatPercent(discountPercent) +
                        " (" + formatMoney(discountAmount) + ")."
                ]
            );
        });
    });


    // ================= 2. FIND DISCOUNT PERCENTAGE =================

    const findDiscountForm =
        document.getElementById("findDiscountForm");

    findDiscountForm.addEventListener("submit", (event) => {
        event.preventDefault();

        runCalculation("findDiscountResult", () => {

            const originalPrice = getNumber("findOriginal");
            const salePrice = getNumber("findSale");

            if (originalPrice === 0) {
                throw new Error("Original price must be greater than zero.");
            }

            const difference = originalPrice - salePrice;

            if (difference < 0) {

                const increasePercent =
                    (Math.abs(difference) / originalPrice) * 100;

                showResult(
                    "findDiscountResult",
                    formatPercent(increasePercent) + " increase",
                    [
                        "The entered sale price is higher than the original price.",
                        "Price difference: " + formatMoney(Math.abs(difference))
                    ]
                );

                return;
            }

            const discountPercent =
                (difference / originalPrice) * 100;

            showResult(
                "findDiscountResult",
                formatPercent(discountPercent) + " off",
                [
                    "Original price: " + formatMoney(originalPrice),
                    "Sale price: " + formatMoney(salePrice),
                    "Amount saved: " + formatMoney(difference)
                ]
            );
        });
    });


    // ================= 3. ADDITIONAL / STACKED SAVINGS =================

    const stackedForm = document.getElementById("stackedForm");

    stackedForm.addEventListener("submit", (event) => {
        event.preventDefault();

        runCalculation("stackedResult", () => {

            const originalPrice = getNumber("stackedOriginal");
            const firstPercent = getDiscountPercent("firstDiscount");
            const secondPercent = getDiscountPercent("secondDiscount");

            // First discount is applied to the original price.
            const afterFirst =
                originalPrice * (1 - firstPercent / 100);

            // Second discount is applied to the reduced price.
            const finalPrice =
                afterFirst * (1 - secondPercent / 100);

            const totalSavings = originalPrice - finalPrice;

            const effectiveDiscount = originalPrice === 0
                ? 0
                : (totalSavings / originalPrice) * 100;

            showResult(
                "stackedResult",
                formatMoney(finalPrice),
                [
                    "After first discount: " + formatMoney(afterFirst),
                    "Total savings: " + formatMoney(totalSavings),
                    "Effective combined discount: " +
                        formatPercent(effectiveDiscount),
                    "The discounts are applied one after another, not added."
                ]
            );
        });
    });


    // ================= 4. FIND ORIGINAL PRICE =================

    const reverseForm = document.getElementById("reverseForm");

    reverseForm.addEventListener("submit", (event) => {
        event.preventDefault();

        runCalculation("reverseResult", () => {

            const salePrice = getNumber("reverseSale");
            const discountPercent = getDiscountPercent("reversePercent");

            if (discountPercent === 100) {
                throw new Error(
                    "A 100% discount leaves no price from which to recover the original."
                );
            }

            const remainingRate = 1 - discountPercent / 100;

            const originalPrice = salePrice / remainingRate;

            const discountAmount = originalPrice - salePrice;

            showResult(
                "reverseResult",
                formatMoney(originalPrice),
                [
                    "Sale price: " + formatMoney(salePrice),
                    "Discount: " + formatPercent(discountPercent),
                    "Original discount amount: " + formatMoney(discountAmount)
                ]
            );
        });
    });


    // ================= RESET RESULT WHEN INPUT CHANGES =================

    const formResults = [
        {
            form: saleForm,
            resultId: "saleResult"
        },
        {
            form: findDiscountForm,
            resultId: "findDiscountResult"
        },
        {
            form: stackedForm,
            resultId: "stackedResult"
        },
        {
            form: reverseForm,
            resultId: "reverseResult"
        }
    ];

    formResults.forEach(({ form, resultId }) => {

        const resultBox = document.getElementById(resultId);

        form.querySelectorAll("input").forEach((input) => {

            input.addEventListener("input", () => {

                input.removeAttribute("aria-invalid");

                resultBox.classList.remove("error");
                resultBox.replaceChildren();

                const label = document.createElement("span");
                label.className = "result-label";
                label.textContent = "Your result";

                const placeholder = document.createElement("strong");
                placeholder.textContent = "—";

                resultBox.append(label, placeholder);
            });

            input.addEventListener("invalid", () => {
                input.setAttribute("aria-invalid", "true");
            });
        });
    });


    // ================= MOBILE NAVIGATION =================

    if (menuToggle && mainNav) {

        menuToggle.addEventListener("click", () => {

            const isOpen = mainNav.classList.toggle("open");

            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation" : "Toggle navigation"
            );

            menuToggle.textContent = isOpen ? "×" : "☰";
        });

        mainNav.querySelectorAll("a").forEach((link) => {

            link.addEventListener("click", () => {

                mainNav.classList.remove("open");

                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Toggle navigation");
                menuToggle.textContent = "☰";
            });
        });
    }

});