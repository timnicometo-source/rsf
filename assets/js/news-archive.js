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

  const cardImage = article.cardImage || article.featuredImage;
  const imagePosition = normalizeImagePosition(article.cardImagePosition);

  elements.featured.innerHTML = `
    <a class="featured-story__image smart-image" data-smart-image href="${escapeAttribute(article.url)}" aria-label="Read ${escapeAttribute(article.title)}">
      <img class="smart-image__backdrop" src="${escapeAttribute(cardImage)}" alt="" aria-hidden="true" />
      <img class="smart-image__main image-position--${imagePosition}" src="${escapeAttribute(cardImage)}" alt="${escapeAttribute(article.featuredAlt || "")}" />
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

  initializeSmartImages(elements.featured);
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
  initializeSmartImages(elements.grid);
}

function renderCard(article) {
  const cardImage = article.cardImage || article.featuredImage;
  const imagePosition = normalizeImagePosition(article.cardImagePosition);

  return `<article class="news-card">
    <a class="news-card__image smart-image" data-smart-image href="${escapeAttribute(article.url)}" tabindex="-1" aria-hidden="true">
      <img class="smart-image__backdrop" src="${escapeAttribute(cardImage)}" alt="" aria-hidden="true" loading="lazy" />
      <img class="smart-image__main image-position--${imagePosition}" src="${escapeAttribute(cardImage)}" alt="" loading="lazy" />
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

/*
 * Archive images use normal cover cropping while most of the photograph remains
 * visible. Portrait, square, and unusually wide images automatically switch to
 * a full-image presentation over a softened copy of the same photograph.
 */
function initializeSmartImages(root = document) {
  root.querySelectorAll("[data-smart-image]").forEach((frame) => {
    const image = frame.querySelector(".smart-image__main");
    if (!image) return;

    const evaluate = () => {
      const boxWidth = frame.clientWidth;
      const boxHeight = frame.clientHeight;
      if (!boxWidth || !boxHeight || !image.naturalWidth || !image.naturalHeight) {
        return;
      }

      const imageRatio = image.naturalWidth / image.naturalHeight;
      const boxRatio = boxWidth / boxHeight;
      const visibleFraction = Math.min(imageRatio / boxRatio, boxRatio / imageRatio);

      frame.classList.toggle("smart-image--contain", visibleFraction < 0.78);
      frame.classList.add("smart-image--ready");
    };

    if (image.complete) evaluate();
    else image.addEventListener("load", evaluate, { once: true });
  });
}

function normalizeImagePosition(value) {
  return ["center", "top", "bottom", "left", "right"].includes(value)
    ? value
    : "center";
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
