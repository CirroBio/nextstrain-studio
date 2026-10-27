# Nextstrain datasets in Cirro

This is the contract between `pipelines/` (which write Nextstrain datasets) and `src/` (which finds and opens them). Change it in the same change as either side.

## What counts as a Nextstrain dataset

A Cirro dataset holds one or more **Auspice datasets**. An Auspice dataset is a main JSON (Auspice v2: top-level `version`, `meta` and `tree`) plus optional sidecars that share its stem:

| File | Role |
| --- | --- |
| `<stem>.json` | Main dataset |
| `<stem>_tip-frequencies.json` | Frequencies panel |
| `<stem>_root-sequence.json` | Root sequence, for mutations in the entropy panel and sequence export |
| `<stem>_measurements.json` | Measurements panel |

Any of these may also end in `.gz`. Markdown files under `narratives/` are Nextstrain narratives over the dataset's stems.

The app recognizes a dataset's Auspice datasets by file name alone: a `.json` file whose stem has none of the sidecar suffixes is a main dataset, and sidecars attach to the main dataset with the same stem in the same folder. In the output of this repo's pipelines only files under `auspice/` count, because `results/` holds node-data JSONs that aren't datasets. Main datasets are opened and checked for `meta` and `tree` only when someone views them.

## Where the files go

- Pipelines publish main datasets and their sidecars under `auspice/` in their output, and intermediate files (alignment, tree, node data, Nextclade tables) under `results/`.
- Uploads from the app go under `auspice/` in a Files (`custom_dataset`) dataset tagged `nextstrain-studio`.
- Files uploaded any other way (the Cirro portal, `cirro upload`) count wherever they sit in the dataset, as long as the names follow the rules above.

## Which Cirro datasets the app looks inside

Listing every file of every dataset is slow, so the app looks only at completed datasets that match one of these:

- made by one of this repo's pipelines, recognized by **process name** (IDs differ between tenants): `Nextstrain build`, `Nextstrain build from tree`, `Nextclade`, `Nextstrain: NCBI Virus ingest`;
- tagged `nextstrain-studio`;
- Files (`custom_dataset`) uploads.

## Sequences and metadata

Pipelines that take sequences read them from their source datasets:

- sequences: `*.fasta`, `*.fa`, `*.fna` (optionally `.gz`/`.xz`/`.zst`);
- metadata: `*.tsv` or `*.csv` with a strain column (`strain` by default; `--metadata_id_columns` overrides it).

The NCBI ingest pipeline writes `results/sequences.fasta` and `results/metadata.tsv` in exactly this form, so its output can be the input to a build.
