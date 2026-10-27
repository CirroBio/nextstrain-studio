// Recognizes Auspice datasets by file name, as docs/dataset-layout.md describes: a main JSON and
// the sidecars that share its stem in the same folder. Narratives are listed separately.

export const SIDECARS = ["tip-frequencies", "root-sequence", "measurements"] as const;
export type Sidecar = (typeof SIDECARS)[number];

export type AuspiceDataset<F> = {
  // Folder plus stem, e.g. "auspice/zika"; the dataset's name in links.
  path: string;
  main: F;
  sidecars: Partial<Record<Sidecar, F>>;
};

const JSON_NAME = /^(.*?)(?:_(tip-frequencies|root-sequence|measurements))?\.json(?:\.gz)?$/i;

type Parsed = { path: string; sidecar?: Sidecar };

export function parseAuspiceName(path: string): Parsed | null {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash + 1);
  const m = JSON_NAME.exec(path.slice(slash + 1));
  if (!m || !m[1]) return null;
  return { path: folder + m[1], sidecar: m[2]?.toLowerCase() as Sidecar | undefined };
}

export function groupAuspiceFiles<F>(files: F[], pathOf: (f: F) => string): AuspiceDataset<F>[] {
  const parsed = files.map((f) => ({ f, p: parseAuspiceName(pathOf(f)) })).filter((x): x is { f: F; p: Parsed } => x.p !== null);
  const byPath = new Map<string, AuspiceDataset<F>>();
  for (const { f, p } of parsed) if (!p.sidecar) byPath.set(p.path, { path: p.path, main: f, sidecars: {} });
  for (const { f, p } of parsed) {
    const dataset = p.sidecar && byPath.get(p.path);
    if (dataset) dataset.sidecars[p.sidecar!] = f;
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

// The file name the viewer is given. Auspice reads "_" in a name as "/", and attaches sidecars by
// the shared stem, so every file of one dataset gets the same stem. A ".gz" ending tells it to
// decompress.
export function viewerFileName(stem: string, sidecar?: Sidecar, gzipped = false): string {
  const safe = stem.replace(/[^A-Za-z0-9_-]+/g, "_");
  return `${safe}${sidecar ? `_${sidecar}` : ""}.json${gzipped ? ".gz" : ""}`;
}
