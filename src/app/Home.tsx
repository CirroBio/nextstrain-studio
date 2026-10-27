import { Backdrop } from "../start/Backdrop";
import { APP_NAME } from "./appInfo";
import type { Route } from "./route";

const ICON = { viewBox: "0 0 48 48", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function Home({ go, signedInTo }: { go: (r: Route) => void; signedInTo: string | null }) {
  return (
    <div className="start">
      <Backdrop />
      <main className="start-hero">
        <p className="eyebrow">Nextstrain · Cirro</p>
        <h1 className="start-title">{APP_NAME}</h1>
        <p className="start-lede">
          Build, explore and share Nextstrain phylogenies. Start from public datasets, open your own builds in the browser, or keep them private in a Cirro project, run builds there, and share them when you're ready.
        </p>
        <div className="start-choices three">
          <button className="start-choice" onClick={() => go({ page: "catalog" })}>
            <svg className="start-choice-icon" {...ICON}>
              <circle cx="24" cy="24" r="16" /><path d="M8 24h32" /><path d="M24 8c5 5 5 27 0 32c-5-5-5-27 0-32" />
            </svg>
            <span className="start-choice-title">Public datasets</span>
            <span className="start-choice-text">Every dataset on nextstrain.org, plus community builds listed in this app. No account needed.</span>
          </button>
          <button className="start-choice" onClick={() => go({ page: "files" })}>
            <svg className="start-choice-icon" {...ICON}>
              <path d="M12 6h16l8 8v28H12z" /><path d="M28 6v8h8" /><path d="M24 22v12" /><path d="M19 29l5 5 5-5" />
            </svg>
            <span className="start-choice-title">Open files</span>
            <span className="start-choice-text">Drop an Auspice JSON, Newick tree or narrative. It opens in this browser; nothing is uploaded.</span>
          </button>
          <button className="start-choice" onClick={() => go({ page: signedInTo ? "projects" : "sign-in" })}>
            <svg className="start-choice-icon" {...ICON}>
              <path d="M28 8h8a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4h-8" /><path d="M8 24h20" /><path d="M20 16l8 8-8 8" />
            </svg>
            <span className="start-choice-title">{signedInTo ? `Your projects (${signedInTo})` : "Private data (Cirro)"}</span>
            <span className="start-choice-text">Keep builds in a Cirro project, upload new ones, run Nextstrain builds on Cirro, and share them with other groups.</span>
          </button>
        </div>
      </main>
    </div>
  );
}
