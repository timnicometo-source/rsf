const state = {
  rootHandle: null,
  articles: [],
  article: null,
  originalSlug: "",
  dirty: false,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  Object.assign(elements, {
    connect: document.querySelector("#connect-folder"),
    connectCopy: document.querySelector(".connect-copy"),
    connectionStatus: document.querySelector("#connection-status"),
    warning: document.querySelector("#browser-warning"),
    welcome: document.querySelector("#welcome-panel"),
    form: document.querySelector("#article-form"),
    articleList: document.querySelector("#article-list"),
    search: document.querySelector("#article-search"),
    newArticle: document.querySelector("#new-article"),
    title: document.querySelector("#editing-title"),
    notice: document.querySelector("#notice"),
    blocks: document.querySelector("#blocks-list"),
    related: document.querySelector("#related-list"),
    blockType: document.querySelector("#block-type"),
    addBlock: document.querySelector("#add-block"),
    addRelated: document.querySelector("#add-related"),
    preview: document.querySelector("#open-preview"),
    deleteArticle: document.querySelector("#delete-article"),
    imagePreview: document.querySelector("#featured-preview"),
    cardImagePreview: document.querySelector("#card-preview"),
    dialog: document.querySelector("#confirm-dialog"),
  });

  if (!("showDirectoryPicker" in window)) {
    elements.warning.hidden = false;
    elements.connect.disabled = true;
    elements.connectCopy.disabled = true;
  }

  elements.connect.addEventListener("click", connectFolder);
  elements.connectCopy.addEventListener("click", connectFolder);
  elements.newArticle.addEventListener("click", () => guardUnsaved(createArticle));
  elements.search.addEventListener("input", renderArticleList);
  elements.form.addEventListener("submit", saveArticle);
  elements.form.addEventListener("input", handleFormInput);
  elements.form.addEventListener("change", handleFormInput);
  elements.addBlock.addEventListener("click", addBlock);
  elements.addRelated.addEventListener("click", addRelated);
  elements.preview.addEventListener("click", openPreview);
  elements.deleteArticle.addEventListener("click", deleteArticle);
  elements.blocks.addEventListener("click", handleBlockAction);
  elements.related.addEventListener("click", handleRelatedAction);
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", switchTab));
  document.querySelectorAll(".upload-image").forEach((button) => button.addEventListener("click", uploadImage));
  window.addEventListener("beforeunload", (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
});

async function connectFolder() {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await verifyProject(handle);
    state.rootHandle = handle;
    elements.connectionStatus.textContent = `Connected: ${handle.name}`;
    elements.connectionStatus.classList.add("connected");
    elements.search.disabled = false;
    elements.newArticle.disabled = false;
    elements.welcome.hidden = true;
    await loadArticleList();

    if (state.articles.length) {
      await loadArticle(state.articles[0].fileName);
    } else {
      createArticle();
    }
  } catch (error) {
    if (error.name !== "AbortError") showNotice(error.message, "error");
  }
}

async function verifyProject(handle) {
  try {
    const content = await handle.getDirectoryHandle("content");
    await content.getDirectoryHandle("news");
    const assets = await handle.getDirectoryHandle("assets");
    await assets.getDirectoryHandle("images");
  } catch {
    throw new Error("That does not appear to be the Rochester Sports Foundation project folder. Choose the folder containing content, assets, news, and index.html.");
  }
}

async function getNewsDirectory() {
  const content = await state.rootHandle.getDirectoryHandle("content");
  return content.getDirectoryHandle("news");
}

async function loadArticleList() {
  const directory = await getNewsDirectory();
  const articles = [];

  for await (const [name, handle] of directory.entries()) {
    if (handle.kind !== "file" || !name.endsWith(".json")) continue;
    try {
      const article = JSON.parse(await (await handle.getFile()).text());
      articles.push({
        fileName: name,
        slug: article.slug,
        title: article.title || "Untitled article",
        date: article.publicationDate || "",
        status: article.status || "draft",
      });
    } catch (error) {
      console.warn(`Unable to read ${name}`, error);
    }
  }

  state.articles = articles.sort((a, b) => b.date.localeCompare(a.date));
  renderArticleList();
}

