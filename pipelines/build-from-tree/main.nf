#!/usr/bin/env nextflow

nextflow.enable.dsl = 2

TREE_GLOB      = '**.{nwk,newick,tree,treefile}'
METADATA_GLOB  = '**.{tsv,csv}'
ALIGNMENT_GLOB = '**.{fasta,fa,fna}{,.gz,.xz,.zst}'

def helpMessage() {
    log.info """
    Nextstrain build from tree
    ==========================

    Takes an existing Newick tree and a metadata table, optionally with the alignment
    the tree was built from, and exports it for Auspice: refine (optionally a
    timetree), ancestral mutations when there is an alignment, traits, export.

    Inputs (each is found in --input unless given directly):
      --input                 Folder holding the tree, metadata and optional alignment.
      --tree                  Newick tree.
      --metadata              TSV or CSV with one row per tip.
      --alignment             FASTA alignment of the tips. Optional.
      --outdir                Where to publish auspice/ and results/.

    See docs/pipeline-params.md for every option.

    Example:
      nextflow run pipelines/build-from-tree/main.nf -profile docker \\
        --tree tree.nwk --metadata metadata.tsv --traits country --outdir out
    """.stripIndent()
}

// Every value interpolated into a task script is quoted for the shell, so a column
// name or title from the run form cannot run code.
def shellQuote(value) {
    return "'" + value.toString().replace("'", "'\\''") + "'"
}

def shellList(value) {
    return value.toString().split(',').collect { it.trim() }.findAll { it }.collect { shellQuote(it) }.join(' ')
}

// Exactly one file in --input matching glob, or null when none matches and the file
// is optional.
def findInInput(String glob, String what, String param, boolean required) {
    if (!params.input) {
        if (required) error "No --${param} given and no --input folder to look for ${what} in."
        return null
    }
    def found = files("${params.input.toString().replaceAll('/+$', '')}/${glob}")
    if (found.size() > 1) {
        error "Found ${found.size()} ${what} files in ${params.input}:\n  " +
              found.collect { it.toUriString() }.join('\n  ') +
              "\nChoose one with --${param}."
    }
    if (!found && required) {
        error "No ${what} file (${glob}) in ${params.input}. Pass --${param}."
    }
    return found ? found[0] : null
}

// An empty list binds a path input to nothing, for files the run may not have.
def optionalFile(value) {
    return value ? file(value, checkIfExists: true) : []
}

process REFINE {
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path tree, stageAs: 'input/*'
    path metadata
    path alignment

    output:
    path 'tree.nwk', emit: tree
    path 'branch_lengths.json', emit: node_data

    script:
    def timetree = params.timetree ? [
        '--timetree',
        '--date-confidence',
        '--date-inference marginal',
        params.clock_filter_iqd ? "--clock-filter-iqd ${params.clock_filter_iqd as double}" : '',
        params.clock_rate ? "--clock-rate ${params.clock_rate as double}" : '',
        params.clock_std_dev ? "--clock-std-dev ${params.clock_std_dev as double}" : '',
        params.coalescent ? "--coalescent ${shellQuote(params.coalescent)}" : '',
    ] : []
    def options = (timetree + [
        alignment ? "--alignment ${shellQuote(alignment)}" : '',
        params.root ? "--root ${shellList(params.root)}" : '',
    ]).findAll { it }.join(' \\\n        ')
    """
    augur refine \\
        --tree ${shellQuote(tree)} \\
        --metadata ${shellQuote(metadata)} \\
        --metadata-id-columns ${shellList(params.metadata_id_columns)} \\
        --output-tree tree.nwk \\
        --output-node-data branch_lengths.json \\
        ${options}
    """
}

process ANCESTRAL {
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path tree
    path alignment

    output:
    path 'nt_muts.json'

    script:
    """
    augur ancestral \\
        --tree ${tree} \\
        --alignment ${shellQuote(alignment)} \\
        --inference joint \\
        --output-node-data nt_muts.json
    """
}

process TRAITS {
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path tree
    path metadata

    output:
    path 'traits.json'

    script:
    """
    augur traits \\
        --tree ${tree} \\
        --metadata ${shellQuote(metadata)} \\
        --metadata-id-columns ${shellList(params.metadata_id_columns)} \\
        --columns ${shellList(params.traits)} \\
        --confidence \\
        --output-node-data traits.json
    """
}

process EXPORT {
    publishDir "${params.outdir}/auspice", mode: 'copy'

    input:
    path tree
    path metadata
    path node_data
    path auspice_config
    path lat_longs

    output:
    path "${params.name}*.json"

    script:
    def options = [
        params.title ? "--title ${shellQuote(params.title)}" : '',
        params.color_by ? "--color-by-metadata ${shellList(params.color_by)}" : '',
        params.geo_resolutions ? "--geo-resolutions ${shellList(params.geo_resolutions)}" : '',
        auspice_config ? "--auspice-config ${shellQuote(auspice_config)}" : '',
        lat_longs ? "--lat-longs ${shellQuote(lat_longs)}" : '',
        node_data.any { it.name == 'nt_muts.json' } ? '--include-root-sequence' : '',
    ].findAll { it }.join(' \\\n        ')
    """
    augur export v2 \\
        --tree ${tree} \\
        --metadata ${shellQuote(metadata)} \\
        --metadata-id-columns ${shellList(params.metadata_id_columns)} \\
        --node-data ${node_data} \\
        --output ${params.name}.json \\
        ${options}
    """
}

workflow {
    if (params.help) {
        helpMessage()
        return
    }
    if (!(params.name ==~ /[A-Za-z0-9][A-Za-z0-9_.-]*/) ||
        params.name ==~ /.*_(tip-frequencies|root-sequence|measurements)/) {
        error "--name '${params.name}' must be letters, digits, '.', '_' or '-', and must " +
              "not end in a sidecar suffix (_tip-frequencies, _root-sequence, _measurements)."
    }

    def tree = params.tree
        ? file(params.tree, checkIfExists: true)
        : findInInput(TREE_GLOB, 'tree', 'tree', true)
    def metadata = params.metadata
        ? file(params.metadata, checkIfExists: true)
        : findInInput(METADATA_GLOB, 'metadata', 'metadata', true)
    def alignment = params.alignment
        ? file(params.alignment, checkIfExists: true)
        : findInInput(ALIGNMENT_GLOB, 'alignment', 'alignment', false)

    if (params.timetree && !alignment) {
        error "A timetree needs the alignment the tree was built from. Pass --alignment, " +
              "or turn --timetree off."
    }

    REFINE(tree, metadata, alignment ?: [])

    node_data = REFINE.out.node_data
    if (alignment) {
        ANCESTRAL(REFINE.out.tree, alignment)
        node_data = node_data.mix(ANCESTRAL.out)
    }
    if (params.traits) {
        TRAITS(REFINE.out.tree, metadata)
        node_data = node_data.mix(TRAITS.out)
    }

    EXPORT(
        REFINE.out.tree,
        metadata,
        node_data.collect(),
        optionalFile(params.auspice_config),
        optionalFile(params.lat_longs),
    )
}
