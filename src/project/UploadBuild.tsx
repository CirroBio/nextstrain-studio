import { useState } from "react";
import { describeError, useSignedIn } from "../cirro/cirro";
import { useAsync } from "../cirro/useAsync";
import { addNote, uploadFiles } from "../cirro/provenance";
import { groupAuspiceFiles } from "../viewer/auspiceFiles";

// Where each file goes in the new dataset (docs/dataset-layout.md): Auspice JSONs under auspice/,
// narratives under narratives/. Anything else is not part of a build and is left out.
export function uploadPath(name: string): string | null {
  if (/\.json(\.gz)?$/i.test(name)) return `auspice/${name}`;
  if (/\.md$/i.test(name)) return `narratives/${name}`;
  return null;
}

// A main JSON must be an Auspice v2 dataset; checked before anything is uploaded.
async function checkMain(file: File): Promise<string | null> {
  const text = file.name.endsWith(".gz") ? await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text() : await file.text();
  try {
    const json = JSON.parse(text);
    return json.meta && json.tree ? null : `${file.name} isn't an Auspice v2 dataset (it has no meta and tree).`;
  } catch {
    return `${file.name} isn't valid JSON.`;
  }
}

type State = { status: "idle" } | { status: "uploading"; done: number } | { status: "done"; datasetId: string; note: string | null } | { status: "error"; error: string };

export function UploadBuild({ projectId, files: given, onDone }: { projectId?: string; files?: File[]; onDone?: (datasetId: string, projectId: string) => void }) {
  const cirro = useSignedIn();
  const [picked, setPicked] = useState<File[]>([]);
  const files = given ?? picked;
  const kept = files.filter((f) => uploadPath(f.name));
  const mains = groupAuspiceFiles(kept, (f) => f.name);
  const [name, setName] = useState("");
  const [project, setProject] = useState(projectId ?? "");
  const projects = useAsync(() => (projectId ? Promise.resolve([]) : cirro.data.projects.getProjects()), [cirro, projectId]);
  const [state, setState] = useState<State>({ status: "idle" });
  const defaultName = mains[0]?.path ?? "";

  const upload = async () => {
    const problems = (await Promise.all(mains.map((m) => checkMain(m.main)))).filter((p): p is string => !!p);
    if (problems.length) return setState({ status: "error", error: problems.join(" ") });
    setState({ status: "uploading", done: 0 });
    try {
      const datasetName = name.trim() || defaultName;
      const datasetId = await uploadFiles(
        cirro,
        { projectId: project, name: datasetName, description: `Nextstrain build: ${mains.map((m) => m.path).join(", ")}`, files: kept.map((f) => ({ path: uploadPath(f.name)!, file: f })) },
        (done) => setState({ status: "uploading", done })
      );
      const note = await addNote(cirro, project, datasetId, { what: `Nextstrain build uploaded from ${kept.length} file(s): ${kept.map((f) => f.name).join(", ")}.`, inputs: [] });
      setState({ status: "done", datasetId, note });
      onDone?.(datasetId, project);
    } catch (e) {
      setState({ status: "error", error: describeError(e, "upload datasets") });
    }
  };

  if (state.status === "done") {
    return (
      <div>
        <p>Uploaded. Cirro takes a moment to register the files before the build appears in the project.</p>
        {state.note && <p className="muted">{state.note}</p>}
      </div>
    );
  }
  const busy = state.status === "uploading";
  return (
    <div className="design-form">
      {!given && (
        <label className="field">
          <span className="field-label">Auspice JSONs, their sidecars, and narratives</span>
          <input type="file" multiple accept=".json,.gz,.md" onChange={(e) => setPicked(Array.from(e.target.files ?? []))} disabled={busy} />
        </label>
      )}
      {files.length > 0 && mains.length === 0 && <p className="error-text">None of these is an Auspice main dataset (a .json without a sidecar suffix).</p>}
      {files.length > kept.length && <p className="muted">Left out, not part of a build: {files.filter((f) => !uploadPath(f.name)).map((f) => f.name).join(", ")}</p>}
      {!projectId && (
        <label className="field">
          <span className="field-label">Project</span>
          <select value={project} onChange={(e) => setProject(e.target.value)} disabled={busy}>
            <option value="">{projects.status === "loading" ? "Loading projects…" : "Choose a project"}</option>
            {projects.status === "ready" && projects.value.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      {projects.status === "error" && <p className="error-text">{projects.error}</p>}
      <label className="field">
        <span className="field-label">Dataset name in Cirro</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName || "e.g. zika-2026-10"} disabled={busy} />
      </label>
      <div>
        <button className="button button-primary" disabled={busy || !project || mains.length === 0} onClick={upload}>
          {busy ? `Uploading ${state.done} of ${kept.length}…` : `Upload ${kept.length || ""} file${kept.length === 1 ? "" : "s"}`}
        </button>
      </div>
      {state.status === "error" && <p className="error-text" role="alert">{state.error}</p>}
    </div>
  );
}
