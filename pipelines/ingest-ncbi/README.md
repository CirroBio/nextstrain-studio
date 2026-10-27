# Nextstrain NCBI Virus ingest

Fetches virus genomes and metadata for an NCBI taxon from NCBI Virus with
[NCBI Datasets](https://www.ncbi.nlm.nih.gov/datasets/), and curates them with
`augur curate` along the lines of the
[Nextstrain pathogen repo guide's ingest](https://github.com/nextstrain/pathogen-repo-guide/tree/main/ingest).
The output is a valid input for the build and Nextclade pipelines. Every parameter is
listed in [`docs/pipeline-params.md`](../../docs/pipeline-params.md).

## Steps

| Process | What it does |
| --- | --- |
| `FETCH` | `datasets download virus genome taxon` with the chosen filters, then `dataformat tsv virus-genome` for the metadata |
| `CURATE` | `augur curate`: rename fields, normalize strings, format dates, parse the GenBank location into country/division/location, titlecase places, abbreviate authors, apply Nextstrain's geolocation rules; then add an NCBI URL and keep the columns below |

A run whose filters match no genomes fails with that message, rather than
publishing empty files.

## Outputs

```
<outdir>/results/sequences.fasta   named by GenBank accession, without version
<outdir>/results/metadata.tsv
```

The accession is the strain name because it is always present and unique, which the
isolate name is not. The isolate name is kept in `isolate`.

Metadata columns: `strain`, `accession_version`, `isolate`, `date`, `region`, `country`,
`division`, `location`, `host`, `length`, `completeness`, `database`, `date_released`,
`date_updated`, `authors`, `full_authors`, `institution`, `sra_accessions`, `url`.

## Running it

```bash
nextflow run pipelines/ingest-ncbi/main.nf -profile docker \
  --taxon_id 64320 --released_since 2024-01-01 --complete_only true --outdir output
```

## Test

```bash
pipelines/ingest-ncbi/tests/run.sh       # or: run.sh local
```

Fetches the Zika virus (taxon 64320) records released since 2026-09-01 and checks that
every sequence has exactly one metadata row keyed on `strain`. It needs network access
to NCBI, and the record count grows as NCBI adds records.

## Registering it in Cirro

| Setting | Value |
| --- | --- |
| Name | `Nextstrain NCBI Virus ingest` |
| Entry point | `pipelines/ingest-ncbi/main.nf` |
| Configuration folder | `pipelines/ingest-ncbi/cirro` |
| Executor | Nextflow |

The name has to be exactly `Nextstrain NCBI Virus ingest`. The pipeline reads nothing
from its input dataset, so `process-input.json` doesn't map one.
