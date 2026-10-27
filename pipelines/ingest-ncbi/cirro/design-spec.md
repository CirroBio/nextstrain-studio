---
workflow:
  name: Nextstrain NCBI Virus ingest
  repository: https://github.com/CirroBio/nextstrain-studio
  entrypoint: pipelines/ingest-ncbi/main.nf
  version: main
  executor: NEXTFLOW
inputs: []
parameters: []
outputs:
  - path: results/
    description: Intermediate and tabular results
    required: true
cirro:
  process_id: nextstrain-studio-ingest-ncbi
  category: Microbial Analysis
  data_type: Sequences and metadata
  parent_process_ids: [custom_dataset]
  child_process_ids: [nextstrain-studio-build, nextstrain-studio-nextclade]
  managed_parameters:
    - name: outdir
      role: output_directory
---

Registration record for `pipelines/ingest-ncbi`. Fetches virus genomes and metadata from NCBI Virus for a taxon and curates them with augur curate into sequences.fasta and metadata.tsv for a Nextstrain build. The form and input map Cirro uses are the files beside this one, read from this repository (config source WITH_PROCESS), as written. Parameters: docs/pipeline-params.md.
