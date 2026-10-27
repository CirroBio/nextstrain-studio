import { ManifestParser, ProjectFileAccessContext, type FileSystemObject } from "@cirrobio/sdk";
import { Status, type Dataset, type Process } from "@cirrobio/api-client";
import { retryRateLimited, type Cirro } from "./cirro";
import { groupAuspiceFiles, type AuspiceDataset } from "../viewer/auspiceFiles";
import { PIPELINE_DEFINITIONS } from "./pipelines";
import { APP_ID } from "../app/appInfo";

// What a project holds, as this app sees it (docs/dataset-layout.md). This app's pipelines have
// the same process IDs in every tenant, because the app registers them itself.

const PIPELINE_IDS = PIPELINE_DEFINITIONS.map((p) => p.id);
export const FILES_PROCESS = "custom_dataset";

// Datasets whose files are listed at once; more would trip the per-user rate limit.
const SCAN_CONCURRENCY = 4;

export async function listDatasets(cirro: Cirro, projectId: string): Promise<Dataset[]> {
  const out: Dataset[] = [];
  let nextToken: string | undefined;
  do {
    const page = await retryRateLimited(() => cirro.data.datasets.getDatasets({ projectId, limit: 1000, nextToken }));
    out.push(...page.data);
    nextToken = page.nextToken || undefined;
  } while (nextToken);
  return out;
}

// Cached per session; a failed request is forgotten so that trying again asks Cirro again.
const processes = new WeakMap<Cirro, Promise<Process[]>>();
function listProcesses(cirro: Cirro): Promise<Process[]> {
  let cached = processes.get(cirro);
  if (!cached) {
    cached = retryRateLimited(() => cirro.data.processes.getProcesses({}));
    processes.set(cirro, cached);
    cached.catch(() => processes.delete(cirro));
  }
  return cached;
}

// The dataset's detail says whether it is shared from another project, which decides how its
// files are read.
export async function datasetFiles(cirro: Cirro, projectId: string, datasetId: string): Promise<FileSystemObject[]> {
  const [detail, first] = await Promise.all([
    retryRateLimited(() => cirro.data.datasets.getDataset({ projectId, datasetId })),
    retryRateLimited(() => cirro.data.datasets.getDatasetManifest({ projectId, datasetId })),
  ]);
  const files = [...(first.files ?? [])];
  const total = first.totalFiles ?? files.length;
  while (files.length < total) {
    const page = await retryRateLimited(() => cirro.data.datasets.getDatasetManifest({ projectId, datasetId, fileOffset: files.length }));
    if (!page.files?.length) throw new Error(`Cirro listed ${files.length} of the ${total} files in ${detail.name}, then no more.`);
    files.push(...page.files);
  }
  const parser = new ManifestParser({ ...first, files }, ProjectFileAccessContext.datasetDownload({ id: projectId }, detail));
  return [...parser.generateAssets()];
}

// Cirro lists a dataset's files under the data/ prefix its outputs are stored under.
export const filePath = (f: FileSystemObject) => f.relativePath.replace(/^data\//, "");

export async function readFile(cirro: Cirro, file: FileSystemObject): Promise<Blob> {
  const res = await retryRateLimited(() => cirro.files.getProjectFile(file));
  if (!res.ok) throw new Error(`Couldn't read ${filePath(file)} (HTTP ${res.status}).`);
  return res.blob();
}

export type Build = { dataset: Dataset; process: string; auspice: AuspiceDataset<FileSystemObject>[] };

export type ProjectContents = {
  builds: Build[];
  // Pipeline runs that haven't finished, or failed: shown so the user knows what's coming.
  running: { dataset: Dataset; process: string }[];
  // Completed datasets that may hold sequences and metadata to build from.
  inputs: { dataset: Dataset; process: string }[];
};

const isAppTagged = (d: Dataset) => d.tags.some((t) => t.value === APP_ID);

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

export async function projectContents(cirro: Cirro, projectId: string): Promise<ProjectContents> {
  const [datasets, all] = await Promise.all([listDatasets(cirro, projectId), listProcesses(cirro)]);
  const names = new Map(all.map((p) => [p.id, p.name]));
  const processName = (d: Dataset) => names.get(d.processId) ?? d.processId;
  const newest = (a: Dataset, b: Dataset) => +b.createdAt - +a.createdAt;
  const ours = (d: Dataset) => PIPELINE_IDS.includes(d.processId);
  const done = datasets.filter((d) => d.status === Status.Completed).sort(newest);
  const candidates = done.filter((d) => ours(d) || isAppTagged(d) || d.processId === FILES_PROCESS);
  const scanned = await inBatches(candidates, SCAN_CONCURRENCY, async (dataset) => {
    // A pipeline's results/ holds node-data JSONs, which aren't datasets.
    const files = (await datasetFiles(cirro, projectId, dataset.id)).filter((f) => !ours(dataset) || filePath(f).startsWith("auspice/"));
    return { dataset, process: processName(dataset), auspice: groupAuspiceFiles(files, filePath) };
  });
  return {
    builds: scanned.filter((b) => b.auspice.length > 0),
    running: datasets.filter((d) => ours(d) && d.status !== Status.Completed).sort(newest).map((d) => ({ dataset: d, process: processName(d) })),
    inputs: done.filter((d) => !scanned.some((b) => b.dataset.id === d.id && b.auspice.length > 0)).map((d) => ({ dataset: d, process: processName(d) })),
  };
}
