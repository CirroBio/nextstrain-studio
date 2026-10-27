import { useSignedIn } from "../cirro/cirro";
import { useAsync } from "../cirro/useAsync";
import { projectContents, type Build } from "../cirro/projectBuilds";
import { portal } from "../cirro/portal";
import { UploadBuild } from "./UploadBuild";
import type { Route } from "../app/route";

const when = (d: Date) => d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function ProjectPage({ projectId, go }: { projectId: string; go: (r: Route) => void }) {
  const cirro = useSignedIn();
  const project = useAsync(() => cirro.data.projects.getProject({ projectId }), [cirro, projectId]);
  const contents = useAsync(() => projectContents(cirro, projectId), [cirro, projectId]);
  const name = project.status === "ready" ? project.value.name : "Project";
  const names = new Map(contents.status === "ready" ? [...contents.value.builds, ...contents.value.inputs].map((b) => [b.dataset.id, b.dataset.name]) : []);

  return (
    <main className="page">
      <div className="page-head">
        <h1 className="title">{name}</h1>
        <div className="form-actions" style={{ marginTop: 0 }}>
          <button className="button button-primary" onClick={() => go({ page: "new-build", project: projectId })}>New build</button>
          <a className="button" href={portal.shares(cirro.tenant.url, projectId)} target="_blank" rel="noreferrer">Share with another project</a>
        </div>
      </div>
      {project.status === "error" && <p className="error-text">Couldn't open this project: {project.error}</p>}

      <section className="panel">
        <div className="panel-head">
          <h2>Nextstrain builds</h2>
          <p className="muted">Datasets in this project that hold Auspice JSON: outputs of the Nextstrain pipelines, and builds uploaded here.</p>
        </div>
        {contents.status === "loading" && <p className="muted">Looking through the project's datasets…</p>}
        {contents.status === "error" && <p className="error-text">{contents.error}</p>}
        {contents.status === "ready" && contents.value.builds.length === 0 && <p className="muted">No Nextstrain builds yet. Upload one below, or start a new build.</p>}
        {contents.status === "ready" && contents.value.builds.length > 0 && (
          <ul className="fact-list">
            {contents.value.builds.map((b) => <BuildRow key={b.dataset.id} build={b} names={names} projectId={projectId} go={go} />)}
          </ul>
        )}
      </section>

      {contents.status === "ready" && contents.value.running.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Runs</h2></div>
          <ul className="fact-list">
            {contents.value.running.map(({ dataset, process }) => (
              <li key={dataset.id}>
                <div className="fact-name">
                  <a href={portal.dataset(cirro.tenant.url, projectId, dataset.id)} target="_blank" rel="noreferrer">{dataset.name}</a>
                  <span className={`status status-${dataset.status.toLowerCase()}`}>{dataset.status.toLowerCase()}</span>
                </div>
                <span className="muted">{process} · started {when(dataset.createdAt)} by {dataset.createdBy}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Upload a build</h2>
          <p className="muted">Add Auspice JSONs you built elsewhere (with <code>nextstrain build</code>, or downloaded) to this project, as a new dataset only its members can see.</p>
        </div>
        <UploadBuild projectId={projectId} onDone={() => contents.reload()} />
      </section>
    </main>
  );
}

function BuildRow({ build, names, projectId, go }: { build: Build; names: Map<string, string>; projectId: string; go: (r: Route) => void }) {
  const cirro = useSignedIn();
  const sources = build.dataset.sourceDatasetIds.map((id) => names.get(id) ?? id);
  return (
    <li>
      <div className="fact-name">
        <strong>{build.dataset.name}</strong>
        <span className="muted">{build.process === "custom_dataset" ? "Uploaded" : build.process} · {when(build.dataset.createdAt)} · {build.dataset.createdBy}</span>
        <a className="muted" href={portal.dataset(cirro.tenant.url, projectId, build.dataset.id)} target="_blank" rel="noreferrer">In Cirro</a>
      </div>
      {sources.length > 0 && <div className="muted">Built from {sources.join(", ")}</div>}
      <div className="form-actions" style={{ marginTop: 4 }}>
        {build.auspice.map((a) => (
          <button key={a.path} className="button button-small" onClick={() => go({ page: "view-cirro", project: projectId, dataset: build.dataset.id, auspice: a.path })}>
            Open {a.path.split("/").pop()}
          </button>
        ))}
      </div>
    </li>
  );
}
