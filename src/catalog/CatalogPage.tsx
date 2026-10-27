import { useMemo, useState } from "react";
import catalog from "../../catalog/datasets.json";
import { useAsync } from "../cirro/useAsync";
import { nextstrainPath } from "../viewer/sources";
import type { Route } from "../app/route";

export type CatalogEntry = {
  id: string;
  title: string;
  pathogen: string;
  maintainer: string;
  description: string;
  tags?: string[];
  source: { nextstrain: string } | { url: string };
};

const ENTRIES = catalog.datasets as CatalogEntry[];
const CONTRIBUTE_URL = "https://github.com/CirroBio/nextstrain-studio/blob/main/catalog/README.md";

export const routeOfEntry = (e: CatalogEntry): Route =>
  "nextstrain" in e.source ? { page: "view-nextstrain", path: nextstrainPath(e.source.nextstrain) } : { page: "view-url", url: e.source.url };

// Everything nextstrain.org lists, for browsing beyond the curated catalog. Community datasets
// aren't listed there; the catalog is where they are found.
async function nextstrainDatasets(signal: AbortSignal): Promise<string[]> {
  const res = await fetch("https://nextstrain.org/charon/getAvailable", { headers: { Accept: "application/json" }, signal });
  if (!res.ok) throw new Error(`nextstrain.org answered HTTP ${res.status}.`);
  const { datasets } = (await res.json()) as { datasets: { request: string }[] };
  return datasets.map((d) => d.request).filter((r) => !r.startsWith("staging/"));
}

const matches = (e: CatalogEntry, q: string) => [e.title, e.pathogen, e.maintainer, e.description, ...(e.tags ?? [])].some((s) => s.toLowerCase().includes(q));

export function CatalogPage({ go }: { go: (r: Route) => void }) {
  const [query, setQuery] = useState("");
  const [address, setAddress] = useState("");
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const byPathogen = new Map<string, CatalogEntry[]>();
    for (const e of ENTRIES.filter((e) => !q || matches(e, q))) byPathogen.set(e.pathogen, [...(byPathogen.get(e.pathogen) ?? []), e]);
    return [...byPathogen.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [q]);
  const all = useAsync((signal) => nextstrainDatasets(signal), []);
  const listed = all.status === "ready" ? all.value.filter((p) => !q || p.toLowerCase().includes(q)) : [];

  const openAddress = () => {
    const text = address.trim();
    if (/^https:\/\//i.test(text) && !/^https:\/\/(www\.)?nextstrain\.org/i.test(text)) go({ page: "view-url", url: text });
    else if (nextstrainPath(text)) go({ page: "view-nextstrain", path: nextstrainPath(text) });
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1 className="title">Public datasets</h1>
        <a className="button button-small" href={CONTRIBUTE_URL} target="_blank" rel="noreferrer">Add a dataset</a>
      </div>
      <p className="page-lede">
        Curated Nextstrain datasets, maintained by the groups named on each. They open here from where they're published, and anyone can add one with a pull request to this app's catalog.
      </p>

      <form className="open-box" onSubmit={(e) => { e.preventDefault(); openAddress(); }}>
        <label className="field" style={{ flex: "1 1 360px" }}>
          <span className="field-label">Open any dataset by its nextstrain.org path or a URL</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="flu/seasonal/h3n2/ha/2y, community/owner/repo/name, or https://…/dataset.json" spellCheck={false} />
        </label>
        <button className="button button-primary" disabled={!address.trim()}>Open</button>
      </form>

      <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by pathogen, maintainer or tag" aria-label="Filter datasets" />

      {groups.length === 0 && <p className="muted">No catalog dataset matches "{query}".</p>}
      {groups.map(([pathogen, entries]) => (
        <section key={pathogen} className="pathogen-group">
          <h2>{pathogen}</h2>
          <ul className="card-list">
            {entries.map((e) => (
              <li key={e.id}>
                <button className="list-card" onClick={() => go(routeOfEntry(e))}>
                  <span className="list-card-title">{e.title}</span>
                  <span className="muted">{e.description}</span>
                  <span className="list-card-meta">
                    <span>{e.maintainer}</span>
                    {e.tags?.map((t) => <span key={t} className="tag">{t}</span>)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="section">
        <h2>Everything on nextstrain.org</h2>
        {all.status === "loading" && <p className="muted">Asking nextstrain.org…</p>}
        {all.status === "error" && <p className="error-text">Couldn't list nextstrain.org datasets: {all.error}</p>}
        {all.status === "ready" && (
          <>
            <p className="muted">{listed.length} of {all.value.length} datasets{q ? ` match "${query}"` : ""}.</p>
            <ul className="path-list">
              {listed.map((p) => (
                <li key={p}><button className="link-button" onClick={() => go({ page: "view-nextstrain", path: p })}>{p}</button></li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
