# Pipeline parameters

The parameters each pipeline in `pipelines/` takes, for launching runs from the app
with Cirro's `runAnalysis`. The form is flat: every key in a pipeline's
`cirro/process-form.json` is passed to Nextflow under the same name by
`cirro/process-input.json` (`"<key>": "$.dataset.params.<key>"`), so a run's `params`
object uses exactly the keys below. Leave a key out to take its default. Don't send
`null` for a key whose default isn't "none": Nextflow would take the `null`, and for
example `"timetree": null` turns the timetree off.

Cirro also sets two parameters from the run itself, which are not form fields:

| Key | Mapped from | Meaning |
| --- | --- | --- |
| `outdir` | `$.dataset.dataPath` | The new dataset's folder. Every pipeline. |
| `input` | `$.inputs[0].dataPath` | The first input dataset's folder, searched for input files that aren't given directly. All but the NCBI ingest. |

File parameters take a full path (`s3://…` in Cirro) to one file, normally in an input
dataset. List parameters are strings of comma-separated values (`"region,country"`),
not JSON arrays. Booleans are JSON booleans.

Where a file is found in `input` instead of given, the pipeline takes the one file
matching the pattern anywhere under the folder, and fails with the list of candidates
if there is more than one.

## Shared output naming

`name` (in the build, build from tree and Nextclade pipelines) is the stem of the
Auspice JSON: `auspice/<name>.json`, with its sidecars `auspice/<name>_*.json`. It must
match `^[A-Za-z0-9][A-Za-z0-9_.-]*$` and must not end in `_tip-frequencies`,
`_root-sequence` or `_measurements`; the pipeline refuses the run otherwise.

## Nextstrain build

Process name `Nextstrain build`, `pipelines/build/`.

