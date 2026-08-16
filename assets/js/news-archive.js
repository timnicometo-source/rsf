const archiveState = {
  articles: [],
  featuredSlug: "",
  search: "",
  category: "all",
  year: "all",
};

document.addEventListener("DOMContentLoaded", initializeNewsArchive);

async function initializeNewsArchive() {
  const elements = {
    featuredSection: document.querySelector("#featured-section"),
    featured: document.querySelector("#featured-story"),
    grid: document.querySelector("#news-grid"),
    count: document.querySelector("#results-count"),
    search: document.querySelector("#news-search"),
    category: document.querySelector("#category-filter"),
    year: document.querySelector("#year-filter"),
    clear: document.querySelector("#clear-filters"),
    empty: document.querySelector("#news-empty"),
    error: document.querySelector("#news-error"),
  };

  try {
    const response = await fetch("/assets/data/news.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load news (${response.status})`);

    const data = await response.json();
    archiveState.articles = Array.isArray(data)
      ? data.slice().sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
      : [];

    const featured = archiveState.articles.find((article) => article.featured) || archiveState.articles[0];
    archiveState.featuredSlug = featured?.slug || "";

    populateFilters(elements);
    renderFeatured(elements, featured);
    renderArchive(elements);

    elements.search.addEventListener("input", () => {
      archiveState.search = elements.search.value.trim().toLowerCase();
      renderArchive(elements);
    });
    elements.category.addEventListener("change", () => {
      archiveState.category = elements.category.value;
      renderArchive(elements);
    });
    elements.year.addEventListener("change", () => {
      archiveState.year = elements.year.value;
      renderArchive(elements);
    });
    elements.clear.addEventListener("click", () => clearFilters(elements));
    elements.empty.querySelector("button").addEventListener("click", () => clearFilters(elements));
  } catch (error) {
    console.error(error);
    elements.featuredSection.hidden = true;
    elements.grid.hidden = true;
    elements.error.hidden = false;
    elements.count.textContent = "";
  }
}

function populateFilters(elements) {
  const categories = [...new Set(archiveState.articles.map((article) => article.category).filter(Boolean))].sort();
  const years = [...new Set(archiveState.articles.map((article) => article.publicationDate?.slice(0, 4)).filter(Boolean))].sort().reverse();

  elements.category.insertAdjacentHTML(
    "beforeend",
    categories.map((category) => `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`).join(""),
  );
  elements.year.insertAdjacentHTML(
    "beforeend",
    years.map((year) => `<option value="${escapeAttribute(year)}">${escapeHtml(year)}</option>`).join(""),
  );
}

function renderFeatured(elements, article) {
  elements.featured.classList.remove("is-loading");

  if (!article) {
    elements.featuredSection.hidden = true;
    return;
  }

  elements.featured.innerHTML = `
    <a class="featured-story__image" href="${escapeAttribute(article.url)}" aria-label="Read ${escapeAttribute(article.title)}">
      <img src="${escapeAttribute(article.featuredImage)}" alt="${escapeAttribute(article.featuredAlt || "")}" />
    </a>
    <div class="featured-story__content">
      <div class="story-meta">
        <span>${escapeHtml(article.category)}</span>
        <time datetime="${escapeAttribute(article.publicationDate)}">${formatDate(article.publicationDate)}</time>
      </div>
      <h3><a href="${escapeAttribute(article.url)}">${escapeHtml(article.title)}</a></h3>
      <p>${escapeHtml(article.summary)}</p>
      <a class="story-link" href="${escapeAttribute(article.url)}">Read the full story <span aria-hidden="true">→</span></a>
    </div>
  `;
}

function renderArchive(elements) {
  const filtered = archiveState.articles.filter((article) => {
    const searchable = `${article.title} ${article.shortTitle || ""} ${article.summary || ""} ${article.category || ""}`.toLowerCase();
    const matchesSearch = !archiveState.search || searchable.includes(archiveState.search);
    const matchesCategory = archiveState.category === "all" || article.category === archiveState.category;
    const matchesYear = archiveState.year === "all" || article.publicationDate?.startsWith(archiveState.year);
    return matchesSearch && matchesCategory && matchesYear;
  });

  const filtersActive = Boolean(archiveState.search || archiveState.category !== "all" || archiveState.year !== "all");
  const visibleArticles = filtersActive
    ? filtered
    : filtered.filter((article) => article.slug !== archiveState.featuredSlug);

  elements.clear.hidden = !filtersActive;
  elements.featuredSection.hidden = filtersActive || !archiveState.featuredSlug;
  elements.count.textContent = resultLabel(filtered.length, archiveState.articles.length, filtersActive);
  elements.grid.setAttribute("aria-busy", "false");

  if (!visibleArticles.length) {
    elements.grid.innerHTML = "";
    elements.grid.hidden = true;
    elements.empty.hidden = !filtersActive;
    if (!filtersActive && archiveState.articles.length === 1) {
      elements.count.textContent = "More Foundation stories will appear here as they are published.";
    }
    return;
  }

  elements.empty.hidden = true;
  elements.grid.hidden = false;
  elements.grid.innerHTML = visibleArticles.map(renderCard).join("");
}

function renderCard(article) {
  return `<article class="news-card">
    <a class="news-card__image" href="${escapeAttribute(article.url)}" tabindex="-1" aria-hidden="true">
      <img src="${escapeAttribute(article.featuredImage)}" alt="" loading="lazy" />
    </a>
    <div class="news-card__body">
      <div class="story-meta">
        <span>${escapeHtml(article.category)}</span>
        <time datetime="${escapeAttribute(article.publicationDate)}">${formatDate(article.publicationDate)}</time>
      </div>
      <h3><a href="${escapeAttribute(article.url)}">${escapeHtml(article.shortTitle || article.title)}</a></h3>
      <p>${escapeHtml(article.summary)}</p>
      <a class="story-link" href="${escapeAttribute(article.url)}" aria-label="Read ${escapeAttribute(article.title)}">Read story <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function clearFilters(elements) {
  archiveState.search = "";
  archiveState.category = "all";
  archiveState.year = "all";
  elements.search.value = "";
  elements.category.value = "all";
  elements.year.value = "all";
  renderArchive(elements);
  elements.search.focus();
}

function resultLabel(count, total, active) {
  if (!active) return `${total} published ${total === 1 ? "story" : "stories"}`;
  return `${count} ${count === 1 ? "story" : "stories"} found`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
