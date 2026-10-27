#!/usr/bin/env python3
"""Drop repeated meta.filters entries from an Auspice JSON, keeping the first of each.

Nextclade's --output-tree repeats some (e.g. clade_membership for SARS-CoV-2), which
fails the Auspice v2 schema's uniqueness rule.
"""

import json
import sys

source, target = sys.argv[1:]
with open(source) as handle:
    dataset = json.load(handle)
dataset["meta"]["filters"] = list(dict.fromkeys(dataset["meta"].get("filters", [])))
with open(target, "w") as handle:
    json.dump(dataset, handle, indent=None, separators=(",", ":"))
