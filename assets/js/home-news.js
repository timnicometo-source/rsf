document.addEventListener("DOMContentLoaded", initializeHomeNews);

async function initializeHomeNews() {
  const grid = document.querySelector("#home-news-grid");
  const message = document.querySelector("#home-news-message");
  if (!grid) return;

  try {
    const response = await fetch("/assets/data/news.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load news (${response.status})`);

    const data = await response.json();
    const articles = (Array.isArray(data) ? data : [])
      .filter((article) => article && article.slug && article.publicationDate)
      .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
      .slice(0, 3);

    if (!articles.length) {
      grid.innerHTML = "";
      if (message) {
        message.hidden = false;
        message.textContent = "Foundation news will appear here as it is published.";
      }
      return;
    }

    grid.innerHTML = articles.map(renderHomeNewsCard).join("");
    grid.setAttribute("aria-busy", "false");
    initializeHomeSmartImages(grid);
  } catch (error) {
    console.error(error);
    grid.innerHTML = "";
    if (message) {
      message.hidden = false;
      message.innerHTML = '<a class="text-link" href="/news/">Visit News &amp; Updates →</a>';
    }
  }
}

function renderHomeNewsCard(article) {
  const url = article.url || `/news/${article.slug}/`;
  const image = article.cardImage || article.featuredImage || "";
  const title = article.shortTitle || article.title || "Foundation update";
  const alt = article.featuredAlt || "";
  const position = normalizeHomeImagePosition(article.cardImagePosition);

  return `<article class="home-news-card">
    <a class="home-news-card__image home-smart-image" data-home-smart-image href="${escapeHomeAttribute(url)}" aria-label="Read ${escapeHomeAttribute(article.title || title)}">
      <img class="home-smart-image__backdrop" src="${escapeHomeAttribute(image)}" alt="" aria-hidden="true" loading="lazy" />
      <img class="home-smart-image__main image-position--${position}" src="${escapeHomeAttribute(image)}" alt="${escapeHomeAttribute(alt)}" loading="lazy" />
    </a>

    <div class="home-news-card__body">
      <div class="home-news-card__meta">
        <span>${escapeHomeHtml(article.category || "Foundation News")}</span>
        <time datetime="${escapeHomeAttribute(article.publicationDate)}">${formatHomeNewsDate(article.publicationDate)}</time>
      </div>

      <h3><a href="${escapeHomeAttribute(url)}">${escapeHomeHtml(title)}</a></h3>
      <a class="home-news-card__link" href="${escapeHomeAttribute(url)}" aria-label="Read ${escapeHomeAttribute(article.title || title)}">Read update <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function initializeHomeSmartImages(root) {
  root.querySelectorAll("[data-home-smart-image]").forEach((frame) => {
    const image = frame.querySelector(".home-smart-image__main");
    if (!image) return;

    const evaluate = () => {
      if (!frame.clientWidth || !frame.clientHeight || !image.naturalWidth || !image.naturalHeight) return;

      const imageRatio = image.naturalWidth / image.naturalHeight;
      const frameRatio = frame.clientWidth / frame.clientHeight;
      const visibleFraction = Math.min(imageRatio / frameRatio, frameRatio / imageRatio);

      frame.classList.toggle("home-smart-image--contain", visibleFraction < 0.78);
    };

    if (image.complete) evaluate();
    else image.addEventListener("load", evaluate, { once: true });
  });
}

function normalizeHomeImagePosition(value) {
  return ["center", "top", "bottom", "left", "right"].includes(value) ? value : "center";
}

function formatHomeNewsDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function escapeHomeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHomeAttribute(value = "") {
  return escapeHomeHtml(value).replaceAll("`", "&#096;");
}
