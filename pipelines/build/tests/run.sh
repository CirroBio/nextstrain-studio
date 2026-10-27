#!/usr/bin/env bash
# Builds the Nextstrain zika tutorial (34 genomes, public/demo/zika) and validates the
# Auspice JSON. With --demo, also refreshes the app's demo build in public/demo/zika-build.
# Usage: pipelines/build/tests/run.sh [profile] [--demo]   (default profile: docker)
set -euo pipefail

PROFILE="${1:-docker}"
REFRESH_DEMO="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
# The process-wide container, which is the augur image.
IMAGE=$(sed -n "s/^ *container *= *'\(.*\)'/\1/p" "$HERE/../nextflow.config" | head -1)
DEMO="$HERE/../../../public/demo"
WORK="$(mktemp -d)"
cd "$WORK"

mkdir data
cp "$DEMO/zika/sequences.fasta" "$DEMO/zika/metadata.tsv" data/
cp -R "$DEMO/zika/config" config

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
if [ "$REFRESH_DEMO" = --demo ]; then
    cp output/auspice/*.json "$DEMO/zika-build/"
fi
echo "PASS: $WORK/output"
