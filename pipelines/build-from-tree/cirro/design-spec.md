---
workflow:
  name: Nextstrain build from tree
  repository: https://github.com/CirroBio/nextstrain-studio
  entrypoint: pipelines/build-from-tree/main.nf
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
  process_id: nextstrain-studio-build-from-tree
  category: Microbial Analysis
  data_type: Nextstrain dataset
  parent_process_ids: [custom_dataset]
  child_process_ids: []
  managed_parameters:
    - name: outdir
      role: output_directory
---

Registration record for `pipelines/build-from-tree`. Exports an existing Newick tree and its metadata for Auspice, with optional timetree, ancestral mutations and trait reconstruction. The form and input map Cirro uses are the files beside this one, read from this repository (config source WITH_PROCESS), as written. Parameters: docs/pipeline-params.md.
