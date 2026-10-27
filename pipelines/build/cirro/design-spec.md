---
workflow:
  name: Nextstrain build
  repository: https://github.com/CirroBio/nextstrain-studio
  entrypoint: pipelines/build/main.nf
  version: main
  executor: NEXTFLOW
inputs:
  - name: input
    description: The input dataset's folder, searched for the files this pipeline reads (docs/dataset-layout.md)
    type: folder
    required: true
parameters: []
outputs:
  - path: auspice/
    description: Auspice JSON and sidecars
    required: true
  - path: results/
    description: Intermediate and tabular results
    required: true
cirro:
  process_id: nextstrain-studio-build
  category: Microbial Analysis
  data_type: Nextstrain dataset
  parent_process_ids: [custom_dataset, nextstrain-studio-ingest-ncbi]
  child_process_ids: []
  managed_parameters:
    - name: outdir
      role: output_directory
---

Registration record for `pipelines/build`. Filters, aligns and builds a time-resolved phylogeny with augur from sequences and metadata, and exports it for Auspice. The form and input map Cirro uses are the files beside this one, read from this repository (config source WITH_PROCESS), as written. Parameters: docs/pipeline-params.md.
