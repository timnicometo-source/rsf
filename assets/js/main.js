document.addEventListener("DOMContentLoaded", async () => {
  // Load the shared header and footer.
  await Promise.all([
    loadInclude('[data-include="header"]', "/includes/header.html"),
    loadInclude('[data-include="footer"]', "/includes/footer.html"),
  ]);

  // Mark the current page in the navigation.
  setActiveNavigation();

  // Set up the mobile navigation button.
  const menuButton = document.querySelector(".menu-button");
  const nav = document.querySelector(".main-nav");

  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
    });
  }

  // Insert the current year wherever it is requested.
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
});

/**
 * Loads a shared HTML file into the selected element.
 */
async function loadInclude(selector, url) {
  const target = document.querySelector(selector);

  if (!target) {
    return;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Unable to load ${url}`);
    }

    target.innerHTML = await response.text();
  } catch (error) {
    console.error(error);
  }
}

/**
 * Adds the active-page class to the current navigation link.
 */
function setActiveNavigation() {
  const currentPath = window.location.pathname.replace(/index\.html$/, "");

  document.querySelectorAll(".main-nav a").forEach((link) => {
    const linkPath = new URL(link.href).pathname.replace(/index\.html$/, "");

    const isHomePage =
      linkPath === "/" &&
      (currentPath === "/" || currentPath === "");

    const isInteriorPage =
      linkPath !== "/" && currentPath.startsWith(linkPath);

    if (isHomePage || isInteriorPage) {
      link.classList.add("active-page");
      link.setAttribute("aria-current", "page");
    }
  });
}