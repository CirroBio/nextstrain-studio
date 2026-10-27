#!/usr/bin/env bash
# Builds the Nextstrain zika tutorial (34 genomes) and validates the Auspice JSON.
# Usage: pipelines/build/tests/run.sh [profile]   (default: docker)
set -euo pipefail

PROFILE="${1:-docker}"
HERE="$(cd "$(dirname "$0")" && pwd)"
IMAGE=$(sed -n "s/^ *container *= *'\(.*\)'/\1/p" "$HERE/../nextflow.config")
ZIKA=https://raw.githubusercontent.com/nextstrain/zika-tutorial/c94859b0cc303302362b6cdd27efe503f4ba5523
WORK="$(mktemp -d)"
cd "$WORK"

mkdir data config
curl -fsSL "$ZIKA/data/sequences.fasta" -o data/sequences.fasta
curl -fsSL "$ZIKA/data/metadata.tsv" -o data/metadata.tsv
for f in auspice_config.json lat_longs.tsv dropped_strains.txt; do
    curl -fsSL "$ZIKA/config/$f" -o "config/$f"
done

# Cirro always traces, which is what needs ps in the container.
nextflow run "$HERE/../main.nf" -profile "$PROFILE" -with-trace \
    --input data \
    --reference_preset zika \
    --exclude config/dropped_strains.txt \
    --group_by country,year,month \
    --sequences_per_group 20 \
    --min_length 5385 \
    --traits region,country \
    --color_by region,country \
    --geo_resolutions region,country \
    --auspice_config config/auspice_config.json \
    --lat_longs config/lat_longs.tsv \
    --title 'Zika tutorial' \
    --name zika \
    --outdir output

find output -type f | sort

validate() {
    if [ "$PROFILE" = docker ]; then
        docker run --rm -v "$WORK:$WORK" -w "$WORK" "$IMAGE" augur "$@"
    else
        augur "$@"
    fi
}
validate validate export-v2 output/auspice/zika.json
echo "PASS: $WORK/output"
