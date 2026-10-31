
/* =========================================
   DIGIIFOX CALCULATORS LANDING PAGE
   Search, category filters and mobile menu
   ========================================= */

(() => {
  "use strict";

  const searchForm = document.getElementById("calculator-search-form");
  const searchInput = document.getElementById("calculator-search");

  const filterButtons = Array.from(
    document.querySelectorAll(".calc-filter")
  );

  const categories = Array.from(
    document.querySelectorAll(".calc-category")
  );

  const resultCount = document.getElementById(
    "calculator-result-count"
  );

  const noResults = document.getElementById(
    "calculator-no-results"
  );

  const resetButton = document.getElementById(
    "reset-calculator-search"
  );

  const menuToggle = document.querySelector(
    ".calc-menu-toggle"
  );

  const navigation = document.getElementById(
    "calc-navigation"
  );

  const year = document.getElementById(
    "calc-current-year"
  );

  let activeFilter = "all";

  // Update copyright year automatically.
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  // Normalize search terms.
  function normalize(value) {
    return (value || "")
      .toLocaleLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  // Apply the selected category and search query.
  function applyFilters() {
    const query = normalize(
      searchInput ? searchInput.value : ""
    );

    let visibleTotal = 0;

    categories.forEach((category) => {
      const categoryName = category.dataset.category;

      const categoryMatches =
        activeFilter === "all" ||
        activeFilter === categoryName;

      let visibleInCategory = 0;

      const cards = category.querySelectorAll(
        ".calc-tool-card"
      );

      cards.forEach((card) => {
        const title = card.querySelector(
          ".calc-tool-title"
        );

        const description = card.querySelector(
          ".calc-tool-description"
        );

        const searchableText = normalize([
          card.dataset.name,
          title ? title.textContent : "",
          description ? description.textContent : ""
        ].join(" "));

        const matchesSearch =
          !query || searchableText.includes(query);

        const visible =
          categoryMatches && matchesSearch;

        card.hidden = !visible;

        if (visible) {
          visibleInCategory++;
          visibleTotal++;
        }
      });

      category.hidden = visibleInCategory === 0;

      const categoryCount = category.querySelector(
        ".calc-category-count"
      );

      if (categoryCount) {
        categoryCount.textContent =
          `${visibleInCategory} ${
            visibleInCategory === 1 ? "tool" : "tools"
          }`;
      }
    });

    // Update the number of visible calculators.
    if (resultCount) {
      resultCount.textContent =
        `${visibleTotal} ${
          visibleTotal === 1
            ? "calculator"
            : "calculators"
        }`;
    }

    // Show the empty state if nothing matches.
    if (noResults) {
      noResults.hidden = visibleTotal !== 0;
    }
  }

  // Select a category filter.
  function setActiveFilter(button) {
    activeFilter = button.dataset.filter || "all";

    filterButtons.forEach((item) => {
      const isActive = item === button;

      item.classList.toggle("active", isActive);

      item.setAttribute(
        "aria-pressed",
        String(isActive)
      );
    });

    applyFilters();
  }

  // Category filter events.
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveFilter(button);
    });
  });

  // Live search.
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  // Submit search and scroll to the directory.
  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();

      applyFilters();

      const directory = document.getElementById(
        "all-calculators"
      );

      if (directory) {
        directory.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  }

  // Reset search and show all calculators.
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
      }

      const allButton = filterButtons.find(
        (button) => button.dataset.filter === "all"
      );

      if (allButton) {
        setActiveFilter(allButton);
      } else {
        activeFilter = "all";
        applyFilters();
      }

      if (searchInput) {
        searchInput.focus();
      }
    });
  }

  // Responsive mobile navigation.
  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navigation.classList.toggle(
        "is-open"
      );

      menuToggle.setAttribute(
        "aria-expanded",
        String(isOpen)
      );

      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation" : "Open navigation"
      );

      menuToggle.textContent = isOpen ? "×" : "☰";
    });

    navigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigation.classList.remove("is-open");

        menuToggle.setAttribute(
          "aria-expanded",
          "false"
        );

        menuToggle.setAttribute(
          "aria-label",
          "Open navigation"
        );

        menuToggle.textContent = "☰";
      });
    });
  }

  // Display all calculators when the page loads.
  applyFilters();

})();