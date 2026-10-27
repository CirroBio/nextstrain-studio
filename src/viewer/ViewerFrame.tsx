import { useEffect, useRef, useState } from "react";
import type { ViewerSource } from "./sources";

// Auspice, built by viewer/build.cjs, runs in a sandboxed frame: without allow-same-origin it has
// an opaque origin, so nothing in a dataset (markdown, links) can read the studio's Cirro sign-in.
// The protocol is two messages, matching viewer/ext/splash.js:
//   viewer -> studio  { type: "ns-viewer:ready" }
//   studio -> viewer  { type: "ns-viewer:load", files: File[] }
// The opaque origin can't be named as a postMessage target, so the files go to "*", but only to
// the frame's own window and only in answer to its ready message.
const VIEWER_URL = `${import.meta.env.BASE_URL}viewer/index.html`;
const SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads";

type State = { status: "loading" } | { status: "ready"; files: File[] } | { status: "error"; error: string };

export function ViewerFrame({ source, onLoaded }: { source: ViewerSource; onLoaded?: (files: File[]) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<State>({ status: "loading" });
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    source.load(ctrl.signal).then(
      (files) => {
        if (ctrl.signal.aborted) return;
        setState({ status: "ready", files });
        onLoaded?.(files);
      },
      (e) => !ctrl.signal.aborted && setState({ status: "error", error: e instanceof Error ? e.message : String(e) })
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    if (state.status !== "ready") return;
    // The frame is pointed at the viewer only once the files are here, so its ready message finds them.
    let posted = false;
    const onMessage = (e: MessageEvent) => {
      if (posted || e.source !== frame.current?.contentWindow || e.data?.type !== "ns-viewer:ready") return;
      posted = true;
      frame.current!.contentWindow!.postMessage({ type: "ns-viewer:load", files: state.files }, "*");
      setShown(true);
    };
    window.addEventListener("message", onMessage);
    frame.current!.src = VIEWER_URL;
    return () => window.removeEventListener("message", onMessage);
  }, [state]);

  return (
    <div className="viewer">
      {state.status === "loading" && <p className="viewer-status muted">Fetching {source.origin}…</p>}
      {state.status === "error" && (
        <div className="viewer-status" role="alert">
          <p className="error-text">Couldn't open this dataset.</p>
          <p>{state.error}</p>
        </div>
      )}
      <iframe ref={frame} title={`Auspice: ${source.title}`} sandbox={SANDBOX} className={shown ? "viewer-frame" : "viewer-frame viewer-frame-hidden"} />
    </div>
  );
}
