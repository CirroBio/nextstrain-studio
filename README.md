# Nextstrain Studio

A Cirro app for building, exploring and sharing [Nextstrain](https://nextstrain.org) phylogenies.

- **Public datasets.** Every dataset nextstrain.org lists, plus a curated catalog of community builds and datasets hosted elsewhere, which anyone can add to with a pull request ([catalog/README.md](catalog/README.md)).
- **Open files.** Drop Auspice JSONs, sidecars, Newick trees, narratives or metadata tables. They open in the browser and nothing is uploaded.
- **Cirro projects.** Sign in to a Cirro tenant to open the Nextstrain builds kept in a project, upload new ones, and run builds on Cirro's compute: phylogenies from sequences or from an existing tree, Nextclade, and ingest from NCBI Virus. Share builds with other projects through Cirro, or publish them to nextstrain.org as a community build.

The aim is a private place to build and iterate on Nextstrain analyses, with a short path from there to sharing them with other groups or the world.

## How it fits together

```
nextstrain.org / catalog ─┐
local files ──────────────┼─► studio (src/) ── File objects ─► viewer (viewer/, Auspice in a sandboxed frame)
Cirro project datasets ───┘        │
                                   └─ runAnalysis ─► pipelines/ (Nextflow on Cirro) ─► new datasets with auspice/*.json
```

- **src/**: the studio, a static React app. It signs in with Cirro (OAuth, PKCE, no backend), finds Nextstrain builds in projects, uploads, launches pipelines, and fetches public datasets.
- **viewer/**: [Auspice](https://github.com/nextstrain/auspice), built with this app's customizations into static files (`public/viewer/`). It runs in an `<iframe sandbox>` without `allow-same-origin`, so nothing in a dataset can reach the user's Cirro sign-in; the studio passes it the dataset's files with `postMessage`.
- **pipelines/**: Nextflow pipelines and their Cirro process configurations: `build`, `build-from-tree`, `nextclade`, `ingest-ncbi`. Parameters are in [docs/pipeline-params.md](docs/pipeline-params.md). The app registers them itself: the first time a project member who may add custom pipelines (a pipeline developer) opens a project, the project page offers to set them up, with the configuration bundled in the app and the code at the commit the app was built from. Until then, builds open and upload but can't be run there.
- **catalog/**: the public catalog and its checker.
- **public/demo/**: demo data (the Zika tutorial's sequences and metadata, a tree, and the build made from them) that the app offers for trying pipelines and uploads; see its README.
- **docs/dataset-layout.md**: what counts as a Nextstrain dataset in Cirro: the contract between the pipelines and the app.

## Developing

Node 24 (`.nvmrc`); Auspice needs it.

```bash
npm install
npm install --prefix viewer
npm run build:viewer   # Auspice into public/viewer/, about a minute; again only when viewer/ changes
npm run dev            # http://localhost:5173/nextstrain-studio/
npm test
npm run build
```

`public/tenants.json` lists the Cirro tenants the log-in box suggests during development. It is git-ignored, and a copy of `deploy/tenants.json` works. Sign-in needs the callback URL `http://localhost:5173/nextstrain-studio/` registered in the tenant: with the App Developer role, register it yourself and add its `clientId` to that tenant's entry; otherwise a tenant admin registers it with discovery enabled. Public datasets and local files need no sign-in.

The pipelines run locally with Docker; see each `pipelines/<name>/README.md`.

## Deploying

`.github/workflows/pages.yml` tests, builds and publishes to GitHub Pages from `main`, with `deploy/tenants.json` as the tenant list. Each tenant whose users should sign in registers the production callback URL (the Pages address plus `/nextstrain-studio/`) with discovery enabled; see the Cirro app kit's deployment guide.

## License

AGPL-3.0-only, as Auspice is. `viewer/ext/handleDroppedFiles.js` comes from [auspice.us](https://github.com/nextstrain/auspice.us).
