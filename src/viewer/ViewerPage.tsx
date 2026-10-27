import type { ReactNode } from "react";
import { ViewerFrame } from "./ViewerFrame";
import type { ViewerSource } from "./sources";

export function ViewerPage({ source, actions, onLoaded }: { source: ViewerSource; actions?: ReactNode; onLoaded?: (files: File[]) => void }) {
  return (
    <div className="viewer-page">
      <div className="viewer-bar">
        <div>
          <h1>{source.title}</h1>
          <span className="muted">{source.origin}</span>
        </div>
        {actions && <div className="viewer-actions">{actions}</div>}
      </div>
      <ViewerFrame source={source} onLoaded={onLoaded} />
    </div>
  );
}
