#!/usr/bin/env nextflow

nextflow.enable.dsl = 2

SEQUENCE_GLOB = '**.{fasta,fa,fna}{,.gz,.xz,.zst}'

def helpMessage() {
    log.info """
    Nextclade
    =========

    Downloads a Nextclade dataset and runs Nextclade on the input sequences: clade
    assignment, QC, alignment, translations, and placement on the dataset's reference
    tree for Auspice.

    Inputs:
      --dataset_name          Nextclade dataset, e.g. nextstrain/sars-cov-2/wuhan-hu-1/orfs
      --dataset_tag           Dataset version tag. Latest when not given.
      --input                 Folder holding the sequences.
      --sequences             FASTA of sequences, instead of finding it in --input.
      --name                  Stem of the Auspice JSON (default nextclade).
      --outdir                Where to publish auspice/ and results/.

    Example:
      nextflow run pipelines/nextclade/main.nf -profile docker \\
        --dataset_name nextstrain/sars-cov-2/wuhan-hu-1/orfs \\
        --sequences seqs.fasta --outdir out
    """.stripIndent()
}

def shellQuote(value) {
    return "'" + value.toString().replace("'", "'\\''") + "'"
}

process NEXTCLADE {
    label 'process_medium'
    publishDir "${params.outdir}/results", mode: 'copy', pattern: '{nextclade.*,translations}'

    input:
    path sequences

    output:
    path 'nextclade.tsv'
    path 'nextclade.aligned.fasta'
    path 'translations'
    path 'placed_tree.json', optional: true, emit: tree

    script:
    def tag = params.dataset_tag ? "--tag ${shellQuote(params.dataset_tag)}" : ''
    """
    nextclade dataset get --name ${shellQuote(params.dataset_name)} ${tag} --output-dir dataset

    # Not every dataset has a reference tree to place sequences on.
    output_tree=""
    if [ -f dataset/tree.json ]; then
        output_tree="--output-tree placed_tree.json"
    fi

    mkdir translations
    nextclade run \\
        --input-dataset dataset \\
        --jobs ${task.cpus} \\
        --output-tsv nextclade.tsv \\
        --output-fasta nextclade.aligned.fasta \\
        --output-translations 'translations/{cds}.translation.fasta' \\
        \$output_tree \\
        ${shellQuote(sequences)}
    """
}

process DEDUPE_FILTERS {
    publishDir "${params.outdir}/auspice", mode: 'copy'

    input:
    path tree, stageAs: 'placed/*'

    output:
    path "${params.name}.json"

    script:
    """
    dedupe_filters.py ${tree} ${params.name}.json
    """
}

workflow {
    if (params.help) {
        helpMessage()
        return
    }
    if (!params.dataset_name) {
        error "No --dataset_name given, e.g. nextstrain/sars-cov-2/wuhan-hu-1/orfs. " +
              "Run 'nextclade dataset list' for the full list."
    }
    if (!(params.name ==~ /[A-Za-z0-9][A-Za-z0-9_.-]*/) ||
        params.name ==~ /.*_(tip-frequencies|root-sequence|measurements)/) {
        error "--name '${params.name}' must be letters, digits, '.', '_' or '-', and must " +
              "not end in a sidecar suffix (_tip-frequencies, _root-sequence, _measurements)."
    }

    def sequences
    if (params.sequences) {
        sequences = file(params.sequences, checkIfExists: true)
    } else if (params.input) {
        def found = files("${params.input.toString().replaceAll('/+$', '')}/${SEQUENCE_GLOB}")
        if (found.size() != 1) {
            error "Expected one sequence file (${SEQUENCE_GLOB}) in ${params.input}, found " +
                  "${found.size()}${found ? ':\n  ' + found.collect { it.toUriString() }.join('\n  ') : ''}." +
                  "\nChoose one with --sequences."
        }
        sequences = found[0]
    } else {
        error "Pass --sequences, or --input with a folder holding one FASTA."
    }

    NEXTCLADE(sequences)
    DEDUPE_FILTERS(NEXTCLADE.out.tree)
}
