import { useState } from "react";
import { useSignedIn } from "../cirro/cirro";
import { useAsync } from "../cirro/useAsync";
import type { Route } from "../app/route";

export function ProjectsPage({ go }: { go: (r: Route) => void }) {
  const cirro = useSignedIn();
  const projects = useAsync(() => cirro.data.projects.getProjects(), [cirro]);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  return (
    <main className="page">
      <h1 className="title">Projects in {cirro.tenantName}</h1>
      <p className="page-lede">Pick the project whose Nextstrain builds you want to open, or where you want to upload or run a build.</p>
      {projects.status === "loading" && <p className="muted">Loading projects…</p>}
      {projects.status === "error" && <p className="error-text">Couldn't list your projects: {projects.error}</p>}
      {projects.status === "ready" && projects.value.length === 0 && <p>You aren't a member of any project in {cirro.tenantName} yet.</p>}
      {projects.status === "ready" && projects.value.length > 0 && (
        <>
          <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter projects" aria-label="Filter projects" autoFocus />
          <ul className="card-list">
            {projects.value.filter((p) => !q || p.name.toLowerCase().includes(q)).map((p) => (
              <li key={p.id}>
                <button className="list-card" onClick={() => go({ page: "project", project: p.id })}>
                  <span className="list-card-title">{p.name}</span>
                  {p.description && <span className="muted">{p.description}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