function renderArticleList() {
  const query = elements.search.value.trim().toLowerCase();
  const items = state.articles.filter((item) => item.title.toLowerCase().includes(query));

  if (!items.length) {
    elements.articleList.innerHTML = '<p class="empty-message">No matching articles.</p>';
    return;
  }

  elements.articleList.innerHTML = items.map((item) => `
    <button type="button" data-file="${escapeAttribute(item.fileName)}" class="${item.slug === state.article?.slug ? "active" : ""}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.status)}${item.date ? ` · ${escapeHtml(item.date)}` : ""}</span>
    </button>
  `).join("");

  elements.articleList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => guardUnsaved(() => loadArticle(button.dataset.file)));
  });
}

async function loadArticle(fileName) {
  const directory = await getNewsDirectory();
  const handle = await directory.getFileHandle(fileName);
  state.article = normalizeArticle(JSON.parse(await (await handle.getFile()).text()));
  state.originalSlug = state.article.slug;
  state.dirty = false;
  populateForm();
  renderArticleList();
}

function createArticle() {
  const today = new Date().toISOString().slice(0, 10);
  state.article = normalizeArticle({
    title: "",
    slug: "",
    shortTitle: "",
    deck: "",
    summary: "",
    articleType: "standard",
    category: "Foundation News",
    publicationDate: today,
    author: "Rochester Sports Foundation",
    readTime: "3-minute read",
    status: "draft",
    featured: false,
    featuredImage: "",
    featuredAlt: "",
    featuredCaption: "",
    cardImage: "",
    cardImagePosition: "center",
    blocks: [newBlock("paragraph")],
    related: [],
    seo: { title: "", description: "" },
  });
  state.originalSlug = "";
  state.dirty = false;
  populateForm();
  renderArticleList();
}

function normalizeArticle(article) {
  return {
    ...article,
    cardImage: article.cardImage || "",
    cardImagePosition: ["center", "top", "bottom", "left", "right"].includes(article.cardImagePosition) ? article.cardImagePosition : "center",
    blocks: Array.isArray(article.blocks) ? article.blocks : [],
    related: Array.isArray(article.related) ? article.related : [],
    seo: article.seo || { title: "", description: "" },
  };
}

function populateForm() {
  elements.welcome.hidden = true;
  elements.form.hidden = false;
  const article = state.article;
  const fields = ["title", "slug", "shortTitle", "deck", "summary", "articleType", "category", "publicationDate", "author", "readTime", "status", "featuredImage", "featuredAlt", "featuredCaption", "cardImage", "cardImagePosition"];
  fields.forEach((name) => {
    const field = elements.form.elements[name];
    if (field) field.value = article[name] ?? "";
  });
  elements.form.elements.featured.checked = Boolean(article.featured);
  elements.form.elements.seoTitle.value = article.seo?.title || "";
  elements.form.elements.seoDescription.value = article.seo?.description || "";
  elements.title.textContent = article.title || "New article";
  renderBlocks();
  renderRelated();
  renderFeaturedPreview();
  renderCardImagePreview();
  showNotice("", "");
  switchToPanel("details");
}

function handleFormInput(event) {
  if (!state.article || !event.target.name) return;
  const { name } = event.target;

  if (name === "featured") {
    state.article.featured = event.target.checked;
  } else if (name === "seoTitle") {
    state.article.seo.title = event.target.value;
  } else if (name === "seoDescription") {
    state.article.seo.description = event.target.value;
  } else if (!event.target.closest(".block-card") && !event.target.closest(".related-card")) {
    state.article[name] = event.target.value;
  }

  if (name === "title") {
    elements.title.textContent = event.target.value || "New article";
    if (!state.article.slug && !state.originalSlug) {
      state.article.slug = slugify(event.target.value);
      elements.form.elements.slug.value = state.article.slug;
    }
    if (!state.article.shortTitle) {
      state.article.shortTitle = event.target.value;
      elements.form.elements.shortTitle.value = event.target.value;
    }
  }

  if (name === "featuredImage") {
    renderFeaturedPreview();
    renderCardImagePreview();
  }
  if (name === "cardImage" || name === "cardImagePosition") renderCardImagePreview();
  markDirty();
}

