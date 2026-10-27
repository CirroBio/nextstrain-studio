# CLAUDE.md

Nextstrain Studio: a Cirro OAuth app (static React/Vite) that embeds Auspice, plus the Nextflow pipelines that make what it shows. README.md describes the layout; keep it and this file current when structure or purpose changes.

## Contracts

- `docs/dataset-layout.md` (what counts as a Nextstrain dataset in Cirro) and `docs/pipeline-params.md` (each pipeline's parameter keys) are the interface between `pipelines/` and `src/`. Change the doc in the same change as either side.
- The app registers its own pipelines, per project, from `src/cirro/pipelines.ts`: fixed process IDs, the Cirro config files in `pipelines/*/cirro/` bundled into the build (config source STORAGE), and the code at the commit the app was built from. Nothing is registered from outside the app; a project is set up the first time a member with permission to add custom pipelines opens it (`src/cirro/setup.ts`, `SetupPanel`). Tell users when a project still needs that.
- The build page reads the reference presets from `pipelines/build/cirro/process-form.json`, so the Cirro form and the app offer the same list.
- The viewer protocol is two messages, `ns-viewer:ready` and `ns-viewer:load` (`viewer/ext/splash.js`, `src/viewer/ViewerFrame.tsx`). Change both together.

## Security facts that shape the code

- The viewer frame is sandboxed without `allow-same-origin`. Datasets come from anyone (community builds, uploads, URLs in links) and Auspice renders their markdown and links; never give the frame the studio's origin.
- Under a path on a shared origin (GitHub Pages), the sign-in lives in sessionStorage (`src/auth.ts`).
- A tenant named in a link opens only if it is in tenants.json or the user chose it before (`src/tenants.ts`).

## Conventions

- Everything the app creates in Cirro carries the tag `{ value: "nextstrain-studio" }` and a provenance note. Running a pipeline costs money, so it is always an explicit button press.
- Sharing between projects is Cirro's own (the portal's shares page); publishing to the world is a nextstrain.org community build plus, optionally, a catalog entry.
- Styles build on `src/styles/tokens.css`, shared with the other Cirro studios.
- Before calling work done: `npm test`, `npm run build`, and for pipeline changes the pipeline's own `tests/run.sh docker`.
