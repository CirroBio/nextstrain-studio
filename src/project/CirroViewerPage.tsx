import { useMemo, useState } from "react";
import { useSignedIn } from "../cirro/cirro";
import { useAsync } from "../cirro/useAsync";
import { datasetFiles, filePath, readFile } from "../cirro/projectBuilds";
import { portal } from "../cirro/portal";
import { groupAuspiceFiles } from "../viewer/auspiceFiles";
import { readerSource } from "../viewer/sources";
import { ViewerPage } from "../viewer/ViewerPage";
import { PublishPanel } from "./PublishPanel";
import type { Route } from "../app/route";

export function CirroViewerPage({ projectId, datasetId, auspicePath, go }: { projectId: string; datasetId: string; auspicePath: string; go: (r: Route) => void }) {
  const cirro = useSignedIn();
  const found = useAsync(async () => {
    const [dataset, files] = await Promise.all([cirro.data.datasets.getDataset({ projectId, datasetId }), datasetFiles(cirro, projectId, datasetId)]);
    const auspice = groupAuspiceFiles(files, filePath).find((a) => a.path === auspicePath);
    if (!auspice) throw new Error(`${dataset.name} has no Auspice dataset at ${auspicePath}.`);
    return { dataset, auspice };
  }, [cirro, projectId, datasetId, auspicePath]);
  // Keyed on the loaded value, not the state object useAsync returns anew on every render: a new
  // source makes the viewer fetch and reload again.
  const ready = found.status === "ready" ? found.value : null;
  const source = useMemo(
    () => (ready ? readerSource(auspicePath.split("/").pop()!, `${cirro.tenantName} · ${ready.dataset.name}`, ready.auspice, (f) => readFile(cirro, f), filePath) : null),
    [ready, cirro, auspicePath]
  );
  const [files, setFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);

  if (found.status === "loading") return <main className="page"><p className="muted">Opening the dataset…</p></main>;
  if (found.status === "error") return <main className="page"><p className="error-text">{found.error}</p><button className="link-button" onClick={() => go({ page: "project", project: projectId })}>Back to the project</button></main>;
  return (
    <>
      <ViewerPage
        source={source!}
        onLoaded={setFiles}
        actions={
          <>
            <button className="button button-small" onClick={() => go({ page: "project", project: projectId })}>Project</button>
            <a className="button button-small" href={portal.dataset(cirro.tenant.url, projectId, datasetId)} target="_blank" rel="noreferrer">In Cirro</a>
            <a className="button button-small" href={portal.shares(cirro.tenant.url, projectId)} target="_blank" rel="noreferrer">Share with another project</a>
            <button className="button button-small button-primary" disabled={!files.length} onClick={() => setPublishing(true)}>Publish…</button>
          </>
        }
      />
      {publishing && <PublishPanel files={files} title={found.value.dataset.name} onClose={() => setPublishing(false)} />}
    </>
  );
}
