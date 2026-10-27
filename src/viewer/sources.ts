import { SIDECARS, viewerFileName, type AuspiceDataset } from "./auspiceFiles";

// Where a dataset shown in the viewer comes from. Each source fetches its files in the studio,
// with the studio's access, and hands them to the sandboxed viewer as File objects.
export type ViewerSource = {
  title: string;
  // Where it lives, in words: "nextstrain.org/zika", a URL, a Cirro dataset.
  origin: string;
  load: (signal: AbortSignal) => Promise<File[]>;
};

// nextstrain.org answers any site for its datasets (core, staging, community and groups) through
// the same API Auspice itself uses there.
const CHARON = "https://nextstrain.org/charon/getDataset";

// A nextstrain.org path as people write it: "zika", "/flu/seasonal/h3n2/ha/2y" or a full URL.
export function nextstrainPath(text: string): string {
  return text.trim().replace(/^https?:\/\/(www\.)?nextstrain\.org/i, "").replace(/[?#].*$/, "").replace(/^\/+|\/+$/g, "");
}

async function fetchFile(url: string, name: string, signal: AbortSignal, init?: RequestInit): Promise<File> {
  const res = await fetch(url, { ...init, signal });
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}.`);
  // A dev server answers a missing file with the app's own HTML page.
  if (res.headers.get("content-type")?.includes("text/html")) throw new Error(`${url} is a web page, not a dataset file.`);
  return new File([await res.blob()], name);
}

// Sidecars are optional: a missing one leaves its panel out rather than failing the dataset.
async function optional(file: Promise<File>): Promise<File | null> {
  try {
    return await file;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return null;
  }
}

const present = (files: (File | null)[]) => files.filter((f): f is File => f !== null);

export function nextstrainSource(path: string): ViewerSource {
  const json = { headers: { Accept: "application/json" } };
  const url = (type?: string) => `${CHARON}?prefix=${encodeURIComponent(path)}${type ? `&type=${type}` : ""}`;
  return {
    title: path,
    origin: `nextstrain.org/${path}`,
    async load(signal) {
      const main = fetchFile(url(), viewerFileName(path), signal, json).catch((e) => {
        throw new Error(`nextstrain.org has no dataset at /${path}. (${e instanceof Error ? e.message : e})`);
      });
      const sidecars = SIDECARS.map((s) => optional(fetchFile(url(s), viewerFileName(path, s), signal, json)));
      return present(await Promise.all([main, ...sidecars]));
    },
  };
}

// The URL of a main dataset JSON anywhere that allows cross-site reads (GitHub raw files, S3
// buckets with CORS). Sidecars are looked for next to it, by Nextstrain's naming.
export function urlSource(mainUrl: string): ViewerSource {
  const u = new URL(mainUrl);
  const gzipped = u.pathname.endsWith(".gz");
  const stemUrl = mainUrl.replace(/\.json(\.gz)?([?#].*)?$/i, "");
  const stem = decodeURIComponent(u.pathname.split("/").pop()!.replace(/\.json(\.gz)?$/i, ""));
  return {
    title: stem,
    origin: u.host + u.pathname,
    async load(signal) {
      const main = fetchFile(mainUrl, viewerFileName(stem, undefined, gzipped), signal);
      const sidecars = SIDECARS.map((s) => optional(fetchFile(`${stemUrl}_${s}.json`, viewerFileName(stem, s), signal)));
      return present(await Promise.all([main, ...sidecars]));
    },
  };
}

// An Auspice dataset whose files the caller can read, such as one in a Cirro dataset.
export function readerSource<F>(title: string, origin: string, dataset: AuspiceDataset<F>, read: (f: F, signal: AbortSignal) => Promise<Blob>, nameOf: (f: F) => string): ViewerSource {
  const stem = dataset.path.split("/").pop()!;
  const named = async (f: F, sidecar: (typeof SIDECARS)[number] | undefined, signal: AbortSignal) =>
    new File([await read(f, signal)], viewerFileName(stem, sidecar, nameOf(f).endsWith(".gz")));
  return {
    title,
    origin,
    async load(signal) {
      const main = named(dataset.main, undefined, signal);
      const sidecars = SIDECARS.map((s) => (dataset.sidecars[s] ? named(dataset.sidecars[s]!, s, signal) : null));
      return present(await Promise.all([main, ...sidecars]));
    },
  };
}

// Files the user picked or dropped, passed through as they are: the viewer itself recognizes
// datasets, sidecars, Newick trees, narratives and metadata tables by name.
export function localSource(files: File[]): ViewerSource {
  const main = files.find((f) => /\.(json|nwk|newick|new)(\.gz)?$/i.test(f.name) && !/_(tip-frequencies|root-sequence|measurements)\.json/i.test(f.name));
  return {
    title: main?.name.replace(/\.(json|nwk|newick|new)(\.gz)?$/i, "") ?? files[0]?.name ?? "Local files",
    origin: "Files on this computer",
    load: async () => files,
  };
}
