#!/usr/bin/env python3
"""Write the given columns of a TSV to stdout, in the given order."""

import csv
import sys

table, columns = sys.argv[1], sys.argv[2:]
with open(table, newline="") as handle:
    reader = csv.DictReader(handle, delimiter="\t")
    missing = [column for column in columns if column not in reader.fieldnames]
    if missing:
        sys.exit(f"{table} has no column(s) {', '.join(missing)}")
    writer = csv.DictWriter(sys.stdout, fieldnames=columns, delimiter="\t",
                            lineterminator="\n", extrasaction="ignore")
    writer.writeheader()
    writer.writerows(reader)
