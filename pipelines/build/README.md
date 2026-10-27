# Nextstrain build

An augur phylogenetic build from sequences and metadata, exported for Auspice. Writes a
Nextstrain dataset as described in [`docs/dataset-layout.md`](../../docs/dataset-layout.md).
Every parameter is listed in [`docs/pipeline-params.md`](../../docs/pipeline-params.md).

## Steps

| Process | augur commands | Runs when |
| --- | --- | --- |
| `INDEX_AND_FILTER` | `index`, `filter` (exclude list, subsampling, minimum length, date range) | always |
| `ALIGN` | `align` against the reference, reference removed, gaps filled | always |
| `TREE` | `tree` (IQ-TREE) | always |
| `REFINE` | `refine`, a timetree with `--timetree` (optional clock rate, root, coalescent) | always |
| `ANCESTRAL` | `ancestral --inference joint` | always |
| `TRANSLATE` | `translate` with the reference's CDS features | always |
| `TRAITS` | `traits --confidence` on the chosen columns | `--traits` is set |
| `TIP_FREQUENCIES` | `frequencies --method kde` | `--timetree` is on |
| `EXPORT` | `export v2 --include-root-sequence` | always |

All of them run in the Biocontainers augur image,
`quay.io/biocontainers/augur:34.3.0--pyhdfd78af_0`, which includes MAFFT, IQ-TREE and
SeqKit. It also has `ps`, which Nextflow needs in the container because Cirro always
traces.

## Inputs

`--sequences` and `--metadata` are found in the `--input` folder when they aren't given
directly: the one `*.fasta`/`*.fa`/`*.fna` (optionally `.gz`/`.xz`/`.zst`) and the one
`*.tsv`/`*.csv` anywhere under it. A folder holding more than one of either is refused
with the list of candidates, so a dataset that also holds a `lat_longs.tsv` needs
`--metadata` set.

The metadata needs a strain column (`strain`, or `--metadata_id_columns`) matching the
FASTA names, and a `date` column for a timetree (`YYYY-MM-DD`, with `XX` for unknown
parts).

The reference is a GenBank file: one of the presets below (fetched at run time from the
Nextstrain pathogen repos at a pinned commit), `--reference`, or else the one
`*.gb`/`*.gbk`/`*.genbank` file in `--input`.

| `--reference_preset` | Source |
| --- | --- |
| `zika` | nextstrain/zika `phylogenetic/defaults/reference.gb` |
| `measles-genome` | nextstrain/measles `phylogenetic/defaults/measles_reference_genome.gb` |
| `measles-n450` | nextstrain/measles `phylogenetic/defaults/measles_reference_N450.gb` |
| `mpox-clade-i` | nextstrain/mpox `phylogenetic/defaults/clade-i/reference.gb` |
| `mpox-clade-iib` | nextstrain/mpox `phylogenetic/defaults/reference.gb` |
| `dengue-denv1` … `dengue-denv4` | nextstrain/dengue `phylogenetic/defaults/denv<N>/reference.gb` |
| `rsv-a`, `rsv-b` | nextstrain/rsv `config/areference.gbk`, `config/breference.gbk` |

Mpox genomes are about 197 kb, so `augur align` (MAFFT) is slow on more than a few
dozen of them; subsample first.

## Outputs

```
<outdir>/
  auspice/<name>.json                   main dataset
  auspice/<name>_root-sequence.json
  auspice/<name>_tip-frequencies.json   only with a timetree
  results/filtered.fasta, filtered_metadata.tsv, sequence_index.tsv
  results/aligned.fasta
  results/tree_raw.nwk, tree.nwk
  results/branch_lengths.json, nt_muts.json, aa_muts.json, traits.json
```

## Running it

```bash
nextflow run pipelines/build/main.nf -profile docker \
  --input data/ --reference_preset zika --traits region,country --outdir output
```

`-profile local` runs the same commands against augur, MAFFT and IQ-TREE installed
on the host.

## Test

```bash
pipelines/build/tests/run.sh            # or: run.sh local
```

Builds the [zika tutorial](https://github.com/nextstrain/zika-tutorial) data (34 genomes,
fetched at a pinned commit) with subsampling, an exclude list, traits, colorings, geo
resolutions, an auspice config and lat-longs, then checks the result with
`augur validate export-v2`.

## Registering it in Cirro

| Setting | Value |
| --- | --- |
| Name | `Nextstrain build` |
| Entry point | `pipelines/build/main.nf` |
| Configuration folder | `pipelines/build/cirro` |
| Executor | Nextflow |
| Parent processes | `custom_dataset`, plus the NCBI ingest process once it is registered |

The name has to be exactly `Nextstrain build`: the app finds this pipeline's datasets by
process name. `cirro/process-definition.json` records the intended settings; its `id`
and the ingest parent ID are placeholders to replace with the IDs Cirro assigns.

The input dataset reaches the pipeline as `input` = `$.inputs[0].dataPath` in
`cirro/process-input.json`, and the form's file pickers pass S3 paths directly. There
is deliberately no `preprocess.py` and `usesSampleSheet` is false: Cirro runs the
preprocess step only when a script exists, and `PreprocessDataset.from_running()` reads
`config/files.csv`, which Cirro doesn't write for runs without a sample sheet.

```bash
cirro-agent read check-config pipelines/build/cirro
```
