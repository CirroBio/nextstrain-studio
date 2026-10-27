#!/usr/bin/env python3
"""Download virus genomes for a taxon from the NCBI Datasets v2 API.

Writes the genomes as FASTA and their data report as a TSV with one row per genome,
in the columns `dataformat tsv virus-genome` would give for the same field mnemonics,
plus `accession` (without version) and `url`.
"""

import argparse
import csv
import json
import shutil
import sys
import urllib.parse
import urllib.request
import zipfile

API = "https://api.ncbi.nlm.nih.gov/datasets/v2"
SEQUENCES = "ncbi_dataset/data/genomic.fna"
REPORT = "ncbi_dataset/data/data_report.jsonl"


def report_row(record):
    isolate = record.get("isolate", {})
    location = record.get("location", {})
    submitter = record.get("submitter", {})
    accession_version = record["accession"]
    return {
        "accession": accession_version.split(".")[0],
        "accession_version": accession_version,
        "sourcedb": record.get("sourceDatabase", ""),
        "sra-accs": ",".join(record.get("sraAccessions", [])),
        "isolate-lineage": isolate.get("name", ""),
        "geo-region": location.get("geographicRegion", ""),
        "geo-location": location.get("geographicLocation", ""),
        "isolate-collection-date": isolate.get("collectionDate", ""),
        "release-date": record.get("releaseDate", ""),
        "update-date": record.get("updateDate", ""),
        "length": record.get("length", ""),
        "completeness": record.get("completeness", ""),
        "host-name": record.get("host", {}).get("organismName", ""),
        "submitter-names": ",".join(submitter.get("names", [])),
        "submitter-affiliation": submitter.get("affiliation", ""),
        "url": f"https://www.ncbi.nlm.nih.gov/nuccore/{accession_version}",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--taxon", required=True, help="NCBI taxonomy ID or name")
    parser.add_argument("--released-since", help="YYYY-MM-DD")
    parser.add_argument("--complete-only", action="store_true")
    parser.add_argument("--host", help="host taxonomy name or ID")
    parser.add_argument("--output-sequences", required=True)
    parser.add_argument("--output-report", required=True)
    args = parser.parse_args()

    query = {"include_sequence": "GENOME", "aux_report": "DATASET_REPORT"}
    if args.released_since:
        query["released_since"] = f"{args.released_since}T00:00:00Z"
    if args.complete_only:
        query["complete_only"] = "true"
    if args.host:
        query["host"] = args.host
    url = (f"{API}/virus/taxon/{urllib.parse.quote(args.taxon, safe='')}/genome/download?"
           + urllib.parse.urlencode(query))
    print(f"Downloading {url}", file=sys.stderr)
    with urllib.request.urlopen(url) as response, open("ncbi_dataset.zip", "wb") as package:
        shutil.copyfileobj(response, package)

    with zipfile.ZipFile("ncbi_dataset.zip") as package:
        if SEQUENCES not in package.namelist():
            sys.exit(f"NCBI Virus has no genomes for taxon {args.taxon!r} with these filters.")
        with package.open(SEQUENCES) as source, open(args.output_sequences, "wb") as target:
            shutil.copyfileobj(source, target)
        rows = [report_row(json.loads(line)) for line in package.open(REPORT)]

    with open(args.output_report, "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), delimiter="\t",
                                lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Fetched {len(rows)} genomes", file=sys.stderr)


if __name__ == "__main__":
    main()
