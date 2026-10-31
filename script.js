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

    // Close the menu after selecting a navigation link.

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
// CURRENT YEAR
// =========================================

const currentYear = document.getElementById("currentYear");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}


// =========================================
// TOOL SEARCH
// =========================================

const searchForm = document.getElementById("searchForm");
const toolSearch = document.getElementById("toolSearch");

const searchResultsSection = document.getElementById(
    "searchResultsSection"
);

const searchResults = document.getElementById("searchResults");
const searchMessage = document.getElementById("searchMessage");

const searchableTools = Array.from(
    document.querySelectorAll("[data-tool]")
);


// Normalize search text to make matching more forgiving.

function normalizeSearchText(value) {

    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ");

}


// Find and display matching tools.

function searchTools(query) {

    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {

        searchResultsSection.hidden = true;

        searchMessage.textContent = "";
        searchResults.replaceChildren();

        return;

    }

    const words = normalizedQuery.split(" ");

    const matches = searchableTools.filter((tool) => {

        const searchableText = normalizeSearchText(
            [
                tool.dataset.tool || "",
                tool.querySelector("h3")?.textContent || "",
                tool.querySelector("p")?.textContent || ""
            ].join(" ")
        );

        return words.every((word) => searchableText.includes(word));

    });


    // Create independent result cards instead of moving
    // the original cards out of their sections.

    const fragment = document.createDocumentFragment();

    matches.forEach((tool) => {

        const card = tool.cloneNode(true);

        card.removeAttribute("hidden");

        card.addEventListener("click", (event) => {

            const destination = card.getAttribute("href");

            if (destination && destination.startsWith("#")) {

                event.preventDefault();

                const target = document.querySelector(destination);

                if (target) {

                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                }

                searchResultsSection.hidden = true;

            }

        });

        fragment.appendChild(card);

    });


    searchResults.replaceChildren(fragment);

    searchResultsSection.hidden = false;

    if (matches.length === 0) {

        searchMessage.textContent =
            `No tools found for "${query}". Try another search.`;

    } else {

        searchMessage.textContent =
            `${matches.length} matching tool${matches.length === 1 ? "" : "s"} found.`;

    }

}


// Handle the search form.

if (searchForm && toolSearch) {

    searchForm.addEventListener("submit", (event) => {

        event.preventDefault();

        searchTools(toolSearch.value);

        if (!searchResultsSection.hidden) {

            searchResultsSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }

    });


    // Provide results while typing.

    toolSearch.addEventListener("input", () => {

        if (toolSearch.value.trim()) {

            searchTools(toolSearch.value);

        } else {

            searchResultsSection.hidden = true;

        }

    });


    // Handle popular search suggestions.

    document.querySelectorAll(".search-suggestion").forEach((button) => {

        button.addEventListener("click", () => {

            const query = button.dataset.search || "";

            toolSearch.value = query;

            searchTools(query);

            searchResultsSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        });

    });

}