// Checks catalog/datasets.json: required fields, unique ids, and that every dataset opens as an
// Auspice v2 JSON from where the app will fetch it. Run by CI on every pull request.
import { readFileSync } from "node:fs";

const CHARON = "https://nextstrain.org/charon/getDataset";
const REQUIRED = ["id", "title", "pathogen", "maintainer", "source", "description"];

const { datasets } = JSON.parse(readFileSync(new URL("./datasets.json", import.meta.url), "utf8"));
const problems = [];
const ids = new Set();

const urlOf = (source) =>
  source.nextstrain !== undefined ? `${CHARON}?prefix=${encodeURIComponent(source.nextstrain.replace(/^\/+|\/+$/g, ""))}` : source.url;

async function check(d) {
  const missing = REQUIRED.filter((k) => !d[k]);
  if (missing.length) return `${d.id ?? JSON.stringify(d.title)}: missing ${missing.join(", ")}`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) return `${d.id}: id must be lowercase letters, digits and dashes`;
  if (ids.has(d.id)) return `${d.id}: duplicate id`;
  ids.add(d.id);
  const kinds = ["nextstrain", "url"].filter((k) => d.source[k] !== undefined);
  if (kinds.length !== 1) return `${d.id}: source needs exactly one of nextstrain or url`;
  if (d.source.url !== undefined && !d.source.url.startsWith("https://")) return `${d.id}: url must be https`;
  const url = urlOf(d.source);
  // The app fetches from another site, so the dataset must allow cross-site reads.
  const res = await fetch(url, { headers: { Accept: "application/json", Origin: "https://example.org" } });
  if (!res.ok) return `${d.id}: ${url} answered HTTP ${res.status}`;
  const cors = res.headers.get("access-control-allow-origin");
  if (cors !== "*" && cors !== "https://example.org") return `${d.id}: ${url} doesn't allow cross-site reads (no Access-Control-Allow-Origin)`;
  const json = await res.json().catch(() => null);
  if (!json?.meta || !json?.tree) return `${d.id}: ${url} isn't an Auspice v2 dataset (no meta and tree)`;
  return null;
}

for (const d of datasets) {
  const problem = await check(d).catch((e) => `${d.id}: ${e.message}`);
  console.log(`${problem ? "FAIL" : "ok  "} ${d.id}`);
  if (problem) problems.push(problem);
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`\n${datasets.length} datasets ok`);
