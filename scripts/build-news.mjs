import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, "..");
const contentDirectory = join(siteRoot, "content", "news");
const newsDirectory = join(siteRoot, "news");
const indexFile = join(siteRoot, "assets", "data", "news.json");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const files = (await readdir(contentDirectory))
  .filter((name) => name.endsWith(".json"))
  .sort();

const articles = [];

for (const file of files) {
  const article = JSON.parse(
    await readFile(join(contentDirectory, file), "utf8"),
  );

  validateArticle(article, file);
  articles.push(article);
}

await removeStalePages(articles);

for (const article of articles) {
  if (article.status !== "published") {
    continue;
  }

  const outputDirectory = join(newsDirectory, article.slug);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    join(outputDirectory, "index.html"),
    createArticlePage(article),
    "utf8",
  );
}

const publicArticles = articles
  .filter((article) => article.status === "published")
  .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
  .map((article) => ({
    slug: article.slug,
    url: `/news/${article.slug}/`,
    title: article.title,
    shortTitle: article.shortTitle,
    summary: article.summary,
    category: article.category,
    articleType: article.articleType,
    publicationDate: article.publicationDate,
    author: article.author,
    featured: Boolean(article.featured),
    featuredImage: article.featuredImage,
    featuredAlt: article.featuredAlt,
  }));

await mkdir(dirname(indexFile), { recursive: true });
await writeFile(indexFile, `${JSON.stringify(publicArticles, null, 2)}\n`, "utf8");

console.log(
  `Built ${publicArticles.length} published news article${publicArticles.length === 1 ? "" : "s"}.`,
);

function validateArticle(article, filename) {
  const required = [
    "title",
    "slug",
    "shortTitle",
    "deck",
    "summary",
    "articleType",
    "category",
    "publicationDate",
    "author",
    "status",
    "featuredImage",
    "featuredAlt",
    "blocks",
  ];

  for (const field of required) {
    if (article[field] === undefined || article[field] === "") {
      throw new Error(`${filename}: missing required field "${field}".`);
    }
  }

  if (!slugPattern.test(article.slug)) {
    throw new Error(`${filename}: invalid slug "${article.slug}".`);
  }

  if (!Array.isArray(article.blocks)) {
    throw new Error(`${filename}: blocks must be an array.`);
  }

  if (!["draft", "published"].includes(article.status)) {
    throw new Error(`${filename}: status must be draft or published.`);
  }
}

async function removeStalePages(currentArticles) {
  let previous = [];

  try {
    previous = JSON.parse(await readFile(indexFile, "utf8"));
  } catch {
    return;
  }

  const currentPublishedSlugs = new Set(
    currentArticles
      .filter((article) => article.status === "published")
      .map((article) => article.slug),
  );

  for (const oldArticle of previous) {
    if (
      slugPattern.test(oldArticle.slug || "") &&
      !currentPublishedSlugs.has(oldArticle.slug)
    ) {
      await rm(join(newsDirectory, oldArticle.slug), {
        recursive: true,
        force: true,
      });
    }
  }
}

function createArticlePage(article) {
  const pageClass = `article-page--${escapeAttribute(article.articleType)}`;
  const pageUrl = `/news/${escapeAttribute(article.slug)}/`;
  const seoTitle = article.seo?.title || article.title;
  const seoDescription = article.seo?.description || article.summary;
  const body = article.blocks.map(renderBlock).join("\n");
  const related = renderRelated(article.related || []);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(seoTitle)} | Rochester Sports Foundation</title>
    <meta name="description" content="${escapeAttribute(seoDescription)}" />
    <link rel="stylesheet" href="/assets/css/style.css" />
    <link rel="stylesheet" href="/assets/css/news-article.css" />
    <script src="/assets/js/main.js" defer></script>
  </head>

  <body>
    <div data-include="header"></div>

    <main>
      <article class="article-page ${pageClass}">
        <header class="article-header">
          <div class="wrap article-header__inner">
            <nav class="article-breadcrumb" aria-label="Breadcrumb">
              <a href="/">Home</a>
              <span aria-hidden="true">/</span>
              <a href="/news/">News</a>
              <span aria-hidden="true">/</span>
              <span aria-current="page">${escapeHtml(article.category)}</span>
            </nav>

            <div class="article-kicker">
              <span class="article-category">${escapeHtml(article.category)}</span>
              <span class="article-date">${formatDate(article.publicationDate)}</span>
            </div>

            <h1>${escapeHtml(article.title)}</h1>
            <p class="article-deck">${escapeHtml(article.deck)}</p>

            <div class="article-byline">
              <span>${escapeHtml(article.author)}</span>
              <span aria-hidden="true">&bull;</span>
              <span>${escapeHtml(article.readTime || "")}</span>
            </div>
          </div>
        </header>

        <div class="wrap article-feature">
          <figure>
            <img src="${escapeAttribute(article.featuredImage)}" alt="${escapeAttribute(article.featuredAlt)}" />
            ${article.featuredCaption ? `<figcaption>${escapeHtml(article.featuredCaption)}</figcaption>` : ""}
          </figure>
        </div>

        <div class="wrap article-layout">
          <aside class="article-share" aria-label="Share this article">
            <p>Share</p>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://rochsportsfoundation.org${pageUrl}`)}" target="_blank" rel="noopener noreferrer">Facebook</a>
            <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://rochsportsfoundation.org${pageUrl}`)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </aside>

          <div class="article-body">
