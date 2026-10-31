"use strict";

// =========================================
// MOBILE NAVIGATION
// =========================================

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {

    menuToggle.addEventListener("click", () => {

        const isOpen = navLinks.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));

        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );

        menuToggle.textContent = isOpen ? "✕" : "☰";

    });

    navLinks.querySelectorAll("a").forEach((link) => {

        link.addEventListener("click", () => {

            navLinks.classList.remove("open");

            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation menu");

            menuToggle.textContent = "☰";

        });

    });

}


// =========================================
// FOOTER YEAR
// =========================================

const currentYear = document.getElementById("currentYear");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}


// =========================================
// PDF TOOL DIRECTORY
// =========================================

const pdfSearchForm = document.getElementById("pdfSearchForm");
const pdfSearch = document.getElementById("pdfSearch");

const pdfToolGrid = document.getElementById("pdfToolGrid");
const pdfToolCount = document.getElementById("pdfToolCount");

const pdfSearchNote = document.getElementById("pdfSearchNote");

const pdfEmptyState = document.getElementById("pdfEmptyState");
const resetPdfFilters = document.getElementById("resetPdfFilters");

const pdfFilterButtons = Array.from(
    document.querySelectorAll(".pdf-filter")
);

const pdfToolCards = Array.from(
    document.querySelectorAll(".pdf-tool-card")
);

let activeCategory = "all";


// Normalize search strings.

function normalizePdfText(value) {

    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ");

}


// Apply search and category filters.

function filterPdfTools() {

    const query = normalizePdfText(pdfSearch.value);

    const searchWords = query
        ? query.split(" ")
        : [];

    let visibleCount = 0;

    pdfToolCards.forEach((card) => {

        const name = normalizePdfText(
            card.dataset.name || ""
        );

        const keywords = normalizePdfText(
            card.dataset.keywords || ""
        );

        const description = normalizePdfText(
            card.querySelector("p")?.textContent || ""
        );

        const category = card.dataset.category || "";

        const searchableText = `${name} ${keywords} ${description}`;

        const matchesSearch = searchWords.every((word) =>
            searchableText.includes(word)
        );

        const matchesCategory =
            activeCategory === "all" ||
            category === activeCategory;

        const isVisible = matchesSearch && matchesCategory;

        card.hidden = !isVisible;

        if (isVisible) {
            visibleCount++;
        }

    });


    pdfToolCount.textContent =
        `${visibleCount} Tool${visibleCount === 1 ? "" : "s"}`;

    pdfEmptyState.hidden = visibleCount !== 0;

    pdfToolGrid.hidden = visibleCount === 0;

    if (query) {

        pdfSearchNote.textContent =
            `${visibleCount} matching PDF tool${visibleCount === 1 ? "" : "s"} found.`;

    } else if (activeCategory !== "all") {

        pdfSearchNote.textContent =
            `${visibleCount} tools in this category.`;

    } else {

        pdfSearchNote.textContent =
            `Explore all ${pdfToolCards.length} PDF tools below.`;

    }

}


// Search form submission.

if (pdfSearchForm) {

    pdfSearchForm.addEventListener("submit", (event) => {

        event.preventDefault();

        filterPdfTools();

        document.getElementById("pdfToolGrid").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    });

}


// Live search.

if (pdfSearch) {

    pdfSearch.addEventListener("input", filterPdfTools);

}


// Category filters.

pdfFilterButtons.forEach((button) => {

    button.addEventListener("click", () => {

        activeCategory = button.dataset.category || "all";

        pdfFilterButtons.forEach((filterButton) => {

            const isActive = filterButton === button;

            filterButton.classList.toggle("active", isActive);

            filterButton.setAttribute(
                "aria-pressed",
                String(isActive)
            );

        });

        filterPdfTools();

    });

});


// Reset filters.

if (resetPdfFilters) {

    resetPdfFilters.addEventListener("click", () => {

        pdfSearch.value = "";

        activeCategory = "all";

        pdfFilterButtons.forEach((button) => {

            const isActive = button.dataset.category === "all";

            button.classList.toggle("active", isActive);

            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );

        });

        filterPdfTools();

    });

}


// Initial count and visibility.

filterPdfTools();