async function saveArticle(event) {
  event.preventDefault();
  if (!state.rootHandle || !state.article) return;

  const errors = validateArticle(state.article);
  if (errors.length) {
    showNotice(errors.join(" "), "error");
    switchToPanel("details");
    return;
  }

  try {
    const directory = await getNewsDirectory();
    const fileName = `${state.article.slug}.json`;
    const handle = await directory.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(`${JSON.stringify(state.article, null, 2)}\n`);
    await writable.close();

    if (state.originalSlug && state.originalSlug !== state.article.slug) {
      try {
        await directory.removeEntry(`${state.originalSlug}.json`);
      } catch (error) {
        console.warn("Old article record could not be removed", error);
      }
    }

    state.originalSlug = state.article.slug;
    state.dirty = false;
    document.title = "RSF News Editor";
    await loadArticleList();
    renderArticleList();
    showNotice("Article record saved. Now double-click Build News.command to update the public HTML and News index.", "success");
  } catch (error) {
    showNotice(`The article could not be saved: ${error.message}`, "error");
  }
}

async function deleteArticle() {
  if (!state.originalSlug) {
    createArticle();
    showNotice("The unsaved article was cleared.", "success");
    return;
  }
  const approved = confirm(`Delete “${state.article.title}”? This removes its article record. Run Build News.command afterward to remove the public page.`);
  if (!approved) return;
  try {
    const directory = await getNewsDirectory();
    await directory.removeEntry(`${state.originalSlug}.json`);
    state.dirty = false;
    await loadArticleList();
    if (state.articles.length) {
      await loadArticle(state.articles[0].fileName);
      showNotice("Article record deleted. Run Build News.command to update the public website.", "success");
    } else {
      createArticle();
      showNotice("Article record deleted. Run Build News.command to update the public website.", "success");
    }
  } catch (error) {
    showNotice(`The article could not be deleted: ${error.message}`, "error");
  }
}

function validateArticle(article) {
  const errors = [];
  const required = ["title", "slug", "shortTitle", "deck", "summary", "publicationDate", "featuredImage", "featuredAlt"];
  required.forEach((field) => {
    if (!String(article[field] || "").trim()) errors.push(`${fieldLabel(field)} is required.`);
  });
  if (article.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) errors.push("The URL slug may contain only lowercase letters, numbers, and hyphens.");
  if (!article.blocks.length) errors.push("Add at least one article section.");
  return errors;
}

function fieldLabel(field) {
  return ({ shortTitle: "Short title", publicationDate: "Publication date", featuredImage: "Featured image", featuredAlt: "Featured image alternative text" })[field] || field[0].toUpperCase() + field.slice(1);
}

function addBlock() {
  state.article.blocks.push(newBlock(elements.blockType.value));
  renderBlocks();
  markDirty();
}

function newBlock(type) {
  const templates = {
    paragraph: { type, style: "standard", content: "" },
    heading: { type, text: "" },
    image: { type, image: "", alt: "", caption: "", size: "standard" },
    quote: { type, quote: "", attributionName: "", attributionTitle: "" },
    stats: { type, items: [{ number: "", label: "" }], heading: "", text: "" },
    photoStory: { type, image: "", alt: "", caption: "", eyebrow: "", heading: "", text: "" },
    gallery: { type, heading: "", items: [{ image: "", alt: "", caption: "" }] },
    callout: { type, heading: "", text: "", buttonLabel: "", buttonUrl: "" },
    document: { type, title: "", description: "", file: "" },
  };
  return templates[type];
}

function renderBlocks() {
  if (!state.article.blocks.length) {
    elements.blocks.innerHTML = '<p class="empty-message">No article sections yet. Choose a section type above and select Add section.</p>';
    return;
  }
  elements.blocks.innerHTML = state.article.blocks.map(renderBlockEditor).join("");
  elements.blocks.querySelectorAll(".block-card").forEach((card) => {
    card.addEventListener("input", updateBlockFromInput);
    card.addEventListener("change", updateBlockFromInput);
  });
}

function renderBlockEditor(block, index) {
  return `<section class="block-card" data-index="${index}">
    <div class="block-card-header">
      <strong>${blockLabel(block.type)}</strong>
      <div class="block-actions">
        <button type="button" data-action="up" title="Move up" aria-label="Move section up">↑</button>
        <button type="button" data-action="down" title="Move down" aria-label="Move section down">↓</button>
        <button type="button" data-action="remove" title="Remove section" aria-label="Remove section">×</button>
      </div>
    </div>
    <div class="block-body">${blockFields(block, index)}</div>
  </section>`;
}

