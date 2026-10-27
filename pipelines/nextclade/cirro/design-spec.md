---
workflow:
  name: Nextclade
  repository: https://github.com/CirroBio/nextstrain-studio
  entrypoint: pipelines/nextclade/main.nf
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
  process_id: nextstrain-studio-nextclade
  category: Microbial Analysis
  data_type: Nextclade results
  parent_process_ids: [custom_dataset, nextstrain-studio-ingest-ncbi]
  child_process_ids: []
  managed_parameters:
    - name: outdir
      role: output_directory
---

Registration record for `pipelines/nextclade`. Assigns clades, checks quality, aligns and translates sequences with Nextclade, and places them on the dataset's reference tree for Auspice. The form and input map Cirro uses are the files beside this one, read from this repository (config source WITH_PROCESS), as written. Parameters: docs/pipeline-params.md.
