#!/usr/bin/env bash
# Exports a neighbour-joining tree of the Nextstrain zika tutorial genomes
# (public/demo/zika-tree, from 12-mer distances) with their metadata and no alignment,
# and validates the Auspice JSON.
# Usage: pipelines/build-from-tree/tests/run.sh [profile]   (default: docker)
set -euo pipefail

PROFILE="${1:-docker}"
HERE="$(cd "$(dirname "$0")" && pwd)"
# The process-wide container, which is the augur image.
IMAGE=$(sed -n "s/^ *container *= *'\(.*\)'/\1/p" "$HERE/../nextflow.config" | head -1)
DEMO="$HERE/../../../public/demo/zika-tree"
WORK="$(mktemp -d)"
cd "$WORK"

mkdir data
cp "$DEMO/tree.nwk" "$DEMO/metadata.tsv" data/

# Cirro always traces, which is what needs ps in the container.
nextflow run "$HERE/../main.nf" -profile "$PROFILE" -with-trace \
    --input data \
    --traits country \
    --color_by region,country \
    --geo_resolutions country \
    --name zika-tree \
    --outdir output

find output -type f | sort

validate() {
    if [ "$PROFILE" = docker ]; then
        docker run --rm -v "$WORK:$WORK" -w "$WORK" "$IMAGE" augur "$@"
    else
        augur "$@"
    fi
}
validate validate export-v2 output/auspice/zika-tree.json
echo "PASS: $WORK/output"
