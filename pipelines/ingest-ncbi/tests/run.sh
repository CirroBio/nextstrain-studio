#!/usr/bin/env bash
# Fetches the Zika virus records NCBI released since 2026-09-01 (five at the time of
# writing) and checks that every sequence has a metadata row keyed on strain.
# Usage: pipelines/ingest-ncbi/tests/run.sh [profile]   (default: docker)
set -euo pipefail

PROFILE="${1:-docker}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
cd "$WORK"

# Cirro always traces, which is what needs ps in the container.
nextflow run "$HERE/../main.nf" -profile "$PROFILE" -with-trace \
    --taxon_id 64320 \
    --released_since 2026-09-01 \
    --outdir output

find output -type f | sort
head -1 output/results/metadata.tsv | cut -f1 | grep -qx strain
n_sequences=$(grep -c '^>' output/results/sequences.fasta)
n_rows=$(tail -n +2 output/results/metadata.tsv | wc -l | tr -d ' ')
test "$n_sequences" -ge 1
test "$n_sequences" -eq "$n_rows"
diff <(grep '^>' output/results/sequences.fasta | cut -c2- | sort) \
     <(tail -n +2 output/results/metadata.tsv | cut -f1 | sort)
echo "PASS: $n_sequences records in $WORK/output"
