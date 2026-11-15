// 把 GitHub 公开仓库抓成静态快照，供页面在 API 不可用时兜底，也让首页有稳定的初始内容。
// 用法：node scripts/sync-repos.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USER = process.env.GH_USER || "flulwh";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../data/repos.json");
const SELF_REPO = "flulwh.github.io";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "flulwh-portfolio-sync",
};
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`, {
  headers,
});

if (!res.ok) {
  console.error(`GitHub API ${res.status} ${res.statusText}`);
  process.exit(1);
}

const raw = await res.json();
const repos = raw
  .filter((repo) => repo.name !== SELF_REPO)
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .map((repo) => ({
    name: repo.name,
    description: repo.description || "",
    html_url: repo.html_url,
    language: repo.language || "",
    stargazers_count: repo.stargazers_count || 0,
    forks_count: repo.forks_count || 0,
    pushed_at: repo.pushed_at,
    created_at: repo.created_at,
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    topics: repo.topics || [],
  }));

const payload = { syncedAt: new Date().toISOString(), repos };

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`wrote ${repos.length} repos -> ${OUT}`);
