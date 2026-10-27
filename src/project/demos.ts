import type { PipelineKey } from "../cirro/pipelines";

// Demo data shipped with the site (public/demo/, described in its README.md), for trying the app's
// pipelines and uploads on a project without bringing data of one's own.

export type Demo = { id: string; title: string; description: string; files: string[]; params?: Record<string, unknown> };

const DEMO_ROOT = `${import.meta.env.BASE_URL}demo/`;

export const DEMO_BUILD: Demo = {
  id: "zika-build",
  title: "Zika tutorial build",
  description: "The demo sequences built by the Nextstrain build pipeline: an Auspice dataset with its root sequence and frequencies.",
  files: ["zika.json", "zika_root-sequence.json", "zika_tip-frequencies.json"],
};

// Inputs for the pipelines that read a dataset; the NCBI ingest needs none.
export const DEMO_INPUTS: Partial<Record<PipelineKey, Demo>> = {
  build: {
    id: "zika",
    title: "Zika tutorial: 34 genomes",
    description: "Sequences and metadata from Nextstrain's Zika tutorial (GenBank, 2013–2016). Build with the Zika reference.",
    files: ["sequences.fasta", "metadata.tsv"],
    params: { reference_preset: "zika" },
  },
  buildFromTree: {
    id: "zika-tree",
    title: "Zika tutorial: a tree and its metadata",
    description: "A neighbour-joining tree of the 34 tutorial genomes with their metadata, as if made by another tool.",
    files: ["tree.nwk", "metadata.tsv"],
  },
};

export async function demoFiles(demo: Demo): Promise<File[]> {
  return Promise.all(
    demo.files.map(async (name) => {
      const res = await fetch(`${DEMO_ROOT}${demo.id}/${name}`);
      // A dev server answers a missing file with the app's own HTML page.
      if (!res.ok || res.headers.get("content-type")?.includes("text/html")) throw new Error(`This site has no demo file ${demo.id}/${name}.`);
      return new File([await res.blob()], name);
    })
  );
}