function blockFields(block, index) {
  const text = (name, label, value = "", wide = false) => `<label class="field ${wide ? "field-wide" : ""}"><span>${label}</span><input data-field="${name}" type="text" value="${escapeAttribute(value)}" /></label>`;
  const area = (name, label, value = "", rows = 4) => `<label class="field field-wide"><span>${label}</span><textarea data-field="${name}" rows="${rows}">${escapeHtml(value)}</textarea></label>`;
  const upload = (target) => `<button class="button button-small" type="button" data-action="upload" data-target="${target}">Choose and copy image</button>`;

  switch (block.type) {
    case "paragraph":
      return `<div class="field-grid"><label class="field"><span>Text style</span><select data-field="style"><option value="standard" ${selected(block.style, "standard")}>Standard</option><option value="lede" ${selected(block.style, "lede")}>Opening paragraph</option></select></label>${area("content", "Text", block.content, 6)}</div>`;
    case "heading":
      return `<div class="field-grid">${text("text", "Section heading", block.text, true)}</div>`;
    case "image":
      return `<div class="field-grid">${text("image", "Image path", block.image, true)}${upload("image")}${text("alt", "Alternative text", block.alt, true)}${area("caption", "Caption", block.caption, 2)}<label class="field"><span>Image size</span><select data-field="size"><option value="standard" ${selected(block.size, "standard")}>Standard</option><option value="wide" ${selected(block.size, "wide")}>Wide</option><option value="full" ${selected(block.size, "full")}>Full width</option></select></label></div>`;
    case "quote":
      return `<div class="field-grid">${area("quote", "Quotation", block.quote, 4)}${text("attributionName", "Person", block.attributionName)}${text("attributionTitle", "Title or organization", block.attributionTitle)}</div>`;
    case "stats":
      return `<div class="field-grid">${text("heading", "Callout heading", block.heading, true)}${area("text", "Supporting text", block.text, 3)}${renderNestedItems(block, index)}<button class="text-button" type="button" data-action="add-item">+ Add statistic</button></div>`;
    case "photoStory":
      return `<div class="field-grid">${text("image", "Image path", block.image, true)}${upload("image")}${text("alt", "Alternative text", block.alt, true)}${area("caption", "Photo caption", block.caption, 2)}${text("eyebrow", "Small label", block.eyebrow)}${text("heading", "Heading", block.heading)}${area("text", "Text (paragraph HTML is allowed)", block.text, 6)}</div>`;
    case "gallery":
      return `<div class="field-grid">${text("heading", "Optional gallery heading", block.heading, true)}${renderNestedItems(block, index)}<button class="text-button" type="button" data-action="add-item">+ Add photograph</button></div>`;
    case "callout":
      return `<div class="field-grid">${text("heading", "Optional heading", block.heading, true)}${area("text", "Message (paragraph HTML is allowed)", block.text, 5)}${text("buttonLabel", "Button wording", block.buttonLabel)}${text("buttonUrl", "Button link", block.buttonUrl)}</div>`;
    case "document":
      return `<div class="field-grid">${text("title", "Document title", block.title, true)}${area("description", "Description", block.description, 3)}${text("file", "PDF path", block.file, true)}<button class="button button-small" type="button" data-action="upload-document">Choose and copy PDF</button></div>`;
    default:
      return "";
  }
}

function renderNestedItems(block) {
  const items = block.items || [];
  if (block.type === "stats") {
    return `<div class="nested-list">${items.map((item, itemIndex) => `<div class="nested-item" data-item-index="${itemIndex}"><div class="field-grid"><label class="field"><span>Number or value</span><input data-item-field="number" value="${escapeAttribute(item.number)}" /></label><label class="field"><span>Label</span><input data-item-field="label" value="${escapeAttribute(item.label)}" /></label></div><div class="nested-item-actions"><button class="text-button remove-button" type="button" data-action="remove-item" data-item-index="${itemIndex}">Remove statistic</button></div></div>`).join("")}</div>`;
  }
  return `<div class="nested-list">${items.map((item, itemIndex) => `<div class="nested-item" data-item-index="${itemIndex}"><div class="field-grid"><label class="field field-wide"><span>Image path</span><input data-item-field="image" value="${escapeAttribute(item.image)}" /></label><button class="button button-small" type="button" data-action="upload-item" data-item-index="${itemIndex}">Choose and copy image</button><label class="field field-wide"><span>Alternative text</span><input data-item-field="alt" value="${escapeAttribute(item.alt)}" /></label><label class="field field-wide"><span>Caption</span><textarea data-item-field="caption" rows="2">${escapeHtml(item.caption)}</textarea></label></div><div class="nested-item-actions"><button class="text-button remove-button" type="button" data-action="remove-item" data-item-index="${itemIndex}">Remove photograph</button></div></div>`).join("")}</div>`;
}

