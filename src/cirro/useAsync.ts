import { useEffect, useState, type DependencyList } from "react";
import { describeError } from "./cirro";

export type AsyncState<T> =
  | { status: "loading"; value?: undefined; error?: undefined }
  | { status: "ready"; value: T; error?: undefined }
  | { status: "error"; value?: undefined; error: string };

// Runs `load` whenever deps change; a stale result from an earlier run is dropped.
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: "loading" });
    load(ctrl.signal).then(
      (value) => !ctrl.signal.aborted && setState({ status: "ready", value }),
      (e) => !ctrl.signal.aborted && setState({ status: "error", error: describeError(e) })
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
