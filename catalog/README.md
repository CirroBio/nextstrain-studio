# Public catalog

`datasets.json` lists the datasets on Nextstrain Studio's **Public datasets** page. The app links to each dataset where it is published; nothing is copied here. The page also lists everything nextstrain.org itself lists, so the catalog is mainly for community builds, datasets hosted elsewhere, and a description to go with each.

## Adding a dataset

Open a pull request that adds an entry to `datasets.json`:

```json
{
  "id": "your-lab-h5n1-2026",
  "title": "H5N1 in Pacific Northwest poultry, 2026",
  "pathogen": "Influenza A/H5N1",
  "maintainer": "Your Lab",
  "source": { "nextstrain": "community/your-lab/outbreak-builds/h5n1/2026" },
  "description": "One sentence on what the build covers.",
  "tags": ["influenza", "outbreak"]
}
```

- `id`: lowercase letters, digits and dashes; unique and stable.
- `pathogen`: groups entries on the page. Reuse an existing pathogen's spelling where there is one.
- `source`: exactly one of:
  - `nextstrain`: a path on nextstrain.org: a core dataset (`zika`), a community build (`community/<owner>/<repo>/<name>`) or a group's (`groups/<group>/<name>`);
  - `url`: an `https://` URL of a main Auspice JSON that any site may read (CORS), such as a file in a public S3 bucket. Sidecars (`_tip-frequencies.json`, `_root-sequence.json`, `_measurements.json`) are looked for next to it.

A community build is a public GitHub repository with the dataset at `auspice/<repo>_<name>.json`; see [Nextstrain's guide](https://docs.nextstrain.org/en/latest/guides/share/community-builds.html). Nextstrain Studio's **Publish** button names the files that way for a build in a Cirro project.

Publish only data you may share openly.

## Checks

CI runs `node catalog/check.mjs` on every pull request that touches the catalog, and weekly. It checks the fields, and that every dataset loads from another site as an Auspice v2 JSON. Run it yourself with `npm run check-catalog`.