function updateBlockFromInput(event) {
  const card = event.target.closest(".block-card");
  const block = state.article.blocks[Number(card.dataset.index)];
  const item = event.target.closest("[data-item-index]");
  if (event.target.dataset.itemField && item) {
    block.items[Number(item.dataset.itemIndex)][event.target.dataset.itemField] = event.target.value;
  } else if (event.target.dataset.field) {
    block[event.target.dataset.field] = event.target.value;
  }
  markDirty();
}

async function handleBlockAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest(".block-card");
  const index = Number(card.dataset.index);
  const block = state.article.blocks[index];
  const action = button.dataset.action;

  if (action === "up" && index > 0) [state.article.blocks[index - 1], state.article.blocks[index]] = [state.article.blocks[index], state.article.blocks[index - 1]];
  if (action === "down" && index < state.article.blocks.length - 1) [state.article.blocks[index + 1], state.article.blocks[index]] = [state.article.blocks[index], state.article.blocks[index + 1]];
  if (action === "remove" && confirm("Remove this article section?")) state.article.blocks.splice(index, 1);
  if (action === "add-item") block.items.push(block.type === "stats" ? { number: "", label: "" } : { image: "", alt: "", caption: "" });
  if (action === "remove-item") block.items.splice(Number(button.dataset.itemIndex), 1);
  if (action === "upload") await uploadBlockImage(index, button.dataset.target);
  if (action === "upload-item") await uploadGalleryImage(index, Number(button.dataset.itemIndex));
  if (action === "upload-document") block.file = await chooseAndCopyDocument() || block.file;

  renderBlocks();
  markDirty();
}

async function chooseAndCopyDocument() {
  try {
    const [sourceHandle] = await window.showOpenFilePicker({
      types: [{ description: "PDF documents", accept: { "application/pdf": [".pdf"] } }],
      multiple: false,
    });
    const sourceFile = await sourceHandle.getFile();
    const safeName = safeFileName(sourceFile.name);
    const assets = await state.rootHandle.getDirectoryHandle("assets");
    const docs = await assets.getDirectoryHandle("docs");
    const news = await docs.getDirectoryHandle("news", { create: true });
    const destination = await news.getFileHandle(safeName, { create: true });
    const writable = await destination.createWritable();
    await writable.write(await sourceFile.arrayBuffer());
    await writable.close();
    return `/assets/docs/news/${safeName}`;
  } catch (error) {
    if (error.name !== "AbortError") showNotice(`The PDF could not be copied: ${error.message}`, "error");
    return "";
  }
}

function addRelated() {
  state.article.related.push({ title: "", category: "Foundation News", date: "", url: "/news/" });
  renderRelated();
  markDirty();
}

function renderRelated() {
  if (!state.article.related.length) {
    elements.related.innerHTML = '<p class="empty-message">No related articles selected.</p>';
    return;
  }
  elements.related.innerHTML = state.article.related.map((item, index) => `<section class="related-card" data-index="${index}"><button class="text-button remove-button remove-related" type="button" data-action="remove">Remove</button><div class="field-grid"><label class="field field-wide"><span>Article title</span><input data-field="title" value="${escapeAttribute(item.title)}" /></label><label class="field"><span>Category</span><input data-field="category" value="${escapeAttribute(item.category)}" /></label><label class="field"><span>Publication date</span><input type="date" data-field="date" value="${escapeAttribute(item.date)}" /></label><label class="field field-wide"><span>Article URL</span><input data-field="url" value="${escapeAttribute(item.url)}" /></label></div></section>`).join("");
  elements.related.querySelectorAll(".related-card").forEach((card) => {
    card.addEventListener("input", (event) => {
      state.article.related[Number(card.dataset.index)][event.target.dataset.field] = event.target.value;
      markDirty();
    });
  });
}

function handleRelatedAction(event) {
  const button = event.target.closest('[data-action="remove"]');
  if (!button) return;
  state.article.related.splice(Number(button.closest(".related-card").dataset.index), 1);
  renderRelated();
  markDirty();
}

