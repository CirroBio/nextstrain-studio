import { DiscussionType, EntityType, ProjectAccessType, type DatasetDetail } from "@cirrobio/api-client";
import { ProjectFileAccessContext, uploadFile } from "@cirrobio/sdk";
import { describeError, retryRateLimited, type Cirro } from "./cirro";
import { APP_ID, APP_NAME, APP_TAG, APP_VERSION } from "../app/appInfo";

// Everything the app creates carries its tag and a provenance note, so someone reading the
// project later can tell what made it and from what.

export type Provenance = { what: string; inputs: { name: string; id: string }[]; parameters?: Record<string, unknown> };

function provenanceText(cirro: Cirro, p: Provenance): string {
  const lines = [p.what, "", `Created by ${APP_NAME} ${APP_VERSION} (${APP_ID}) for ${cirro.displayName} on ${new Date().toISOString()}.`];
  if (p.inputs.length) lines.push("Inputs:", ...p.inputs.map((i) => `- ${i.name} (${i.id})`));
  if (p.parameters) lines.push("Parameters:", "```json", JSON.stringify(p.parameters, null, 2), "```");
  return lines.join("\n");
}

// The note is optional (CREATE_DISCUSSION) and comes after the entity exists, so its failure is
// reported beside the result rather than failing an action a retry would repeat.
export async function addNote(cirro: Cirro, projectId: string, datasetId: string, p: Provenance): Promise<string | null> {
  try {
    const note = await cirro.data.feed.createDiscussion({
      discussionInput: { name: `Created by ${APP_NAME}`, description: `${APP_NAME} ${APP_VERSION}`, entity: { type: EntityType.Dataset, id: datasetId }, type: DiscussionType.Notes, projectId },
    });
    await cirro.data.feed.postMessage({ discussionId: note.id, messageInput: { message: provenanceText(cirro, p) } });
    return null;
  } catch (e) {
    return `Cirro didn't add a provenance note: ${describeError(e, "add notes")}`;
  }
}

export type UploadRequest = { projectId: string; name: string; description: string; files: { path: string; file: File }[] };

// A Files dataset holding the given files at the given paths.
export async function uploadFiles(cirro: Cirro, req: UploadRequest, onProgress: (done: number) => void): Promise<string> {
  const created = await cirro.data.datasets.uploadDataset({
    projectId: req.projectId,
    uploadDatasetRequest: {
      name: req.name,
      description: req.description,
      processId: "custom_dataset",
      expectedFiles: req.files.map((f) => f.path),
      tags: [APP_TAG],
    },
  });
  // Upload contexts need no DatasetDetail, but the SDK types it as required.
  const ctx = new ProjectFileAccessContext({ id: req.projectId }, null as unknown as DatasetDetail, { accessType: ProjectAccessType.DatasetUpload, datasetId: created.id });
  const credentials = await retryRateLimited(() => cirro.files.getProjectAccessCredentials(ctx));
  const base = created.uploadPath.replace(/\/$/, "");
  let done = 0;
  for (const f of req.files) {
    await uploadFile({ bucket: created.bucket, path: `${base}/${f.path}`, file: f.file, credentials }).done();
    onProgress(++done);
  }
  return created.id;
}