${indent(body, 12)}
          </div>
        </div>

${related}
      </article>
    </main>

    <div data-include="footer"></div>
  </body>
</html>
`;
}

function renderBlock(block) {
  switch (block.type) {
    case "paragraph":
      return `<p${block.style === "lede" ? ' class="article-lede"' : ""}>${block.content}</p>`;

    case "heading":
      return `<h2>${escapeHtml(block.text)}</h2>`;

    case "image":
      return `<figure class="article-image article-image--${escapeAttribute(block.size || "standard")}">
  <img src="${escapeAttribute(block.image)}" alt="${escapeAttribute(block.alt)}" />
  ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
</figure>`;

    case "quote":
      return `<blockquote class="article-quote">
  <p>&ldquo;${escapeHtml(block.quote)}&rdquo;</p>
  <footer>
    ${block.attributionName ? `<strong>${escapeHtml(block.attributionName)}</strong>` : ""}
    ${block.attributionTitle ? `<span>${escapeHtml(block.attributionTitle)}</span>` : ""}
  </footer>
</blockquote>`;

    case "stats":
      return `<section class="article-callout">
  ${(block.items || []).map((item) => `<div><span class="article-callout__number">${escapeHtml(item.number)}</span><span class="article-callout__label">${escapeHtml(item.label)}</span></div>`).join("\n  ")}
  ${block.heading ? `<h2>${escapeHtml(block.heading)}</h2>` : ""}
  ${block.text ? `<p>${escapeHtml(block.text)}</p>` : ""}
</section>`;

    case "photoStory":
      return `<section class="article-photo-story">
  <figure>
    <img src="${escapeAttribute(block.image)}" alt="${escapeAttribute(block.alt)}" />
    ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
  </figure>
  <div>
    ${block.eyebrow ? `<p class="eyebrow">${escapeHtml(block.eyebrow)}</p>` : ""}
    <h3>${escapeHtml(block.heading)}</h3>
    ${block.text}
  </div>
</section>`;

    case "gallery":
      return `${block.heading ? `<h2>${escapeHtml(block.heading)}</h2>` : ""}
<div class="article-gallery">
  ${(block.items || []).map((item) => `<figure><img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.alt)}" />${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}</figure>`).join("\n  ")}
</div>`;

    case "callout":
      return `<div class="article-endnote">
  ${block.heading ? `<h3>${escapeHtml(block.heading)}</h3>` : ""}
  ${block.text}
  ${block.buttonLabel && block.buttonUrl ? `<a class="button dark" href="${escapeAttribute(block.buttonUrl)}">${escapeHtml(block.buttonLabel)}</a>` : ""}
</div>`;

    case "document":
      return `<div class="article-document">
  <div><h3>${escapeHtml(block.title)}</h3>${block.description ? `<p>${escapeHtml(block.description)}</p>` : ""}</div>
  <a class="button dark" href="${escapeAttribute(block.file)}">View PDF</a>
</div>`;

    default:
      throw new Error(`Unsupported article block type: ${block.type}`);
  }
}

function renderRelated(items) {
  if (!items.length) {
    return "";
  }

  return `        <section class="related-news" aria-labelledby="related-heading">
          <div class="wrap">
            <div class="related-news__heading">
              <div>
                <p class="eyebrow">Continue reading</p>
                <h2 id="related-heading">Related news</h2>
              </div>
              <a class="text-link" href="/news/">View all news &rarr;</a>
            </div>

            <div class="related-news__grid">
${indent(items.map((item) => `<a class="related-card" href="${escapeAttribute(item.url)}">
  <span>${escapeHtml(item.category)}</span>
  <h3>${escapeHtml(item.title)}</h3>
  <p>${formatDate(item.date)}</p>
</a>`).join("\n"), 14)}
            </div>
          </div>
        </section>`;
}

function formatDate(value) {
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

function indent(value, spaces) {
  const padding = " ".repeat(spaces);
  return String(value)
    .split("\n")
    .map((line) => `${padding}${line}`)
    .join("\n");
}
