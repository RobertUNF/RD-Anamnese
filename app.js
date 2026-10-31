const STORAGE_PREFIX = "rd-doc-state:";
const AUTH_STORAGE = "rd-doc-auth";

const els = {
  title: document.getElementById("title"),
  subtitle: document.getElementById("subtitle"),
  categories: document.getElementById("categories"),
  output: document.getElementById("output"),
  progress: document.getElementById("progress"),
  copy: document.getElementById("copy"),
  reset: document.getElementById("reset"),
  navigation: document.getElementById("page-navigation"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  sidebarBackdrop: document.getElementById("sidebar-backdrop"),
};

let catalog = null;
let navigation = null;
let activePage = null;
let state = {};

const groupKey = (categoryId, groupId) => `${categoryId}::${groupId}`;

function normalizeCategory(category) {
  if (category.groups?.length) return category;
  return {
    ...category,
    groups: [
      {
        id: category.id,
        type: category.type ?? "single",
        options: category.options ?? [],
      },
    ],
  };
}

function loadState(pageId) {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${pageId}`) ?? "{}");
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(`${STORAGE_PREFIX}${activePage.id}`, JSON.stringify(state));
}

function selectedIds(category, group) {
  const value = state[groupKey(category.id, group.id)];
  if (group.type === "multiple") return Array.isArray(value) ? value : [];
  return value ? [value] : [];
}

function isGroupComplete(category, group) {
  if (!isGroupVisible(category, group)) return true;
  return selectedIds(category, group).length > 0;
}

function isCategoryComplete(category) {
  return category.groups.every((group) => isGroupComplete(category, group));
}

function isGroupVisible(category, group) {
  if (!group.showWhen) return true;
  const parent = category.groups.find((item) => item.id === group.showWhen.groupId);
  return parent ? selectedIds(category, parent).includes(group.showWhen.optionId) : false;
}

function toggleOption(category, group, option) {
  const key = groupKey(category.id, group.id);
  if (group.type === "multiple") {
      const current = new Set(selectedIds(category, group));
      if (option.exclusive) {
        state[key] = current.has(option.id) ? [] : [option.id];
      } else {
        for (const item of group.options) {
          if (item.exclusive) current.delete(item.id);
        }
        if (current.has(option.id)) current.delete(option.id);
        else current.add(option.id);
        state[key] = [...current];
      }
  } else {
    state[key] = state[key] === option.id ? undefined : option.id;
    if (state[key] === undefined) delete state[key];
  }
  saveState();
  render();
}

function textForGroup(category, group) {
  if (!isGroupVisible(category, group)) return "";
  const ids = selectedIds(category, group);
  const texts = ids
    .map((id) => group.options.find((option) => option.id === id)?.text)
    .filter(Boolean);
  if (!texts.length) return "";
  return `${group.prefix ?? ""}${texts.join(group.joiner ?? ", ")}${group.suffix ?? ""}`;
}

function textForCategory(category) {
  const parts = category.groups.map((group) => textForGroup(category, group)).filter(Boolean);
  if (!parts.length) return "";
  return `${category.prefix ?? ""}${parts.join(category.groupJoiner ?? ", ")}${category.suffix ?? ""}`;
}

function buildParagraph() {
  const meta = catalog.meta ?? {};
  const parts = catalog.categories
    .map(normalizeCategory)
    .map(textForCategory)
    .filter(Boolean);
  if (!parts.length) return "";
  const body = parts.join(meta.categoryJoiner ?? ". ");
  return `${meta.paragraphPrefix ?? ""}${body}${meta.paragraphSuffix ?? ""}`;
}

function renderCategory(category) {
  const card = document.createElement("section");
  card.className = "card glass";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.innerHTML = `<span>${category.title}</span>`;
  if (isCategoryComplete(category)) {
    const done = document.createElement("span");
    done.className = "done";
    done.textContent = "vollständig";
    title.append(done);
  }
  card.append(title);

  for (const group of category.groups) {
    if (!isGroupVisible(category, group)) continue;
    const wrap = document.createElement("div");
    wrap.className = "group";
    if (group.label || group.type === "multiple") {
      const label = document.createElement("p");
      label.className = "group-label";
      label.textContent = group.label ?? "";
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = group.type === "multiple" ? "Mehrfach" : "Einfach";
      label.append(badge);
      wrap.append(label);
    }
    const options = document.createElement("div");
    options.className = "options";
    const selected = new Set(selectedIds(category, group));
    for (const option of group.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = group.type === "multiple" ? "chip multi" : "chip";
      button.textContent = option.label;
      button.setAttribute("aria-pressed", selected.has(option.id) ? "true" : "false");
      button.addEventListener("click", () => toggleOption(category, group, option));
      options.append(button);
    }
    wrap.append(options);
    card.append(wrap);
  }
  return card;
}

function render() {
  const categories = catalog.categories.map(normalizeCategory);
  els.title.textContent = catalog.meta?.title ?? "Status praesens";
  document.title = els.title.textContent;
  els.subtitle.textContent = catalog.meta?.subtitle ?? "";
  els.categories.replaceChildren(...categories.map(renderCategory));

  const complete = categories.filter(isCategoryComplete).length;
  els.progress.textContent = `${complete} / ${categories.length} Kategorien vollständig`;

  const paragraph = buildParagraph();
  els.output.textContent = paragraph || "Bitte Befunde auswählen …";
  els.output.classList.toggle("empty", !paragraph);
  els.copy.disabled = !paragraph;
}

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  els.sidebarToggle.setAttribute("aria-expanded", String(open));
  els.sidebarToggle.setAttribute("aria-label", open ? "Navigation schließen" : "Navigation öffnen");
  els.sidebar.setAttribute("aria-hidden", String(!open));
}

function renderNavigation() {
  const links = navigation.pages.map((page) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-link";
    button.textContent = page.label;
    button.setAttribute("aria-current", page.id === activePage.id ? "page" : "false");
    button.addEventListener("click", () => selectPage(page));
    return button;
  });
  els.navigation.replaceChildren(...links);
}

async function selectPage(page) {
  const response = await fetch(page.file);
  if (!response.ok) throw new Error(`Seite konnte nicht geladen werden: ${page.file}`);
  catalog = await response.json();
  activePage = page;
  state = loadState(page.id);
  renderNavigation();
  render();
  setSidebarOpen(false);
}

async function copyText() {
  const paragraph = buildParagraph();
  if (!paragraph) return;
  try {
    await navigator.clipboard.writeText(paragraph);
  } catch {
    const field = document.createElement("textarea");
    field.value = paragraph;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  const original = els.copy.textContent;
  els.copy.textContent = "Kopiert";
  setTimeout(() => {
    els.copy.textContent = original;
  }, 1400);
}

function reset() {
  state = {};
  saveState();
  render();
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hashesEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function setUnlocked(unlocked) {
  document.body.classList.toggle("locked", !unlocked);
}

let booted = false;

async function boot() {
  if (booted) return;
  booted = true;
  navigation = await fetch("./navigation.json").then((response) => {
    if (!response.ok) throw new Error("Navigation konnte nicht geladen werden.");
    return response.json();
  });
  activePage = navigation.pages[0];
  await selectPage(activePage);
  els.copy.addEventListener("click", copyText);
  els.reset.addEventListener("click", reset);
  els.sidebarToggle.addEventListener("click", () => {
    setSidebarOpen(els.sidebarToggle.getAttribute("aria-expanded") !== "true");
  });
  els.sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));
}

const config = await fetch("./config.json").then((response) => {
  if (!response.ok) throw new Error("Konfiguration konnte nicht geladen werden.");
  return response.json();
});
const expectedHash = (config.auth?.passwordHash ?? "").toLowerCase();
const authForm = document.getElementById("auth-form");
const authPassword = document.getElementById("auth-password");
const authError = document.getElementById("auth-error");

if (hashesEqual(sessionStorage.getItem(AUTH_STORAGE) ?? "", expectedHash)) {
  setUnlocked(true);
  await boot();
} else {
  setUnlocked(false);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.hidden = true;
  const hash = await sha256Hex(authPassword.value);
  if (!hashesEqual(hash, expectedHash)) {
    authError.hidden = false;
    authPassword.value = "";
    authPassword.focus();
    return;
  }
  sessionStorage.setItem(AUTH_STORAGE, hash);
  authPassword.value = "";
  setUnlocked(true);
  await boot();
});
