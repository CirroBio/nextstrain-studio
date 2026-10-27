# Nextstrain build from tree

For trees made with other tools: takes an existing Newick tree and a metadata table,
optionally with the alignment the tree was built from, and exports them for Auspice.
Writes a Nextstrain dataset as described in
[`docs/dataset-layout.md`](../../docs/dataset-layout.md). Every parameter is listed in
[`docs/pipeline-params.md`](../../docs/pipeline-params.md).

## Steps

| Process | augur command | Runs when |
| --- | --- | --- |
| `REFINE` | `refine`, a timetree with `--timetree` (optional clock rate, root, coalescent) | always |
| `ANCESTRAL` | `ancestral --inference joint` | there is an alignment |
| `TRAITS` | `traits --confidence` on the chosen columns | `--traits` is set |
| `EXPORT` | `export v2`, with the root sequence when there is an alignment | always |

## Inputs

Each input is found in the `--input` folder when it isn't given directly: the one
`*.nwk`/`*.newick`/`*.tree`/`*.treefile`, the one `*.tsv`/`*.csv`, and the one FASTA if
there is one (an alignment is optional). More than one candidate is refused with the
list.

The tree's tip names must match the metadata's strain column (`strain`, or
`--metadata_id_columns`). Branch lengths should be in substitutions per site. A
timetree needs a `date` column and the alignment.

## Outputs

```
<outdir>/
  auspice/<name>.json
  auspice/<name>_root-sequence.json   only with an alignment
  results/tree.nwk, branch_lengths.json, nt_muts.json, traits.json
```

## Running it

```bash
nextflow run pipelines/build-from-tree/main.nf -profile docker \
  --tree tree.nwk --metadata metadata.tsv --traits country --outdir output
```

## Test

```bash
pipelines/build-from-tree/tests/run.sh   # or: run.sh local
```

Exports `tests/zika_tree.nwk`, a rough neighbour-joining tree of the 34 zika tutorial
genomes (from 12-mer distances, standing in for a tree made by another tool), with the tutorial's metadata and no alignment (so no timetree),
reconstructing `country`, and checks the result with `augur validate export-v2`.

## Registering it in Cirro

| Setting | Value |
| --- | --- |
| Name | `Nextstrain build from tree` |
| Entry point | `pipelines/build-from-tree/main.nf` |
| Configuration folder | `pipelines/build-from-tree/cirro` |
| Executor | Nextflow |
| Parent processes | `custom_dataset` |

The name has to be exactly `Nextstrain build from tree`. The input dataset reaches the
pipeline as `input` = `$.inputs[0].dataPath`, with no `preprocess.py`; see the build
pipeline's README for why.
