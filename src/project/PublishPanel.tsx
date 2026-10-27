import { useEffect, useMemo, useRef, useState } from "react";

// Publishing means putting the files where nextstrain.org serves community datasets from: a
// public GitHub repository, whose auspice/<repo>_<name>.json shows at
// nextstrain.org/community/<owner>/<repo>/<name>. From there anyone can add it to this app's
// catalog. https://docs.nextstrain.org/en/latest/guides/share/community-builds.html
const COMMUNITY_DOCS = "https://docs.nextstrain.org/en/latest/guides/share/community-builds.html";
const CATALOG_EDIT = "https://github.com/CirroBio/nextstrain-studio/edit/main/catalog/datasets.json";
const SLUG = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

// The viewer's files are named <stem>[_<sidecar>].json[.gz]; on GitHub they become
// <repo>_<name>[_<sidecar>].json, uncompressed names being what nextstrain.org looks for.
export function communityFileName(viewerName: string, repo: string, name: string): string {
  const sidecar = /_(tip-frequencies|root-sequence|measurements)\.json/.exec(viewerName)?.[1];
  const base = `${repo}_${name.replaceAll("/", "_")}`;
  return `${sidecar ? `${base}_${sidecar}` : base}.json${viewerName.endsWith(".gz") ? ".gz" : ""}`;
}

export function PublishPanel({ files, title, onClose }: { files: File[]; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [name, setName] = useState(files[0]?.name.replace(/(_(tip-frequencies|root-sequence|measurements))?\.json(\.gz)?$/, "").replaceAll("_", "-") ?? "");
  const ready = SLUG.test(owner) && SLUG.test(repo) && /^[A-Za-z0-9][A-Za-z0-9/-]*$/.test(name);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  useEffect(() => dialog.current?.showModal(), []);

  const path = `community/${owner}/${repo}/${name}`;
  const entry = {
    id: `${owner}-${repo}-${name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    title,
    pathogen: "",
    maintainer: owner,
    source: { nextstrain: path },
    description: "",
    tags: [],
  };

  return (
    <dialog ref={dialog} className="card dialog" onClose={onClose}>
      <h2 className="title">Publish this build</h2>
      <p className="notice">
        Published builds are public to anyone. Before publishing, check that every sequence and metadata field may be shared openly: data-use terms (for example GISAID's), patient privacy, and your partners' agreements.
      </p>
      <ol className="steps">
        <li>
          <h3>1. Name it on nextstrain.org</h3>
          <div className="form-row" style={{ marginTop: 0 }}>
            <label className="field"><span className="field-label">GitHub owner</span><input value={owner} onChange={(e) => setOwner(e.target.value.trim())} placeholder="your-lab" /></label>
            <label className="field"><span className="field-label">Public repository</span><input value={repo} onChange={(e) => setRepo(e.target.value.trim())} placeholder="outbreak-builds" /></label>
            <label className="field"><span className="field-label">Dataset name</span><input value={name} onChange={(e) => setName(e.target.value.trim())} placeholder="h5n1/2026" /></label>
          </div>
          {ready && <p className="muted">It will be at <code>nextstrain.org/{path}</code>.</p>}
        </li>
        <li>
          <h3>2. Add these files to the repository's <code>auspice/</code> folder</h3>
          {ready ? (
            <ul className="plain-list">
              {files.map((f, i) => (
                <li key={f.name}><a href={urls[i]} download={communityFileName(f.name, repo, name)}>{communityFileName(f.name, repo, name)}</a></li>
              ))}
            </ul>
          ) : (
            <p className="muted">Fill in the names above to get the files named the way nextstrain.org expects.</p>
          )}
          <p className="muted">Commit and push them; nextstrain.org shows the dataset as soon as GitHub has it. <a href={COMMUNITY_DOCS} target="_blank" rel="noreferrer">Nextstrain's guide to community builds</a></p>
        </li>
        <li>
          <h3>3. List it in Nextstrain Studio's catalog (optional)</h3>
          <p className="muted">Add this entry to <code>catalog/datasets.json</code> with a pull request, filling in the pathogen and a one-line description:</p>
          <pre className="code-block">{JSON.stringify(entry, null, 2)}</pre>
          <a className="button button-small" href={CATALOG_EDIT} target="_blank" rel="noreferrer">Edit the catalog on GitHub</a>
        </li>
      </ol>
      <div className="form-actions">
        <button className="button" onClick={() => dialog.current?.close()}>Close</button>
      </div>
    </dialog>
  );
}
