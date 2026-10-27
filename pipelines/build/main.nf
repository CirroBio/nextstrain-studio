#!/usr/bin/env nextflow

nextflow.enable.dsl = 2

// GenBank references from the Nextstrain pathogen repos, pinned to a commit so a
// preset always means the same coordinates.
REFERENCE_PRESETS = [
    'zika'           : 'https://raw.githubusercontent.com/nextstrain/zika/12de10fa311f032e85cca1fa02784f9b195748f6/phylogenetic/defaults/reference.gb',
    'measles-genome' : 'https://raw.githubusercontent.com/nextstrain/measles/c36dc5561cfd96e184f8e071d239f500507d9966/phylogenetic/defaults/measles_reference_genome.gb',
    'measles-n450'   : 'https://raw.githubusercontent.com/nextstrain/measles/c36dc5561cfd96e184f8e071d239f500507d9966/phylogenetic/defaults/measles_reference_N450.gb',
    'mpox-clade-i'   : 'https://raw.githubusercontent.com/nextstrain/mpox/8495d7b22cc1062455606db2ce1bcf180ff3e1d7/phylogenetic/defaults/clade-i/reference.gb',
    'mpox-clade-iib' : 'https://raw.githubusercontent.com/nextstrain/mpox/8495d7b22cc1062455606db2ce1bcf180ff3e1d7/phylogenetic/defaults/reference.gb',
    'dengue-denv1'   : 'https://raw.githubusercontent.com/nextstrain/dengue/b31c2b54a0ca89c4b7b48d64ca890ec09ee9c3a9/phylogenetic/defaults/denv1/reference.gb',
    'dengue-denv2'   : 'https://raw.githubusercontent.com/nextstrain/dengue/b31c2b54a0ca89c4b7b48d64ca890ec09ee9c3a9/phylogenetic/defaults/denv2/reference.gb',
    'dengue-denv3'   : 'https://raw.githubusercontent.com/nextstrain/dengue/b31c2b54a0ca89c4b7b48d64ca890ec09ee9c3a9/phylogenetic/defaults/denv3/reference.gb',
    'dengue-denv4'   : 'https://raw.githubusercontent.com/nextstrain/dengue/b31c2b54a0ca89c4b7b48d64ca890ec09ee9c3a9/phylogenetic/defaults/denv4/reference.gb',
    'rsv-a'          : 'https://raw.githubusercontent.com/nextstrain/rsv/7d91d8fd0ff98d3a33ad8191a8ad712d05904e58/config/areference.gbk',
    'rsv-b'          : 'https://raw.githubusercontent.com/nextstrain/rsv/7d91d8fd0ff98d3a33ad8191a8ad712d05904e58/config/breference.gbk',
]

SEQUENCE_GLOB = '**.{fasta,fa,fna}{,.gz,.xz,.zst}'
METADATA_GLOB = '**.{tsv,csv}'
GENBANK_GLOB  = '**.{gb,gbk,genbank}'

