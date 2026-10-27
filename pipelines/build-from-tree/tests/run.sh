#!/usr/bin/env bash
# Exports a neighbour-joining tree of the Nextstrain zika tutorial genomes
# (zika_tree.nwk, from 12-mer distances) with their metadata and no alignment, and
# validates the Auspice JSON.
# Usage: pipelines/build-from-tree/tests/run.sh [profile]   (default: docker)
set -euo pipefail

PROFILE="${1:-docker}"
HERE="$(cd "$(dirname "$0")" && pwd)"
# The process-wide container, which is the augur image.
IMAGE=$(sed -n "s/^ *container *= *'\(.*\)'/\1/p" "$HERE/../nextflow.config" | head -1)
ZIKA=https://raw.githubusercontent.com/nextstrain/zika-tutorial/c94859b0cc303302362b6cdd27efe503f4ba5523
WORK="$(mktemp -d)"
cd "$WORK"

mkdir data
cp "$HERE/zika_tree.nwk" data/
curl -fsSL "$ZIKA/data/metadata.tsv" -o data/metadata.tsv

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
