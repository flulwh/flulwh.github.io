const GH_USER = "flulwh";
const API = `https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=updated`;
const CACHE_KEY = "flulwh.index.v2";
const CACHE_TTL = 10 * 60 * 1000;
const SELF_REPO = "flulwh.github.io";

const LANG_COLOR = {
  JavaScript: "#c9a227",
  TypeScript: "#3b74c4",
  Kotlin: "#a97bff",
  "C#": "#2f7d46",
  HTML: "#c0503a",
  CSS: "#7a5ea8",
  Python: "#3572a5",
  Rust: "#b4593a",
  Go: "#1b9aaa",
  Shell: "#5c8a3a",
  Vue: "#41b883",
  Svelte: "#d1461a",
  Java: "#a8672c",
  Swift: "#c25a2b",
  Dockerfile: "#3b74c4",
  Lua: "#2c5aa0",
};

// 已上线官网的项目；其余项目回落到 GitHub 仓库主页。
const SITES = {
  folio: "https://flulwh.github.io/folio/",
};

function siteOf(repo) {
  if (SITES[repo.name]) return SITES[repo.name];
  const homepage = (repo.homepage || "").trim();
  if (homepage && homepage !== repo.html_url) return homepage;
  return repo.html_url;
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- helpers ---------- */

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.repos)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式下忽略 */
  }
}

function normalizeRepos(list) {
  return list
    .filter((r) => r && r.name && r.name !== SELF_REPO)
    .sort((a, b) => new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0))
    .map((r) => ({
      name: r.name,
      description: r.description || "",
      html_url: r.html_url,
      homepage: r.homepage || "",
      language: r.language || "",
      stars: r.stargazers_count || 0,
      pushed_at: r.pushed_at || "",
      fork: Boolean(r.fork),
      archived: Boolean(r.archived),
    }));
}

function relativeTime(iso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天前`;
  const d = new Date(then);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function clockTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- render ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function buildRow(repo, index) {
  const li = el("li", "repo");
  const site = siteOf(repo);
  const hasSite = site !== repo.html_url;

  const main = el("a", "repo__main");
  main.href = site;
  main.target = "_blank";
  main.rel = "noopener";
  main.setAttribute("aria-label", `${repo.name} 的${hasSite ? "官网" : "仓库"}（新窗口打开）`);
  li.append(main);

  li.append(el("span", "repo__no", String(index + 1).padStart(2, "0")));

  const name = el("span", "repo__name");
  name.append(document.createTextNode(repo.name));
  if (repo.fork) name.append(el("span", "repo__tag", "fork"));
  else if (repo.archived) name.append(el("span", "repo__tag", "archived"));
  li.append(name);

  li.append(el("span", "repo__desc", repo.description || "暂无描述"));

  const lang = el("span", "repo__lang");
  const dot = el("i", "lang-dot");
  dot.style.background = LANG_COLOR[repo.language] || "var(--ink-3)";
  lang.append(dot, document.createTextNode(repo.language || "—"));
  li.append(lang);

  const stars = el("span", "repo__stars" + (repo.stars ? "" : " is-empty"), `★ ${repo.stars}`);
  li.append(stars);

  li.append(el("span", "repo__time", relativeTime(repo.pushed_at)));

  if (hasSite) {
    const src = el("a", "repo__src", "源码 ↗");
    src.href = repo.html_url;
    src.target = "_blank";
    src.rel = "noopener";
    src.setAttribute("aria-label", `${repo.name} 的 GitHub 仓库`);
    li.append(src);
  } else {
    li.append(el("span", "repo__lead", "↗"));
  }

  return li;
}

function render(payload) {
  const list = $("[data-repos]");
  const empty = $("[data-repos-empty]");
  if (!list) return;

  const repos = normalizeRepos(payload.repos || []);
  list.replaceChildren();
  list.setAttribute("aria-busy", "false");

  if (!repos.length) {
    list.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }

  list.hidden = false;
  if (empty) empty.hidden = true;
  const frag = document.createDocumentFragment();
  repos.forEach((repo, i) => frag.append(buildRow(repo, i)));
  list.append(frag);

  const time = clockTime(payload.syncedAt);
  $$("[data-sync-time]").forEach((node) => (node.textContent = time));
  $$("[data-repo-count]").forEach((node) => (node.textContent = String(repos.length).padStart(2, "0")));
}

/* ---------- data ---------- */

async function fetchLive() {
  const res = await fetch(API, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  return { syncedAt: new Date().toISOString(), repos: data };
}

async function fetchSnapshot() {
  const res = await fetch("./data/repos.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  return res.json();
}

async function load(force = false) {
  const button = $("[data-refresh]");
  if (button) button.setAttribute("data-busy", "");

  const cached = readCache();
  const fresh = cached && Date.now() - new Date(cached.syncedAt).getTime() < CACHE_TTL;

  if (cached && !force) render(cached);

  try {
    if (fresh && !force) return;
    const live = await fetchLive();
    writeCache(live);
    render(live);
  } catch {
    if (!cached) {
      try {
        const snapshot = await fetchSnapshot();
        render(snapshot);
      } catch {
        const list = $("[data-repos]");
        const empty = $("[data-repos-empty]");
        if (list) {
          list.hidden = true;
          list.setAttribute("aria-busy", "false");
        }
        if (empty) empty.hidden = false;
      }
    }
  } finally {
    if (button) button.removeAttribute("data-busy");
  }
}

/* ---------- motion ---------- */

function initReveal() {
  const items = $$(".reveal");
  if (!items.length) return;
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((node) => node.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  items.forEach((node) => io.observe(node));
}

function initParallax() {
  const targets = $$("[data-parallax]");
  if (!targets.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    targets.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.bottom < -vh || rect.top > vh * 2) return;
      const factor = parseFloat(node.dataset.parallax) || 0.06;
      const offset = (rect.top + rect.height / 2 - vh / 2) * -factor;
      const clamped = Math.max(-70, Math.min(70, offset));
      node.style.setProperty("--py", `${clamped.toFixed(1)}px`);
    });
    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

/* ---------- boot ---------- */

const refreshBtn = $("[data-refresh]");
if (refreshBtn) refreshBtn.addEventListener("click", () => load(true));

initReveal();
initParallax();
load();

// 页面重新可见且缓存过期时，静默再取一次
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const cached = readCache();
  if (!cached || Date.now() - new Date(cached.syncedAt).getTime() > CACHE_TTL) load();
});