async function uploadImage(event) {
  const path = await chooseAndCopyImage();
  if (!path) return;
  const target = event.currentTarget.dataset.target;
  state.article[target] = path;
  elements.form.elements[target].value = path;
  if (target === "featuredImage") renderFeaturedPreview();
  renderCardImagePreview();
  markDirty();
}

async function uploadBlockImage(index, field) {
  const path = await chooseAndCopyImage();
  if (path) state.article.blocks[index][field] = path;
}

async function uploadGalleryImage(index, itemIndex) {
  const path = await chooseAndCopyImage();
  if (path) state.article.blocks[index].items[itemIndex].image = path;
}

async function chooseAndCopyImage() {
  if (!state.article.slug) {
    showNotice("Enter the article title and URL slug before adding images.", "error");
    switchToPanel("details");
    return "";
  }
  try {
    const [sourceHandle] = await window.showOpenFilePicker({
      types: [{ description: "Images", accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif"] } }],
      multiple: false,
    });
    const sourceFile = await sourceHandle.getFile();
    const safeName = safeFileName(sourceFile.name);
    const assets = await state.rootHandle.getDirectoryHandle("assets");
    const images = await assets.getDirectoryHandle("images");
    const news = await images.getDirectoryHandle("news", { create: true });
    const articleFolder = await news.getDirectoryHandle(state.article.slug, { create: true });
    const destination = await articleFolder.getFileHandle(safeName, { create: true });
    const writable = await destination.createWritable();
    await writable.write(await sourceFile.arrayBuffer());
    await writable.close();
    return `/assets/images/news/${state.article.slug}/${safeName}`;
  } catch (error) {
    if (error.name !== "AbortError") showNotice(`The image could not be copied: ${error.message}`, "error");
    return "";
  }
}

function renderFeaturedPreview() {
  const path = state.article.featuredImage;
  elements.imagePreview.innerHTML = path ? `<img src="${escapeAttribute(path)}" alt="" />` : "<span>Featured image preview</span>";
  elements.imagePreview.classList.toggle("empty", !path);
}

function renderCardImagePreview() {
  const path = state.article.cardImage || state.article.featuredImage;
  const position = ["center", "top", "bottom", "left", "right"].includes(state.article.cardImagePosition)
    ? state.article.cardImagePosition
    : "center";
  const objectPosition = position === "top" || position === "bottom"
    ? `center ${position}`
    : position === "left" || position === "right"
      ? `${position} center`
      : "center center";
  elements.cardImagePreview.innerHTML = path
    ? `<img src="${escapeAttribute(path)}" alt="" style="object-position: ${objectPosition};" />`
    : "<span>News card image preview</span>";
  elements.cardImagePreview.classList.toggle("empty", !path);
}

function openPreview() {
  if (!state.article?.slug) {
    showNotice("Enter a URL slug before opening the preview.", "error");
    return;
  }
  if (state.dirty) showNotice("Save the article and run Build News.command before checking your newest changes.", "error");
  window.open(`/news/${state.article.slug}/`, "_blank");
}

function switchTab(event) {
  switchToPanel(event.currentTarget.dataset.tab);
}

function switchToPanel(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
}

async function guardUnsaved(action) {
  if (!state.dirty) return action();
  elements.dialog.showModal();
  const result = await new Promise((resolve) => elements.dialog.addEventListener("close", () => resolve(elements.dialog.returnValue), { once: true }));
  if (result === "confirm") action();
}

function markDirty() {
  state.dirty = true;
  document.title = "• RSF News Editor";
}

function showNotice(message, type) {
  elements.notice.textContent = message;
  elements.notice.hidden = !message;
  elements.notice.className = `notice ${type}`;
  if (message) elements.notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (!message) document.title = "RSF News Editor";
}

function selected(value, expected) { return value === expected ? "selected" : ""; }
function blockLabel(type) { return ({ paragraph: "Text", heading: "Section heading", image: "Image", quote: "Pull quote", stats: "Statistics", photoStory: "Photo with text", gallery: "Photo gallery", callout: "Highlighted message", document: "PDF document" })[type] || type; }
function slugify(value) { return String(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function safeFileName(value) { const parts = value.split("."); const extension = parts.length > 1 ? `.${parts.pop().toLowerCase()}` : ""; return `${slugify(parts.join("-")) || "article-image"}${extension}`; }
function escapeHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttribute(value = "") { return escapeHtml(value).replaceAll("`", "&#096;"); }
