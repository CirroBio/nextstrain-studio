import { ApiError } from "@cirrobio/sdk";
import { ConfigSource, Executor, type CustomProcessInput, type ProcessDetail } from "@cirrobio/api-client";
import { describeError, retryRateLimited, type Cirro } from "./cirro";
import { PIPELINE_DEFINITIONS, PIPELINE_REPOSITORY, PIPELINE_REPOSITORY_TYPE, PIPELINE_VERSION, type PipelineDefinition } from "./pipelines";
import { APP_NAME, APP_TAG } from "../app/appInfo";

// A project is set up for this app's pipelines when each is registered, linked to the project,
// and reads the code this build of the app was made for. Viewing and uploading builds need none
// of this; only running pipelines does. Setting up is done once per project, from the app, by a
// user Cirro lets register pipelines (CREATE_CUSTOM_PIPELINE in the project, and a pipeline
// developer in the tenant).

export type PipelineStatus =
  | { status: "ready"; process: ProcessDetail }
  // Registered and linked, but reading other code than this app's build expects.
  | { status: "outdated"; process: ProcessDetail }
  // Registered, but for other projects only.
  | { status: "unlinked"; process: ProcessDetail }
  | { status: "archived"; process: ProcessDetail }
  | { status: "missing" };

export type PipelineState = { definition: PipelineDefinition } & PipelineStatus;

const DOCS_URL = `https://github.com/${PIPELINE_REPOSITORY}/tree/main/pipelines`;

export function statusOf(process: ProcessDetail, projectId: string): PipelineStatus {
  if (process.isArchived) return { status: "archived", process };
  if (!process.isTenantWide && !process.linkedProjectIds.includes(projectId)) return { status: "unlinked", process };
  if (process.pipelineCode?.version !== PIPELINE_VERSION) return { status: "outdated", process };
  return { status: "ready", process };
}

export async function pipelineStates(cirro: Cirro, projectId: string): Promise<PipelineState[]> {
  const visible = new Set((await retryRateLimited(() => cirro.data.processes.getProcesses({ includeArchived: true }))).map((p) => p.id));
  return Promise.all(
    PIPELINE_DEFINITIONS.map(async (definition) => {
      if (!visible.has(definition.id)) return { definition, status: "missing" as const };
      const process = await retryRateLimited(() => cirro.data.processes.getProcess({ processId: definition.id }));
      return { definition, ...statusOf(process, projectId) };
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
    documentationUrl: `${DOCS_URL}/${d.entryPoint.split("/")[1]}`,
    pipelineCode: { repositoryPath: PIPELINE_REPOSITORY, version: PIPELINE_VERSION, repositoryType: PIPELINE_REPOSITORY_TYPE, entryPoint: d.entryPoint },
    linkedProjectIds,
    isTenantWide: false,
    allowMultipleSources: false,
    usesSampleSheet: false,
    configSource: ConfigSource.Storage,
    tags: [APP_TAG],
  };
}

// Plain words for why setting up was refused: it needs rights most project members don't have.
function setupError(e: unknown, d: PipelineDefinition, process?: ProcessDetail): Error {
  if (e instanceof ApiError && e.errorCode === 403) {
    return new Error(
      process
        ? `Cirro didn't let you change "${d.name}". It was registered by ${process.owner ?? "someone else"}; they, or another of its maintainers, can set up this project.`
        : `Cirro didn't let you register "${d.name}". Setting up needs a project member with permission to add custom pipelines (a pipeline developer); ask your project's owner or a Cirro admin.`
    );
  }
  return new Error(`Setting up "${d.name}" failed: ${describeError(e)}`);
}

// Registers, links or updates every pipeline that isn't ready, in order, so a parent exists before
// the pipelines that name it. Stops at the first refusal; what was done stays done.
export async function setUpProject(cirro: Cirro, projectId: string, states: PipelineState[], onStep: (name: string) => void): Promise<void> {
  for (const state of states) {
    if (state.status === "ready") continue;
    const d = state.definition;
    onStep(d.name);
    try {
      if (state.status === "missing") {
        await cirro.data.processes.createCustomProcess({ customProcessInput: processInput(d, [projectId]) });
      } else if (state.status === "archived") {
        throw new Error(`"${d.name}" is archived in this Cirro. Its owner, ${state.process.owner ?? "unknown"}, can restore it.`);
      } else {
        const linked = [...new Set([...state.process.linkedProjectIds, projectId])];
        await cirro.data.processes.updateCustomProcess({ processId: d.id, customProcessInput: processInput(d, linked) });
      }
      await cirro.data.processes.saveProcessRevision({
        processId: d.id,
        processRevisionSaveRequest: { files: d.files, commitMessage: `${APP_NAME} ${PIPELINE_VERSION.slice(0, 7)}` },
      });
    } catch (e) {
      throw e instanceof ApiError ? setupError(e, d, state.status === "missing" ? undefined : state.process) : e;
    }
  }
}
