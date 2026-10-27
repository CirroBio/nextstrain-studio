#!/usr/bin/env nextflow

nextflow.enable.dsl = 2

// NCBI Datasets field mnemonics, in output order. See
// https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/command-line/dataformat/tsv/dataformat_tsv_virus-genome/#fields
NCBI_FIELDS = [
    'accession', 'sourcedb', 'sra-accs', 'isolate-lineage', 'geo-region', 'geo-location',
    'isolate-collection-date', 'release-date', 'update-date', 'length', 'completeness',
    'host-name', 'submitter-names', 'submitter-affiliation',
]

// The accession becomes the strain name: unlike the isolate name it is always present
// and unique, so the output can go straight into a build keyed on `strain`.
FIELD_MAP = [
    'accession'              : 'strain',
    'sourcedb'               : 'database',
    'sra-accs'               : 'sra_accessions',
    'isolate-lineage'        : 'isolate',
    'geo-region'             : 'region',
    'geo-location'           : 'location',
    'isolate-collection-date': 'date',
    'release-date'           : 'date_released',
    'update-date'            : 'date_updated',
    'host-name'              : 'host',
    'submitter-names'        : 'full_authors',
    'submitter-affiliation'  : 'institution',
]

METADATA_COLUMNS = [
    'strain', 'accession_version', 'isolate', 'date', 'region', 'country', 'division',
    'location', 'host', 'length', 'completeness', 'database', 'date_released',
    'date_updated', 'authors', 'full_authors', 'institution', 'sra_accessions', 'url',
]

def helpMessage() {
    log.info """
    Nextstrain: NCBI Virus ingest
    =============================

    Fetches virus genomes and their metadata from NCBI Virus with NCBI Datasets, and
    curates them with augur curate into results/sequences.fasta and
    results/metadata.tsv, ready to be the input of a Nextstrain build.

    Inputs:
      --taxon_id              NCBI taxon ID or name, e.g. 64320 for Zika virus. Required.
      --released_since        Only records released on or after this date (YYYY-MM-DD).
      --complete_only         Only complete genomes.
      --host                  Only records from this host (NCBI taxonomy name or ID).
      --outdir                Where to publish results/.

    Example:
      nextflow run pipelines/ingest-ncbi/main.nf -profile docker \\
        --taxon_id 64320 --released_since 2024-01-01 --outdir out
    """.stripIndent()
}

def shellQuote(value) {
    return "'" + value.toString().replace("'", "'\\''") + "'"
}

process FETCH {
    input:
    val taxon_id

    output:
    path 'ncbi_sequences.fasta', emit: sequences
    path 'ncbi_report.tsv', emit: report

    script:
    def filters = [
        params.complete_only ? '--complete-only' : '',
        params.released_since ? "--released-after ${shellQuote(params.released_since)}" : '',
        params.host ? "--host ${shellQuote(params.host)}" : '',
    ].findAll { it }.join(' ')
    def fields = NCBI_FIELDS.join(',')
    """
    datasets download virus genome taxon ${shellQuote(taxon_id)} ${filters} \\
        --no-progressbar \\
        --filename ncbi_dataset.zip

    unzip -jp ncbi_dataset.zip ncbi_dataset/data/genomic.fna > ncbi_sequences.fasta
    if [ ! -s ncbi_sequences.fasta ]; then
        echo "NCBI Virus has no genomes for taxon ${shellQuote(taxon_id)} with these filters." >&2
        exit 1
    fi

    dataformat tsv virus-genome \\
        --package ncbi_dataset.zip \\
        --fields ${fields} \\
        --elide-header \\
        | csvtk fix-quotes -Ht \\
        | csvtk add-header -t -n ${fields} \\
        | csvtk rename -t -f accession -n accession_version \\
        | csvtk mutate -t -f accession_version -n accession -p '^(.+?)\\.' --at 1 \\
        > ncbi_report.tsv
    """
}

process CURATE {
    publishDir "${params.outdir}/results", mode: 'copy'

    input:
    path sequences
    path report

    output:
    path 'sequences.fasta'
    path 'metadata.tsv'

    script:
    def field_map = FIELD_MAP.collect { from, to -> shellQuote("${from}=${to}") }.join(' ')
    """
    augur curate passthru \\
        --metadata ${report} \\
        --fasta ${sequences} \\
        --seq-id-column accession_version \\
        --seq-field sequence \\
        --unmatched-reporting warn \\
        --duplicate-reporting warn \\
        | augur curate rename --field-map ${field_map} \\
        | augur curate normalize-strings \\
        | augur curate format-dates \\
            --date-fields date date_released date_updated \\
            --expected-date-formats '%Y' '%Y-%m' '%Y-%m-%d' '%Y-%m-%dT%H:%M:%SZ' \\
        | augur curate parse-genbank-location --location-field location \\
        | augur curate titlecase \\
            --titlecase-fields region country division location \\
            --abbreviations USA \\
            --articles and d de del des di do en l la las le los nad of op sur the y \\
        | augur curate abbreviate-authors \\
            --authors-field full_authors \\
            --default-value '?' \\
            --abbr-authors-field authors \\
        | augur curate apply-geolocation-rules \\
            --output-metadata curated.tsv \\
            --output-fasta sequences.fasta \\
            --output-id-field strain \\
            --output-seq-field sequence

    csvtk mutate2 -t -n url -e '"https://www.ncbi.nlm.nih.gov/nuccore/" + \$accession_version' curated.tsv \\
        | csvtk cut -t -f ${METADATA_COLUMNS.join(',')} \\
        > metadata.tsv
    """
}

workflow {
    if (params.help) {
        helpMessage()
        return
    }
    if (!params.taxon_id) {
        error "No --taxon_id given. Look one up at https://www.ncbi.nlm.nih.gov/taxonomy, " +
              "e.g. 64320 for Zika virus."
    }
    if (params.released_since && !(params.released_since.toString() ==~ /\d{4}-\d{2}-\d{2}/)) {
        error "--released_since '${params.released_since}' must be a date, YYYY-MM-DD."
    }

    FETCH(params.taxon_id.toString())
    CURATE(FETCH.out.sequences, FETCH.out.report)
}
