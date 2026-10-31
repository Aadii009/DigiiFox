document.addEventListener("DOMContentLoaded", () => {
    const toolGrid = document.getElementById("toolGrid");
    const toolCards = Array.from(
        toolGrid.querySelectorAll(".tool-card")
    );

    const searchInput = document.getElementById("toolSearch");
    const clearSearchButton = document.getElementById("clearSearch");
    const filterButtons = Array.from(
        document.querySelectorAll(".filter-button")
    );

    const visibleToolCount = document.getElementById("visibleToolCount");
    const noResults = document.getElementById("noResults");
    const resetFiltersButton = document.getElementById("resetFilters");

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const currentYear = document.getElementById("currentYear");

    let activeCategory = "all";

    // Set the current year in the footer.
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    // Search and category filtering.
    function filterTools() {
        const searchTerm = searchInput.value
            .trim()
            .toLowerCase();

        let visibleCount = 0;

        toolCards.forEach((card) => {
            const category = card.dataset.category || "";
            const name = card.dataset.name || "";
            const heading = card.querySelector("h3")?.textContent || "";
            const description = card.querySelector("p")?.textContent || "";

            const searchableText = [
                name,
                heading,
                description,
                category
            ].join(" ").toLowerCase();

            const matchesCategory =
                activeCategory === "all" ||
                category === activeCategory;

            const matchesSearch =
                searchTerm === "" ||
                searchableText.includes(searchTerm);

            const isVisible = matchesCategory && matchesSearch;

            card.hidden = !isVisible;

            if (isVisible) {
                visibleCount++;
            }
        });

        visibleToolCount.textContent = visibleCount;
        noResults.hidden = visibleCount !== 0;
        toolGrid.hidden = visibleCount === 0;
    }

    // Update the active category filter.
    function setActiveCategory(category) {
        activeCategory = category;

        filterButtons.forEach((button) => {
            const isActive = button.dataset.filter === category;

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });

        filterTools();
    }

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            setActiveCategory(button.dataset.filter);
        });
    });

    // Live search.
    searchInput.addEventListener("input", filterTools);

    // Clear the search field.
    clearSearchButton.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        filterTools();
    });

    // Restore all 25 tools.
    function resetAllFilters() {
        searchInput.value = "";
        setActiveCategory("all");
        searchInput.focus();
    }

    resetFiltersButton.addEventListener("click", resetAllFilters);

    // Mobile navigation.
    menuToggle.addEventListener("click", () => {
        const isOpen = mainNav.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation" : "Open navigation"
        );
    });

    // Close the mobile menu after selecting a link.
    mainNav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            mainNav.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
        });
    });

    // Close the menu when the user presses Escape.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            mainNav.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
        }
    });

    // Initialize the page with all tools visible.
    filterTools();
});