### Inputs

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `sequences` | file | the one `**/*.{fasta,fa,fna}` (optionally `.gz`/`.xz`/`.zst`) in `input` | Sequences, unaligned. |
| `metadata` | file | the one `**/*.{tsv,csv}` in `input` | One row per sequence. |
| `metadata_id_columns` | string, list | `"strain"` | Metadata column(s) holding the sequence names, tried in order. |
| `reference_preset` | string, enum | none | A Nextstrain reference GenBank; see [presets](#reference-presets). Mutually exclusive with `reference`. |
| `reference` | file | the one `**/*.{gb,gbk,genbank}` in `input`, when no preset is set | GenBank reference for alignment and translation. |
| `name` | string | `"build"` | Output stem; see above. |
| `title` | string | none | Title shown in Auspice. |

A timetree needs a `date` column in the metadata, `YYYY-MM-DD` with `XX` for unknown
parts (`2016-XX-XX`).

### Filtering and subsampling (`augur filter`)

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `exclude` | file | none | Text file of strain names to drop, one per line. |
| `group_by` | string, list | none | Metadata columns to group by when subsampling. `year`, `month` and `week` are derived from `date`. |
| `sequences_per_group` | integer | none | Keep at most this many sequences per group. |
| `subsample_max_sequences` | integer | none | Keep at most this many sequences in total, spread across groups. Use this or `sequences_per_group`, not both. |
| `min_length` | integer | none | Drop sequences with fewer valid nucleotides. |
| `min_date` | string | none | Drop sequences dated earlier. `YYYY-MM-DD` or a decimal year. |
| `max_date` | string | none | Drop sequences dated later. Same formats. |

### Tree and timetree (`augur refine`)

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `timetree` | boolean | `true` | Build a time-resolved tree with marginal date inference and date confidence. Tip frequencies are only made with a timetree. |
| `clock_rate` | number | estimated | Fixed clock rate, substitutions per site per year. Only with `timetree`. |
| `clock_std_dev` | number | none | Standard deviation of the fixed clock rate. Only with `timetree`. |
| `clock_filter_iqd` | number | `4` | Drop tips more than this many interquartile ranges off the root-to-tip regression. `0` turns it off. Only with `timetree`. |
| `root` | string, list | augur's default (`best`) | `best`, `least-squares`, `min_dev` or `oldest`, or one or two strain names to root on. |
| `coalescent` | string | none | Coalescent prior: `opt`, `const`, `skyline`, or a number (Tc). Only with `timetree`. |

### Export (`augur traits`, `augur export v2`)

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `traits` | string, list | none | Metadata columns whose ancestral states `augur traits` infers. Nothing is inferred when not set. |
| `color_by` | string, list | none | Metadata columns offered as colorings (`--color-by-metadata`). |
| `geo_resolutions` | string, list | none | Metadata columns placed on the map, e.g. `"region,country"`. Coordinates come from augur's built-in table or `lat_longs`. |
| `auspice_config` | file | none | `auspice_config.json` with colorings, filters, display defaults. |
| `lat_longs` | file | none | TSV of `resolution`, `name`, `latitude`, `longitude`, without a header. |

### Outputs

`auspice/<name>.json`, `auspice/<name>_root-sequence.json`,
`auspice/<name>_tip-frequencies.json` (only with `timetree`); `results/filtered.fasta`,
`results/filtered_metadata.tsv`, `results/sequence_index.tsv`, `results/aligned.fasta`,
`results/tree_raw.nwk`, `results/tree.nwk`, `results/branch_lengths.json`,
`results/nt_muts.json`, `results/aa_muts.json`, `results/traits.json` (only with
`traits`).

### Reference presets

Fetched at run time from the Nextstrain pathogen repos, each pinned to a commit.

| `reference_preset` | Form label | GenBank file |
| --- | --- | --- |
| `zika` | Zika | [nextstrain/zika@12de10f `phylogenetic/defaults/reference.gb`](https://github.com/nextstrain/zika/blob/12de10fa311f032e85cca1fa02784f9b195748f6/phylogenetic/defaults/reference.gb) |
| `measles-genome` | Measles (whole genome) | [nextstrain/measles@c36dc55 `phylogenetic/defaults/measles_reference_genome.gb`](https://github.com/nextstrain/measles/blob/c36dc5561cfd96e184f8e071d239f500507d9966/phylogenetic/defaults/measles_reference_genome.gb) |
| `measles-n450` | Measles (N450) | [nextstrain/measles@c36dc55 `phylogenetic/defaults/measles_reference_N450.gb`](https://github.com/nextstrain/measles/blob/c36dc5561cfd96e184f8e071d239f500507d9966/phylogenetic/defaults/measles_reference_N450.gb) |
| `mpox-clade-i` | Mpox clade I | [nextstrain/mpox@8495d7b `phylogenetic/defaults/clade-i/reference.gb`](https://github.com/nextstrain/mpox/blob/8495d7b22cc1062455606db2ce1bcf180ff3e1d7/phylogenetic/defaults/clade-i/reference.gb) |
| `mpox-clade-iib` | Mpox clade IIb | [nextstrain/mpox@8495d7b `phylogenetic/defaults/reference.gb`](https://github.com/nextstrain/mpox/blob/8495d7b22cc1062455606db2ce1bcf180ff3e1d7/phylogenetic/defaults/reference.gb) |
| `dengue-denv1` | Dengue serotype 1 | [nextstrain/dengue@b31c2b5 `phylogenetic/defaults/denv1/reference.gb`](https://github.com/nextstrain/dengue/blob/b31c2b54a0ca89c4b7b48d64ca890ec09ee9c3a9/phylogenetic/defaults/denv1/reference.gb) |
| `dengue-denv2` | Dengue serotype 2 | [nextstrain/dengue@b31c2b5 `phylogenetic/defaults/denv2/reference.gb`](https://github.com/nextstrain/dengue/blob/b31c2b54a0ca89c4b7b48d64ca890ec09ee9c3a9/phylogenetic/defaults/denv2/reference.gb) |
| `dengue-denv3` | Dengue serotype 3 | [nextstrain/dengue@b31c2b5 `phylogenetic/defaults/denv3/reference.gb`](https://github.com/nextstrain/dengue/blob/b31c2b54a0ca89c4b7b48d64ca890ec09ee9c3a9/phylogenetic/defaults/denv3/reference.gb) |
| `dengue-denv4` | Dengue serotype 4 | [nextstrain/dengue@b31c2b5 `phylogenetic/defaults/denv4/reference.gb`](https://github.com/nextstrain/dengue/blob/b31c2b54a0ca89c4b7b48d64ca890ec09ee9c3a9/phylogenetic/defaults/denv4/reference.gb) |
| `rsv-a` | RSV-A | [nextstrain/rsv@7d91d8f `config/areference.gbk`](https://github.com/nextstrain/rsv/blob/7d91d8fd0ff98d3a33ad8191a8ad712d05904e58/config/areference.gbk) |
| `rsv-b` | RSV-B | [nextstrain/rsv@7d91d8f `config/breference.gbk`](https://github.com/nextstrain/rsv/blob/7d91d8fd0ff98d3a33ad8191a8ad712d05904e58/config/breference.gbk) |

## Nextstrain build from tree

Process name `Nextstrain build from tree`, `pipelines/build-from-tree/`.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `tree` | file | the one `**/*.{nwk,newick,tree,treefile}` in `input` | Newick tree. Tip names must match the metadata's strain column. Branch lengths in substitutions per site. |
| `metadata` | file | the one `**/*.{tsv,csv}` in `input` | One row per tip. |
| `alignment` | file | the one `**/*.{fasta,fa,fna}` (optionally compressed) in `input`, if any | Alignment of the tips. With it, mutations are inferred (`augur ancestral`) and the root sequence exported. Optional. |
| `metadata_id_columns` | string, list | `"strain"` | As in the build. |
| `name` | string | `"tree"` | Output stem. |
| `title` | string | none | Title shown in Auspice. |
| `timetree` | boolean | `false` | Build a time-resolved tree from the metadata's `date` column. Needs `alignment`; the run is refused without one. |
| `clock_rate` | number | estimated | As in the build. |
| `clock_std_dev` | number | none | As in the build. |
| `clock_filter_iqd` | number | none (off) | As in the build, but off by default. |
| `root` | string, list | augur's default | As in the build. |
| `coalescent` | string | none | As in the build. |
| `traits` | string, list | none | As in the build. |
| `color_by` | string, list | none | As in the build. |
| `geo_resolutions` | string, list | none | As in the build. |
| `auspice_config` | file | none | As in the build. |
| `lat_longs` | file | none | As in the build. |

Outputs: `auspice/<name>.json`, `auspice/<name>_root-sequence.json` (only with an
alignment); `results/tree.nwk`, `results/branch_lengths.json`, `results/nt_muts.json`
(only with an alignment), `results/traits.json` (only with `traits`).

## Nextclade

Process name `Nextclade`, `pipelines/nextclade/`.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `dataset_name` | string | required | Nextclade dataset, as in `nextclade dataset list`: e.g. `nextstrain/sars-cov-2/wuhan-hu-1/orfs`, `nextstrain/mpox/all-clades`, `nextstrain/flu/h3n2/ha/EPI1857216`. |
| `dataset_tag` | string | latest | Dataset version tag, e.g. `2024-10-17--16-48-48Z`. |
| `sequences` | file | the one `**/*.{fasta,fa,fna}` (optionally compressed) in `input` | Sequences to analyse. |
| `name` | string | `"nextclade"` | Output stem. |

Outputs: `auspice/<name>.json` (the dataset's reference tree with the sequences placed on
it; only for datasets that ship a `tree.json`), `results/nextclade.tsv`,
`results/nextclade.aligned.fasta`, `results/translations/<cds>.translation.fasta`.

## Nextstrain NCBI Virus ingest

Process name `Nextstrain NCBI Virus ingest`, `pipelines/ingest-ncbi/`. Reads nothing
from its input dataset, so `input` is not mapped.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `taxon_id` | string | required | NCBI taxonomy ID or name, e.g. `"64320"` for Zika virus. Sent as a string; a JSON number also works. |
| `released_since` | string, date | none | Only records released on or after this date, `YYYY-MM-DD`. |
| `complete_only` | boolean | `false` | Only records NCBI marks as complete genomes. |
| `host` | string | none | Only records from this host, an NCBI taxonomy name or ID, e.g. `"Homo sapiens"`. |

Outputs: `results/sequences.fasta` (named by GenBank accession without version) and
`results/metadata.tsv`, whose `strain` column is that accession. Columns: `strain`,
`accession_version`, `isolate`, `date`, `region`, `country`, `division`, `location`,
`host`, `length`, `completeness`, `database`, `date_released`, `date_updated`,
`authors`, `full_authors`, `institution`, `sra_accessions`, `url`.
