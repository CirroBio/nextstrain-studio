# Nextclade

Downloads a Nextclade dataset and runs Nextclade on the input sequences: clade
assignment, QC, alignment and translations, plus placement of the sequences on the
dataset's reference tree, written as an Auspice dataset so they can be seen in context.
Every parameter is listed in [`docs/pipeline-params.md`](../../docs/pipeline-params.md).

## Steps

`NEXTCLADE` runs `nextclade dataset get --name <dataset_name> [--tag <dataset_tag>]`,
then `nextclade run` with that dataset, in `quay.io/biocontainers/nextclade:3.25.1--h9ee0642_0`.
`DEDUPE_FILTERS` then tidies the placed tree in the Biocontainers augur image (see
Outputs). Datasets are listed by
`nextclade dataset list` and at https://clades.nextstrain.org, e.g.
`nextstrain/sars-cov-2/wuhan-hu-1/orfs`, `nextstrain/mpox/all-clades`,
`nextstrain/flu/h3n2/ha/EPI1857216`.

## Inputs

`--sequences`, or the one `*.fasta`/`*.fa`/`*.fna` (optionally `.gz`/`.xz`/`.zst`) in the
`--input` folder.

## Outputs

```
<outdir>/
  auspice/<name>.json                      reference tree with the sequences placed on it
  results/nextclade.tsv                    clades, QC, mutations
  results/nextclade.aligned.fasta
  results/translations/<cds>.translation.fasta
```

`auspice/<name>.json` is written only when the dataset ships a reference tree
(`tree.json`); most Nextstrain datasets do. Nextclade lists some `meta.filters` twice
(e.g. `clade_membership` for SARS-CoV-2), which fails the Auspice v2 schema, so
`bin/dedupe_filters.py` drops the duplicates before the tree is published.

## Running it

```bash
nextflow run pipelines/nextclade/main.nf -profile docker \
  --dataset_name nextstrain/sars-cov-2/wuhan-hu-1/orfs --sequences seqs.fasta --outdir output
```

## Test

```bash
pipelines/nextclade/tests/run.sh         # or: run.sh local
```

Runs five SARS-CoV-2 genomes taken from the dataset's own example sequences (fetched
from nextstrain/nextclade_data at a pinned commit), checks there are five rows in
`nextclade.tsv`, and checks the placed tree with `augur validate export-v2`.

## Registering it in Cirro

| Setting | Value |
| --- | --- |
| Name | `Nextclade` |
| Entry point | `pipelines/nextclade/main.nf` |
| Configuration folder | `pipelines/nextclade/cirro` |
| Executor | Nextflow |
| Parent processes | `custom_dataset`, plus the NCBI ingest process once it is registered |

The name has to be exactly `Nextclade`. The input dataset reaches the pipeline as
`input` = `$.inputs[0].dataPath`, with no `preprocess.py`; see the build pipeline's
README for why.
