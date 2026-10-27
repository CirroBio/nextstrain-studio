# Demo data

Small public data for trying Nextstrain Studio's pipelines and uploads on a Cirro project. The app offers each set where it fits: **New build** adds an input set to a project, and **Upload a build** and **Open files** offer the demo build.

| Folder | What | Used by |
| --- | --- | --- |
| `zika/` | 34 Zika virus genomes (`sequences.fasta`) and their metadata (`metadata.tsv`) from GenBank, 2013–2016: the input of [Nextstrain's Zika tutorial](https://github.com/nextstrain/zika-tutorial/tree/c94859b0cc303302362b6cdd27efe503f4ba5523). `config/` holds the tutorial's Auspice config, coordinates and dropped strains. | The Nextstrain build pipeline, with the `zika` reference; `pipelines/build/tests/run.sh` |
| `zika-tree/` | A neighbour-joining tree of the same genomes (from 12-mer distances, as if made by another tool) and their metadata | The build-from-tree pipeline; `pipelines/build-from-tree/tests/run.sh` |
| `zika-build/` | The Auspice dataset the build pipeline makes from `zika/` | Upload and viewing; refreshed by `pipelines/build/tests/run.sh docker --demo` |

The sequences and metadata are public GenBank records, as curated for the tutorial; the papers they come from are in the metadata's `title`, `journal` and `paper_url` columns.
