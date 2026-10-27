#!/usr/bin/env nextflow

nextflow.enable.dsl = 2

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
    Nextstrain NCBI Virus ingest
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
    output:
    path 'ncbi_sequences.fasta', emit: sequences
    path 'ncbi_report.tsv', emit: report

    script:
    def filters = [
        params.complete_only ? '--complete-only' : '',
        params.released_since ? "--released-since ${shellQuote(params.released_since)}" : '',
        params.host ? "--host ${shellQuote(params.host)}" : '',
    ].findAll { it }.join(' ')
    """
    fetch_ncbi_virus.py --taxon ${shellQuote(params.taxon_id)} ${filters} \\
        --output-sequences ncbi_sequences.fasta \\
        --output-report ncbi_report.tsv
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

    select_columns.py curated.tsv ${METADATA_COLUMNS.join(' ')} > metadata.tsv
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

    FETCH()
    CURATE(FETCH.out.sequences, FETCH.out.report)
}