def helpMessage() {
    log.info """
    Nextstrain build
    ================

    Filters, aligns and builds a time-resolved phylogeny from sequences and metadata,
    and exports it for Auspice.

    Inputs (sequences and metadata are found in --input unless given directly):
      --input                 Folder holding the sequences and metadata.
      --sequences             FASTA of sequences.
      --metadata              TSV or CSV with one row per sequence.
      --reference_preset      One of: ${REFERENCE_PRESETS.keySet().join(', ')}
      --reference             GenBank reference. Without either, the one GenBank file
                              in --input is used.
      --outdir                Where to publish auspice/ and results/.

    See docs/pipeline-params.md for every option.

    Example:
      nextflow run pipelines/build/main.nf -profile docker \\
        --input zika-data/ --reference_preset zika --traits country --outdir out
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

process INDEX_AND_FILTER {
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path sequences
    path metadata
    path exclude

    output:
    path 'filtered.fasta', emit: sequences
    path 'filtered_metadata.tsv', emit: metadata
    path 'sequence_index.tsv'

    script:
    def options = [
        exclude ? "--exclude ${shellQuote(exclude)}" : '',
        params.group_by ? "--group-by ${shellList(params.group_by)}" : '',
        params.sequences_per_group ? "--sequences-per-group ${params.sequences_per_group as int}" : '',
        params.subsample_max_sequences ? "--subsample-max-sequences ${params.subsample_max_sequences as int}" : '',
        params.min_length ? "--min-length ${params.min_length as int}" : '',
        params.min_date ? "--min-date ${shellQuote(params.min_date)}" : '',
        params.max_date ? "--max-date ${shellQuote(params.max_date)}" : '',
    ].findAll { it }.join(' \\\n        ')
    """
    augur index --sequences ${shellQuote(sequences)} --output sequence_index.tsv

    augur filter \\
        --sequences ${shellQuote(sequences)} \\
        --sequence-index sequence_index.tsv \\
        --metadata ${shellQuote(metadata)} \\
        --metadata-id-columns ${shellList(params.metadata_id_columns)} \\
        --output-sequences filtered.fasta \\
        --output-metadata filtered_metadata.tsv \\
        ${options}
    """
}

process ALIGN {
    label 'process_medium'
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path sequences
    path reference

    output:
    path 'aligned.fasta'

    script:
    """
    augur align \\
        --sequences ${sequences} \\
        --reference-sequence ${shellQuote(reference)} \\
        --remove-reference \\
        --fill-gaps \\
        --nthreads ${task.cpus} \\
        --output aligned.fasta
    """
}

process TREE {
    label 'process_medium'
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path alignment

    output:
    path 'tree_raw.nwk'

    script:
    """
    augur tree --alignment ${alignment} --nthreads ${task.cpus} --output tree_raw.nwk
    """
}

process REFINE {
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path tree
    path alignment
    path metadata

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
        params.root ? "--root ${shellList(params.root)}" : '',
    ]).findAll { it }.join(' \\\n        ')
    """
    augur refine \\
        --tree ${tree} \\
        --alignment ${alignment} \\
        --metadata ${metadata} \\
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
        --alignment ${alignment} \\
        --inference joint \\
        --output-node-data nt_muts.json
    """
}

process TRANSLATE {
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path tree
    path nt_muts
    path reference

    output:
    path 'aa_muts.json'

    script:
    """
    augur translate \\
        --tree ${tree} \\
        --ancestral-sequences ${nt_muts} \\
        --reference-sequence ${shellQuote(reference)} \\
        --output-node-data aa_muts.json
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
        --metadata ${metadata} \\
        --metadata-id-columns ${shellList(params.metadata_id_columns)} \\
        --columns ${shellList(params.traits)} \\
        --confidence \\
        --output-node-data traits.json
    """
}

process TIP_FREQUENCIES {
    publishDir "${params.outdir}/auspice", mode: 'copy'

    input:
    path tree
    path metadata

    output:
    path "${params.name}_tip-frequencies.json"

    script:
    """
    augur frequencies \\
        --method kde \\
        --tree ${tree} \\
        --metadata ${metadata} \\
        --metadata-id-columns ${shellList(params.metadata_id_columns)} \\
        --output ${params.name}_tip-frequencies.json
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
    path "${params.name}.json"
    path "${params.name}_root-sequence.json"

    script:
    def options = [
        params.title ? "--title ${shellQuote(params.title)}" : '',
        params.color_by ? "--color-by-metadata ${shellList(params.color_by)}" : '',
        params.geo_resolutions ? "--geo-resolutions ${shellList(params.geo_resolutions)}" : '',
        auspice_config ? "--auspice-config ${shellQuote(auspice_config)}" : '',
        lat_longs ? "--lat-longs ${shellQuote(lat_longs)}" : '',
    ].findAll { it }.join(' \\\n        ')
    """
    augur export v2 \\
        --tree ${tree} \\
        --metadata ${metadata} \\
        --metadata-id-columns ${shellList(params.metadata_id_columns)} \\
        --node-data ${node_data} \\
        --include-root-sequence \\
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
    if (params.reference_preset && params.reference) {
        error "Pass --reference_preset or --reference, not both."
    }
    if (params.reference_preset && !REFERENCE_PRESETS.containsKey(params.reference_preset)) {
        error "Unknown --reference_preset '${params.reference_preset}'. " +
              "Choose one of: ${REFERENCE_PRESETS.keySet().join(', ')}"
    }

    def sequences = params.sequences
        ? file(params.sequences, checkIfExists: true)
        : findInInput(SEQUENCE_GLOB, 'sequence', 'sequences', true)
    def metadata = params.metadata
        ? file(params.metadata, checkIfExists: true)
        : findInInput(METADATA_GLOB, 'metadata', 'metadata', true)
    def reference = params.reference_preset ? file(REFERENCE_PRESETS[params.reference_preset])
        : params.reference ? file(params.reference, checkIfExists: true)
        : findInInput(GENBANK_GLOB, 'GenBank reference', 'reference', true)

    INDEX_AND_FILTER(sequences, metadata, optionalFile(params.exclude))
    ALIGN(INDEX_AND_FILTER.out.sequences, reference)
    TREE(ALIGN.out)
    REFINE(TREE.out, ALIGN.out, INDEX_AND_FILTER.out.metadata)
    ANCESTRAL(REFINE.out.tree, ALIGN.out)
    TRANSLATE(REFINE.out.tree, ANCESTRAL.out, reference)

    node_data = REFINE.out.node_data.mix(ANCESTRAL.out, TRANSLATE.out)
    if (params.traits) {
        TRAITS(REFINE.out.tree, INDEX_AND_FILTER.out.metadata)
        node_data = node_data.mix(TRAITS.out)
    }
    if (params.timetree) {
        TIP_FREQUENCIES(REFINE.out.tree, INDEX_AND_FILTER.out.metadata)
    }

    EXPORT(
        REFINE.out.tree,
        INDEX_AND_FILTER.out.metadata,
        node_data.collect(),
        optionalFile(params.auspice_config),
        optionalFile(params.lat_longs),
    )
}
