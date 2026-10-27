import { useState } from "react";
import { useSignedIn } from "../cirro/cirro";
import { setUpProject, type PipelineState } from "../cirro/setup";
import { PIPELINE_REPOSITORY } from "../cirro/pipelines";
import { APP_NAME } from "../app/appInfo";

const WHAT: Record<PipelineState["status"], string> = {
  ready: "ready",
  outdated: "registered for another version of this app; setting up updates it",
  unconfigured: "registered, but its configuration isn't in Cirro yet",
  unlinked: "registered in this Cirro, not yet for this project",
  archived: "archived",
  missing: "not registered yet",
};

// Shown on a project until the app's pipelines are set up there. Opening and uploading builds
// works without it; running pipelines doesn't.
export function SetupPanel({ projectId, states, onDone }: { projectId: string; states: PipelineState[]; onDone: () => void }) {
  const cirro = useSignedIn();
  const [state, setState] = useState<{ status: "idle" } | { status: "working"; step: string } | { status: "error"; error: string }>({ status: "idle" });
  const pending = states.filter((s) => s.status !== "ready");
  const firstTime = states.every((s) => s.status === "missing");

  const run = async () => {
    try {
      await setUpProject(cirro, projectId, states, (step) => setState({ status: "working", step }));
    } catch (e) {
      setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
      return;
    }
    onDone();
  };

  return (
    <section className="panel setup-panel">
      <div className="panel-head">
        <h2>{firstTime ? `Set up ${APP_NAME} in this project` : `${APP_NAME}'s pipelines need setting up here`}</h2>
        <p className="muted">
          Opening and uploading builds works now. Running builds on Cirro needs {APP_NAME}'s pipelines registered for this project, once, by a member Cirro allows to add custom pipelines (a pipeline developer). After that, every member who can run pipelines can use them.
        </p>
      </div>
      <ul className="fact-list">
        {states.map((s) => (
          <li key={s.definition.id}>
            <div className="fact-name">
              <strong>{s.definition.name}</strong>
              <span className={s.status === "ready" ? "status status-completed" : "muted"}>{WHAT[s.status]}</span>
            </div>
            <span className="muted">{s.definition.description}</span>
          </li>
        ))}
      </ul>
      <p className="muted">
        Code and configuration come from {PIPELINE_REPOSITORY} at the version this app was built from. Each pipeline is tagged <code>nextstrain-studio</code> and linked to the projects that set it up. Registering needs permission to add custom pipelines; changing a pipeline that's already registered (linking this project, updating it) also needs permission to manage it.
      </p>
      {state.status === "error" && <p className="error-text" role="alert">{state.error}</p>}
      <button className="button button-primary" disabled={state.status === "working"} onClick={run}>
        {state.status === "working" ? `Setting up ${state.step}…` : `Set up ${pending.length} pipeline${pending.length === 1 ? "" : "s"}`}
      </button>
    </section>
  );
}
