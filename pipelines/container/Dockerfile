# nextstrain/base plus procps. Nextflow runs `ps` inside every task to collect metrics
# whenever tracing is on, which it always is on Cirro, and nextstrain/base has no ps,
# so every task would fail with "Command 'ps' required by nextflow".
FROM nextstrain/base:build-20261026T235949Z

RUN apt-get update \
    && apt-get install -y --no-install-recommends procps \
    && rm -rf /var/lib/apt/lists/*
