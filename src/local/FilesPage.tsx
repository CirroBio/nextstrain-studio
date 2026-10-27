import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { localSource } from "../viewer/sources";
import { ViewerPage } from "../viewer/ViewerPage";

// Files the user drops stay in this tab: they're read by the viewer and go to Cirro only if the
// user saves them there (the `actions` the app passes in).
export function FilesPage({ actions }: { actions?: (files: File[]) => ReactNode }) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const source = useMemo(() => (files ? localSource(files) : null), [files]);

  if (source && files) return <ViewerPage source={source} actions={actions?.(files)} />;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) setFiles(Array.from(e.dataTransfer.files));
  };
  return (
    <main className="page">
      <h1 className="title">Open files</h1>
      <p className="page-lede">
        Your files are read in this browser and nothing is uploaded. Drop a dataset with its sidecars together, for example <code>zika.json</code> with <code>zika_tip-frequencies.json</code> and <code>zika_root-sequence.json</code>.
      </p>
      <div
        className={over ? "dropzone over" : "dropzone"}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <p><strong>Drop files here</strong></p>
        <p className="muted">Auspice JSON (v2), sidecars, Newick trees, narratives (.md), and metadata tables (.csv, .tsv) to color a dataset by. Gzipped files work too.</p>
        <button className="button" onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files?.length && setFiles(Array.from(e.target.files))} />
      </div>
    </main>
  );
}
