import type { FileSystemObject } from "@cirrobio/sdk";
import type { Cirro } from "./cirro";
import { readHead } from "./projectBuilds";
import { addNote } from "./provenance";
import { APP_TAG } from "../app/appInfo";

export type LaunchRequest = {
  projectId: string;
  processId: string;
  processName: string;
  name: string;
  description: string;
  inputs: { id: string; name: string }[];
  params: Record<string, unknown>;
};

// Keys left empty are left out, so the pipeline takes its default: Nextflow would take an explicit
// null as the value (docs/pipeline-params.md).
export function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

export async function launch(cirro: Cirro, req: LaunchRequest): Promise<{ datasetId: string; problem: string | null }> {
  const params = cleanParams(req.params);
  const run = await cirro.data.execution.runAnalysis({
    projectId: req.projectId,
    runAnalysisRequest: {
      name: req.name,
      description: req.description,
      processId: req.processId,
      sourceDatasetIds: req.inputs.map((i) => i.id),
      params,
      tags: [APP_TAG],
    },
  });
  const problem = await addNote(cirro, req.projectId, run.id, { what: `${req.processName} run "${req.name}".`, inputs: req.inputs, parameters: params });
  return { datasetId: run.id, problem };
}

// The header of a delimited table, to offer its column names.
const HEADER_BYTES = 64 * 1024;

export async function tableColumns(cirro: Cirro, file: FileSystemObject): Promise<string[]> {
  const first = (await readHead(cirro, file, HEADER_BYTES)).split(/\r?\n/, 1)[0];
  const sep = /\.csv$/i.test(file.relativePath) ? "," : "\t";
  return first.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")).filter(Boolean);
}
