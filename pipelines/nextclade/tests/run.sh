#!/usr/bin/env bash
# Runs Nextclade on five SARS-CoV-2 genomes from the dataset's own examples and
# validates the tree it places them on.
# Usage: pipelines/nextclade/tests/run.sh [profile]   (default: docker)
set -euo pipefail

PROFILE="${1:-docker}"
HERE="$(cd "$(dirname "$0")" && pwd)"
IMAGE=$(sed -n "s/^ *container *= *'\(.*\)'/\1/p" "$HERE/../nextflow.config")
EXAMPLES=https://raw.githubusercontent.com/nextstrain/nextclade_data/fe18bae64397665956048f392500231f37f662fe/data/nextstrain/sars-cov-2/wuhan-hu-1/orfs/sequences.fasta
WORK="$(mktemp -d)"
cd "$WORK"

mkdir data
curl -fsSL "$EXAMPLES" -o examples.fasta
awk '/^>/ { n++ } n > 5 { exit } { print }' examples.fasta > data/sequences.fasta

# Cirro always traces, which is what needs ps in the container.
nextflow run "$HERE/../main.nf" -profile "$PROFILE" -with-trace \
    --input data \
    --dataset_name nextstrain/sars-cov-2/wuhan-hu-1/orfs \
    --name sars-cov-2 \
    --outdir output

find output -type f | sort
test "$(tail -n +2 output/results/nextclade.tsv | wc -l)" -eq 5

validate() {
    if [ "$PROFILE" = docker ]; then
        docker run --rm -v "$WORK:$WORK" -w "$WORK" "$IMAGE" augur "$@"
    else
        augur "$@"
    fi
}
validate validate export-v2 output/auspice/sars-cov-2.json
echo "PASS: $WORK/output"
