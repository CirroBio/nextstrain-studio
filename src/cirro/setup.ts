import { ApiError } from "@cirrobio/sdk";
import { ConfigSource, Executor, SyncStatus, type CustomProcessInput, type ProcessDetail } from "@cirrobio/api-client";
import { describeError, refusedPermission, retryRateLimited, type Cirro } from "./cirro";
import { PIPELINE_DEFINITIONS, PIPELINE_REPOSITORY, PIPELINE_REPOSITORY_TYPE, PIPELINE_VERSION, type PipelineDefinition } from "./pipelines";
import { APP_NAME, APP_TAG } from "../app/appInfo";

// A project is set up for this app's pipelines when each is registered, linked to the project, and
// configured from the commit this build of the app was made from. Viewing and uploading builds need
// none of this; only running pipelines does. Setting up is done once per project, from the app.
//
// What Cirro asks of the user (Cirro-backend ProcessService):
// - registering a pipeline needs CREATE_CUSTOM_PIPELINE, in the project and globally. The app
//   registers with its configuration read from this public repository at that commit, which Cirro
//   fetches in the same call, so nothing more is needed;
// - changing a registered pipeline (linking another project, moving it to another commit, saving
//   or syncing its configuration) also needs MANAGE_CUSTOM_PIPELINES, as its owner or a maintainer.

export type PipelineStatus =
  | { status: "ready"; process: ProcessDetail }
  // Registered and linked, but configured from another commit than this app's build.
  | { status: "outdated"; process: ProcessDetail }
  // Registered and linked, but without its configuration (a failed sync, or never saved).
  | { status: "unconfigured"; process: ProcessDetail }
  // Registered, but for other projects only.
  | { status: "unlinked"; process: ProcessDetail }
  | { status: "archived"; process: ProcessDetail }
  | { status: "missing" };

export type PipelineState = { definition: PipelineDefinition } & PipelineStatus;

const DOCS_URL = `https://github.com/${PIPELINE_REPOSITORY}/tree/main/pipelines`;

// hasStoredConfig matters only for a pipeline whose configuration is kept in Cirro (STORAGE): it
// says whether a revision was ever saved.
export function statusOf(process: ProcessDetail, projectId: string, hasStoredConfig: boolean): PipelineStatus {
  if (process.isArchived) return { status: "archived", process };
  if (!process.isTenantWide && !process.linkedProjectIds.includes(projectId)) return { status: "unlinked", process };
  const configured = process.configSource === ConfigSource.Storage ? hasStoredConfig : process.customSettings?.syncStatus === SyncStatus.Successful;
  if (!configured) return { status: "unconfigured", process };
  const configVersion = process.configSource === ConfigSource.Storage ? process.pipelineCode?.version : process.customSettings?.branch;
  if (process.pipelineCode?.version !== PIPELINE_VERSION || configVersion !== PIPELINE_VERSION) return { status: "outdated", process };
  return { status: "ready", process };
}

async function hasStoredConfig(cirro: Cirro, process: ProcessDetail): Promise<boolean> {
  if (process.configSource !== ConfigSource.Storage) return false;
  try {
    await retryRateLimited(() => cirro.data.processes.getLatestProcessRevision({ processId: process.id }));
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.errorCode === 404) return false;
    throw e;
  }
}

export async function pipelineStates(cirro: Cirro, projectId: string): Promise<PipelineState[]> {
  const visible = new Set((await retryRateLimited(() => cirro.data.processes.getProcesses({ includeArchived: true }))).map((p) => p.id));
  return Promise.all(
    PIPELINE_DEFINITIONS.map(async (definition) => {
      if (!visible.has(definition.id)) return { definition, status: "missing" as const };
      const process = await retryRateLimited(() => cirro.data.processes.getProcess({ processId: definition.id }));
      return { definition, ...statusOf(process, projectId, await hasStoredConfig(cirro, process)) };
    })
  );
}

export const isReady = (states: PipelineState[]) => states.every((s) => s.status === "ready");

