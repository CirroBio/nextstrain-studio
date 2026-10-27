import { useState } from "react";
import { UploadBuild } from "./UploadBuild";
import type { Route } from "../app/route";

// On the viewer for local files: keep them in a Cirro project.
export function SaveToCirro({ files, go }: { files: File[]; go: (r: Route) => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  if (saved) return <button className="button button-small" onClick={() => go({ page: "project", project: saved })}>Saved: go to the project</button>;
  return (
    <div className="popover">
      <button className="button button-small button-primary" onClick={() => setOpen(!open)} aria-expanded={open}>Save to a Cirro project</button>
      {open && (
        <div className="popover-panel save-panel">
          <UploadBuild files={files} onDone={(_, projectId) => setSaved(projectId)} />
        </div>
      )}
    </div>
  );
}
