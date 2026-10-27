import { ProcessResource, RepositoryType } from "@cirrobio/api-client";
import buildForm from "../../pipelines/build/cirro/process-form.json";
import buildInput from "../../pipelines/build/cirro/process-input.json";
import buildOutput from "../../pipelines/build/cirro/process-output.json";
import buildCompute from "../../pipelines/build/cirro/process-compute.config?raw";
import treeForm from "../../pipelines/build-from-tree/cirro/process-form.json";
import treeInput from "../../pipelines/build-from-tree/cirro/process-input.json";
import treeOutput from "../../pipelines/build-from-tree/cirro/process-output.json";
import treeCompute from "../../pipelines/build-from-tree/cirro/process-compute.config?raw";
import nextcladeForm from "../../pipelines/nextclade/cirro/process-form.json";
import nextcladeInput from "../../pipelines/nextclade/cirro/process-input.json";
import nextcladeOutput from "../../pipelines/nextclade/cirro/process-output.json";
import nextcladeCompute from "../../pipelines/nextclade/cirro/process-compute.config?raw";
import ingestForm from "../../pipelines/ingest-ncbi/cirro/process-form.json";
import ingestInput from "../../pipelines/ingest-ncbi/cirro/process-input.json";
import ingestOutput from "../../pipelines/ingest-ncbi/cirro/process-output.json";
import ingestCompute from "../../pipelines/ingest-ncbi/cirro/process-compute.config?raw";

// This app's pipelines as Cirro process records. The app registers them itself, in each project
// where a user with permission sets it up (src/cirro/setup.ts), with the configuration bundled in
// this build, so the form a run gets always matches the app that launches it.

// The code is read from this repository at the commit the app was built from.
export const PIPELINE_REPOSITORY = "CirroBio/nextstrain-studio";
export const PIPELINE_VERSION = __PIPELINE_VERSION__;
// GITHUB_PRIVATE while the repository is private: only tenants with Cirro's GitHub app authorized
// for CirroBio can read it. It becomes GITHUB_PUBLIC when the repository is published.
export const PIPELINE_REPOSITORY_TYPE = RepositoryType.GithubPrivate;

export type PipelineKey = "ingest" | "build" | "buildFromTree" | "nextclade";

export type PipelineDefinition = {
  key: PipelineKey;
  // Fixed across tenants and stable once used: runs and the app find the process by it.
  id: string;
  name: string;
  description: string;
  dataType: string;
  entryPoint: string;
  parents: string[];
  files: { type: ProcessResource; content: string }[];
};

const json = (value: unknown) => JSON.stringify(value, null, 2);
const config = (form: unknown, input: unknown, output: unknown, compute: string) => [
  { type: ProcessResource.Form, content: json(form) },
  { type: ProcessResource.Input, content: json(input) },
  { type: ProcessResource.Output, content: json(output) },
  { type: ProcessResource.Compute, content: compute },
];

const INGEST_ID = "nextstrain-studio-ingest-ncbi";
const FILES = "custom_dataset";

// Listed so that a parent is registered before the pipelines that name it.
export const PIPELINE_DEFINITIONS: PipelineDefinition[] = [
  {
    key: "ingest",
    id: INGEST_ID,
    name: "Nextstrain NCBI Virus ingest",
    description: "Downloads a virus's genomes and metadata from NCBI Virus and curates them the way Nextstrain's pathogen workflows do, ready to build from.",
    dataType: "Sequences and metadata",
    entryPoint: "pipelines/ingest-ncbi/main.nf",
    parents: [FILES],
    files: config(ingestForm, ingestInput, ingestOutput, ingestCompute),
  },
  {
    key: "build",
    id: "nextstrain-studio-build",
    name: "Nextstrain build",
    description: "Filters, aligns and builds a time-resolved phylogeny with augur from sequences and metadata, and exports it for Auspice.",
    dataType: "Nextstrain dataset",
    entryPoint: "pipelines/build/main.nf",
    parents: [FILES, INGEST_ID],
    files: config(buildForm, buildInput, buildOutput, buildCompute),
  },
  {
    key: "buildFromTree",
    id: "nextstrain-studio-build-from-tree",
    name: "Nextstrain build from tree",
    description: "Turns an existing Newick tree and its metadata into a Nextstrain dataset: traits, a map and the Auspice view.",
    dataType: "Nextstrain dataset",
    entryPoint: "pipelines/build-from-tree/main.nf",
    parents: [FILES],
    files: config(treeForm, treeInput, treeOutput, treeCompute),
  },
  {
    key: "nextclade",
    id: "nextstrain-studio-nextclade",
    name: "Nextclade",
    description: "Assigns clades and checks sequence quality with Nextclade, and places the sequences on the dataset's reference tree for Auspice.",
    dataType: "Nextclade results",
    entryPoint: "pipelines/nextclade/main.nf",
    parents: [FILES, INGEST_ID],
    files: config(nextcladeForm, nextcladeInput, nextcladeOutput, nextcladeCompute),
  },
];

export const pipelineDefinition = (key: PipelineKey) => PIPELINE_DEFINITIONS.find((p) => p.key === key)!;