function processInput(d: PipelineDefinition, linkedProjectIds: string[]): CustomProcessInput {
  return {
    id: d.id,
    name: d.name,
    description: `${d.description} Registered by ${APP_NAME}.`,
    dataType: d.dataType,
    executor: Executor.Nextflow,
    category: "Microbial Analysis",
    parentProcessIds: d.parents,
    childProcessIds: [],
    documentationUrl: `${DOCS_URL}/${d.folder}`,
    pipelineCode: { repositoryPath: PIPELINE_REPOSITORY, version: PIPELINE_VERSION, repositoryType: PIPELINE_REPOSITORY_TYPE, entryPoint: `pipelines/${d.folder}/main.nf` },
    linkedProjectIds,
    isTenantWide: false,
    allowMultipleSources: false,
    usesSampleSheet: false,
    configSource: ConfigSource.WithProcess,
    // A commit, not a branch, so the configuration can't move away from the code it describes.
    customSettings: { repository: PIPELINE_REPOSITORY, branch: PIPELINE_VERSION, folder: `pipelines/${d.folder}/cirro`, repositoryType: PIPELINE_REPOSITORY_TYPE },
    tags: [APP_TAG],
  };
}

// Plain words for a refusal: which step, which permission, and who can do it instead.
function stepError(e: unknown, d: PipelineDefinition, step: string, process?: ProcessDetail): Error {
  const perm = refusedPermission(e);
  if (perm === "MANAGE_CUSTOM_PIPELINES") {
    return new Error(
      `Cirro didn't let ${APP_NAME} ${step} "${d.name}": that needs MANAGE_CUSTOM_PIPELINES, which this app's registration in Cirro doesn't grant, or which you lack for a pipeline registered by ${process?.owner ?? "someone else"}. A Cirro admin can add the permission to the app; the pipeline's owner can do this step.`
    );
  }
  if (perm || (e instanceof ApiError && e.errorCode === 403)) {
    return new Error(`Cirro didn't let you ${step} "${d.name}"${perm ? ` (it needs ${perm})` : ""}. Setting up needs a project member who may add custom pipelines (a pipeline developer); ask your project's owner or a Cirro admin. Cirro said: ${describeError(e)}`);
  }
  return new Error(`Couldn't ${step} "${d.name}": ${describeError(e)}`);
}

async function step<T>(d: PipelineDefinition, name: string, process: ProcessDetail | undefined, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw stepError(e, d, name, process);
  }
}

// Registers, links, updates or configures every pipeline that isn't ready, in order, so a parent
// exists before the pipelines that name it. Stops at the first failure; what was done stays done,
// and the states are read again afterwards, so a retry picks up where this stopped.
export async function setUpProject(cirro: Cirro, projectId: string, states: PipelineState[], onStep: (name: string) => void): Promise<void> {
  for (const state of states) {
    if (state.status === "ready") continue;
    const d = state.definition;
    onStep(d.name);
    if (state.status === "missing") {
      await step(d, "register", undefined, () => cirro.data.processes.createCustomProcess({ customProcessInput: processInput(d, [projectId]) }));
      const created = await retryRateLimited(() => cirro.data.processes.getProcess({ processId: d.id }));
      if (created.customSettings?.syncStatus !== SyncStatus.Successful) {
        throw new Error(`"${d.name}" was registered, but Cirro couldn't read its configuration from ${PIPELINE_REPOSITORY} at ${PIPELINE_VERSION.slice(0, 7)}. Is that commit pushed to GitHub?`);
      }
      continue;
    }
    const process = state.process;
    if (state.status === "archived") throw new Error(`"${d.name}" is archived in this Cirro. Its owner, ${process.owner ?? "unknown"}, can restore it.`);
    // Pipelines registered before the app read its configuration from the repository keep it in
    // Cirro; Cirro doesn't let a pipeline change where its configuration lives.
    if (process.configSource === ConfigSource.Storage) {
      const linked = [...new Set([...process.linkedProjectIds, projectId])];
      if (state.status !== "unconfigured") {
        await step(d, "update", process, () => cirro.data.processes.updateCustomProcess({ processId: d.id, customProcessInput: { ...processInput(d, linked), configSource: ConfigSource.Storage, customSettings: null } }));
      }
      await step(d, "save the configuration of", process, () =>
        cirro.data.processes.saveProcessRevision({ processId: d.id, processRevisionSaveRequest: { files: d.files, commitMessage: `${APP_NAME} ${PIPELINE_VERSION.slice(0, 7)}` } })
      );
      continue;
    }
    if (state.status !== "unconfigured") {
      const linked = [...new Set([...process.linkedProjectIds, projectId])];
      await step(d, "update", process, () => cirro.data.processes.updateCustomProcess({ processId: d.id, customProcessInput: processInput(d, linked) }));
    }
    const synced = await step(d, "sync", process, () => cirro.data.processes.syncCustomProcess({ processId: d.id }));
    if (synced.syncStatus !== SyncStatus.Successful) throw new Error(`Cirro couldn't read the configuration of "${d.name}" from ${PIPELINE_REPOSITORY} at ${PIPELINE_VERSION.slice(0, 7)}.`);
  }
}
