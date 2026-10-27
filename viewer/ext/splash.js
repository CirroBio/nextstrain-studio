import React from "react";
import { handleDroppedFiles } from "./handleDroppedFiles";

/* The viewer runs in a sandboxed frame (an opaque origin) inside the studio, so nothing a dataset
 * carries can reach the studio's Cirro sign-in. The studio sends the files once the viewer says it is
 * ready; see src/viewer/protocol.ts for the other side. */

const Splash = ({ dispatch }) => {
  React.useEffect(() => {
    function onMessage(event) {
      if (event.source !== window.parent) return;
      const msg = event.data;
      if (msg?.type !== "ns-viewer:load") return;
      handleDroppedFiles(dispatch, msg.files);
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "ns-viewer:ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [dispatch]);
  return <div style={{ padding: 40, fontFamily: "Lato, sans-serif", color: "#666" }}>Loading dataset…</div>;
};

export default Splash;
