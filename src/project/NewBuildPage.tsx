import { useMemo, useState } from "react";
import type { FileSystemObject } from "@cirrobio/sdk";
import type { Dataset } from "@cirrobio/api-client";
import buildForm from "../../pipelines/build/cirro/process-form.json";
import { describeError, useSignedIn } from "../cirro/cirro";
import { useAsync } from "../cirro/useAsync";
import { PIPELINES, datasetFiles, filePath, listDatasets, listProcesses, pipelineProcess } from "../cirro/projectBuilds";
import { launch, tableColumns } from "../cirro/launch";
import { portal } from "../cirro/portal";
import type { Route } from "../app/route";

// Launches one of this repo's pipelines (pipelines/, parameters in docs/pipeline-params.md).

type Kind = keyof typeof PIPELINES;
type Role = "sequences" | "metadata" | "tree" | "alignment" | "reference";

const KINDS: { kind: Kind; title: string; text: string; needs: Role[] }[] = [
  { kind: "build", title: "Phylogeny from sequences", text: "Filter, align, build a time-resolved tree and reconstruct traits with augur, from sequences and a metadata table.", needs: ["sequences", "metadata"] },
  { kind: "buildFromTree", title: "Phylogeny from an existing tree", text: "Bring a Newick tree from another tool plus a metadata table; Nextstrain adds traits, a map and the Auspice view.", needs: ["tree", "metadata"] },
  { kind: "nextclade", title: "Clades and QC with Nextclade", text: "Assign clades and check sequence quality, and see your sequences placed on Nextclade's reference tree.", needs: ["sequences"] },
  { kind: "ingest", title: "Public sequences from NCBI", text: "Download a virus's genomes and metadata from NCBI Virus, curated the way Nextstrain's pathogen workflows do, ready to build from.", needs: [] },
];

const PATTERNS: Record<Role, RegExp> = {
  sequences: /\.(fasta|fa|fna)(\.(gz|xz|zst))?$/i,
  alignment: /\.(fasta|fa|fna)(\.(gz|xz|zst))?$/i,
  metadata: /\.(tsv|csv)$/i,
  tree: /\.(nwk|newick|tree|treefile)$/i,
  reference: /\.(gb|gbk|genbank)$/i,
};

const PRESETS = buildForm.form.properties.reference_preset;
const NEXTCLADE_INDEX = "https://data.clades.nextstrain.org/v3/index.json";

// Viruses people commonly start from; any NCBI taxonomy ID or name works.
const TAXA = [
  { id: "64320", name: "Zika virus" },
  { id: "11234", name: "Measles virus" },
  { id: "10244", name: "Mpox virus" },
  { id: "12637", name: "Dengue virus" },
  { id: "11082", name: "West Nile virus" },
  { id: "37124", name: "Chikungunya virus" },
];

type NextcladeDataset = { path: string; name: string };

async function nextcladeDatasets(signal: AbortSignal): Promise<NextcladeDataset[]> {
  const res = await fetch(NEXTCLADE_INDEX, { signal });
  if (!res.ok) throw new Error(`Nextclade's dataset list answered HTTP ${res.status}.`);
  const index = (await res.json()) as { collections: { meta: { id: string }; datasets: { path: string; attributes: { name: string }; files: Record<string, string> }[] }[] };
  return index.collections.flatMap((c) => c.datasets.filter((d) => d.files.treeJson).map((d) => ({ path: d.path, name: d.attributes.name })));
}

const list = (values: string[]) => values.join(",");

export function NewBuildPage({ projectId, go }: { projectId: string; go: (r: Route) => void }) {
  const cirro = useSignedIn();
  const [kind, setKind] = useState<Kind>("build");
  const spec = KINDS.find((k) => k.kind === kind)!;
  const setup = useAsync(async () => {
    const [processes, datasets, project] = await Promise.all([listProcesses(cirro), listDatasets(cirro, projectId), cirro.data.projects.getProject({ projectId })]);
    return { processes, datasets: datasets.filter((d) => d.status === "COMPLETED"), project };
  }, [cirro, projectId]);
  const process = setup.status === "ready" ? pipelineProcess(setup.value.processes, PIPELINES[kind]) : null;
  const [inputId, setInputId] = useState("");
  const input = setup.status === "ready" ? setup.value.datasets.find((d) => d.id === inputId) ?? null : null;

  return (
    <main className="page builder">
      <h1 className="title">New build{setup.status === "ready" ? ` in ${setup.value.project.name}` : ""}</h1>
      <p className="page-lede">Runs one of Nextstrain Studio's pipelines on Cirro. The result is a new dataset in this project, and builds open here when they finish.</p>

      <section className="panel">
        <div className="panel-head"><h2>1. What to make</h2></div>
        <ul className="card-list">
          {KINDS.map((k) => (
            <li key={k.kind}>
              <button className="list-card" aria-pressed={k.kind === kind} onClick={() => { setKind(k.kind); setInputId(""); }}>
                <span className="list-card-title">{k.title}</span>
                <span className="muted">{k.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {setup.status === "loading" && <p className="muted">Loading the project…</p>}
      {setup.status === "error" && <p className="error-text">{setup.error}</p>}
      {setup.status === "ready" && !process && (
        <p className="notice">
          The "{PIPELINES[kind]}" pipeline isn't available in {cirro.tenantName} yet. A Cirro admin adds it from this app's repository (pipelines/README.md).
        </p>
      )}
      {setup.status === "ready" && process && (
        <>
          {spec.needs.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <h2>2. Input data</h2>
                <p className="muted">A dataset in this project holding the {spec.needs.join(" and ")}. Output of the NCBI ingest works as is.</p>
              </div>
              <select className="wide-select" value={inputId} onChange={(e) => setInputId(e.target.value)}>
                <option value="">Choose a dataset</option>
                {setup.value.datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </section>
          )}
          {(spec.needs.length === 0 || input) && (
            <Settings key={`${kind}:${inputId}`} kind={kind} needs={spec.needs} input={input} projectId={projectId} processId={process.id} processName={process.name} go={go} />
          )}
          <p className="muted">
            Every option is also on <a href={portal.launch(cirro.tenant.url, projectId, process.id)} target="_blank" rel="noreferrer">Cirro's own launch form</a> for this pipeline.
          </p>
        </>
      )}
    </main>
  );
}

type SettingsProps = { kind: Kind; needs: Role[]; input: Dataset | null; projectId: string; processId: string; processName: string; go: (r: Route) => void };

function Settings({ kind, needs, input, projectId, processId, processName, go }: SettingsProps) {
  const cirro = useSignedIn();
  const files = useAsync(async () => (input ? datasetFiles(cirro, projectId, input.id) : []), [cirro, projectId, input]);
  const byRole = useMemo(() => {
    const all = files.status === "ready" ? files.value : [];
    const roles = [...needs, ...(kind === "build" ? (["reference"] as Role[]) : []), ...(kind === "buildFromTree" ? (["alignment"] as Role[]) : [])];
    return Object.fromEntries(roles.map((r) => [r, all.filter((f) => PATTERNS[r].test(filePath(f)))])) as Partial<Record<Role, FileSystemObject[]>>;
  }, [files, needs, kind]);
  const [chosen, setChosen] = useState<Partial<Record<Role, string>>>({});
  const pick = (role: Role) => byRole[role]?.find((f) => f.url === chosen[role]) ?? (byRole[role]?.length === 1 ? byRole[role]![0] : undefined);
  const metadata = pick("metadata");
  const columns = useAsync(async () => (metadata ? tableColumns(cirro, metadata) : []), [cirro, metadata?.url]);
  const cols = columns.status === "ready" ? columns.value : [];
  const nextclade = useAsync((signal) => (kind === "nextclade" ? nextcladeDatasets(signal) : Promise.resolve([])), [kind]);

  const [name, setName] = useState(input ? input.name.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "build" : "ncbi");
  const [values, setValues] = useState<Record<string, unknown>>({ timetree: kind === "build" });
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const toggle = (key: string, col: string) => setSelected((s) => ({ ...s, [key]: s[key]?.includes(col) ? s[key].filter((c) => c !== col) : [...(s[key] ?? []), col] }));
  const [state, setState] = useState<{ status: "idle" | "launching" } | { status: "error"; error: string } | { status: "done"; problem: string | null }>({ status: "idle" });

  const missing = needs.filter((r) => !pick(r));
  const ambiguous = (Object.keys(byRole) as Role[]).filter((r) => (byRole[r]?.length ?? 0) > 1 && !chosen[r]);
  const geoDefaults = cols.filter((c) => ["region", "country", "division"].includes(c));

  const params = (): Record<string, unknown> => {
    // A file is named only when the pipeline couldn't find it on its own (one match in the input).
    const fileParams = Object.fromEntries((Object.keys(byRole) as Role[]).filter((r) => chosen[r]).map((r) => [r, chosen[r]]));
    const lists = Object.fromEntries(Object.entries(selected).filter(([, v]) => v.length).map(([k, v]) => [k, list(v)]));
    return { ...values, ...fileParams, ...lists, ...(kind === "ingest" ? {} : { name }) };
  };

  const run = async () => {
    setState({ status: "launching" });
    try {
      const result = await launch(cirro, {
        projectId,
        processId,
        processName,
        name: kind === "ingest" ? `NCBI ${values.taxon_id}` : name,
        description: `${processName} from Nextstrain Studio`,
        inputs: input ? [{ id: input.id, name: input.name }] : [],
        params: params(),
      });
      setState({ status: "done", problem: result.problem });
    } catch (e) {
      setState({ status: "error", error: describeError(e, "run pipelines") });
    }
  };

  if (state.status === "done") {
    return (
      <section className="panel">
        <h2>Started</h2>
        <p>The run is under way in Cirro. It shows under Runs on the project page, and its build opens there when it finishes.</p>
        {state.problem && <p className="muted">{state.problem}</p>}
        <button className="button button-primary" onClick={() => go({ page: "project", project: projectId })}>Back to the project</button>
      </section>
    );
  }

  return (
    <>
      {needs.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Files</h2></div>
          {files.status === "loading" && <p className="muted">Listing the dataset's files…</p>}
          {files.status === "error" && <p className="error-text">{files.error}</p>}
          {files.status === "ready" && (
            <div className="design-form">
              {(Object.keys(byRole) as Role[]).map((role) => {
                const options = byRole[role] ?? [];
                const required = needs.includes(role);
                if (!required && options.length === 0) return null;
                return (
                  <label key={role} className="field">
                    <span className="field-label">{role}{required ? "" : " (optional)"}</span>
                    {options.length === 0 && <span className="error-text">No {role} file ({PATTERNS[role].source}) in this dataset.</span>}
                    {options.length === 1 && <code>{filePath(options[0])}</code>}
                    {options.length > 1 && (
                      <select value={chosen[role] ?? ""} onChange={(e) => setChosen((c) => ({ ...c, [role]: e.target.value }))}>
                        <option value="">Choose one of {options.length}</option>
                        {options.map((f) => <option key={f.url} value={f.url}>{filePath(f)}</option>)}
                      </select>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Settings</h2></div>
        <div className="design-form">
          {kind === "ingest" && (
            <>
              <label className="field">
                <span className="field-label">Virus: NCBI taxonomy ID or name</span>
                <input list="taxa" value={(values.taxon_id as string) ?? ""} onChange={(e) => set("taxon_id", e.target.value)} placeholder="64320" />
                <datalist id="taxa">{TAXA.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</datalist>
              </label>
              <div className="form-row">
                <label className="field"><span className="field-label">Released since</span><input type="date" onChange={(e) => set("released_since", e.target.value)} /></label>
                <label className="field"><span className="field-label">Host</span><input onChange={(e) => set("host", e.target.value)} placeholder="Homo sapiens" /></label>
              </div>
              <label className="check"><input type="checkbox" onChange={(e) => set("complete_only", e.target.checked)} />Complete genomes only</label>
            </>
          )}

          {kind === "nextclade" && (
            <label className="field">
              <span className="field-label">Nextclade dataset</span>
              <select className="wide-select" value={(values.dataset_name as string) ?? ""} onChange={(e) => set("dataset_name", e.target.value)}>
                <option value="">{nextclade.status === "loading" ? "Loading Nextclade's datasets…" : "Choose a pathogen"}</option>
                {nextclade.status === "ready" && nextclade.value.map((d) => <option key={d.path} value={d.path}>{d.name} ({d.path})</option>)}
              </select>
              {nextclade.status === "error" && <span className="error-text">{nextclade.error}</span>}
            </label>
          )}

          {kind !== "ingest" && (
            <div className="form-row" style={{ marginTop: 0 }}>
              <label className="field"><span className="field-label">Name (the Auspice file's name)</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
              {kind !== "nextclade" && <label className="field"><span className="field-label">Title shown in Auspice</span><input onChange={(e) => set("title", e.target.value)} placeholder="Zika virus in the Americas" /></label>}
            </div>
          )}

          {kind === "build" && (
            <label className="field">
              <span className="field-label">Reference genome</span>
              <select className="wide-select" value={(values.reference_preset as string) ?? ""} onChange={(e) => set("reference_preset", e.target.value)}>
                <option value="">{byRole.reference?.length ? "The GenBank file in the input dataset" : "Choose a pathogen"}</option>
                {PRESETS.enum.map((id, i) => <option key={id} value={id}>{PRESETS.enumNames[i]}</option>)}
              </select>
            </label>
          )}

          {(kind === "build" || kind === "buildFromTree") && (
            <>
              {columns.status === "error" && <p className="error-text">{columns.error}</p>}
              {cols.length > 0 && (
                <>
                  <label className="field">
                    <span className="field-label">Strain name column</span>
                    <select value={(values.metadata_id_columns as string) ?? (cols.includes("strain") ? "strain" : "")} onChange={(e) => set("metadata_id_columns", e.target.value)}>
                      {!cols.includes("strain") && <option value="">Choose the column of sequence names</option>}
                      {cols.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <ColumnPicker label="Show on the map" hint="Location columns, broadest first" cols={cols} picked={selected.geo_resolutions ?? []} onToggle={(c) => toggle("geo_resolutions", c)} suggested={geoDefaults} />
                  <ColumnPicker label="Infer ancestral states for" hint="Discrete traits such as country or host, reconstructed on the tree" cols={cols} picked={selected.traits ?? []} onToggle={(c) => toggle("traits", c)} />
                  <ColumnPicker label="Color by" hint="Extra metadata columns offered as colorings" cols={cols} picked={selected.color_by ?? []} onToggle={(c) => toggle("color_by", c)} />
                </>
              )}
            </>
          )}

          {kind === "build" && (
            <details>
              <summary>Filtering and subsampling</summary>
              <div className="form-row">
                <label className="field"><span className="field-label">At most this many sequences</span><input type="number" min={1} onChange={(e) => set("subsample_max_sequences", e.target.value ? Number(e.target.value) : undefined)} /></label>
                <label className="field"><span className="field-label">Earliest date</span><input type="date" onChange={(e) => set("min_date", e.target.value)} /></label>
                <label className="field"><span className="field-label">Latest date</span><input type="date" onChange={(e) => set("max_date", e.target.value)} /></label>
                <label className="field"><span className="field-label">Minimum length (nt)</span><input type="number" min={1} onChange={(e) => set("min_length", e.target.value ? Number(e.target.value) : undefined)} /></label>
              </div>
              {cols.length > 0 && <ColumnPicker label="Subsample evenly across" hint="year and month come from the date column" cols={[...cols, "year", "month"]} picked={selected.group_by ?? []} onToggle={(c) => toggle("group_by", c)} />}
            </details>
          )}

          {(kind === "build" || kind === "buildFromTree") && (
            <label className="check">
              <input type="checkbox" checked={!!values.timetree} onChange={(e) => set("timetree", e.target.checked)} disabled={kind === "buildFromTree" && !pick("alignment")} />
              Time-resolved tree (needs a date column{kind === "buildFromTree" ? " and an alignment" : ""})
            </label>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Run</h2>
          <p className="muted">Runs on Cirro's compute, billed to this project.</p>
        </div>
        {missing.length > 0 && <p className="error-text">This dataset has no {missing.join(" or ")} file.</p>}
        {ambiguous.length > 0 && <p className="muted">Choose which {ambiguous.join(" and ")} file to use above.</p>}
        <button
          className="button button-primary"
          disabled={state.status === "launching" || missing.length > 0 || ambiguous.length > 0 || (kind === "ingest" && !values.taxon_id) || (kind === "nextclade" && !values.dataset_name) || (kind === "build" && !values.reference_preset && !pick("reference"))}
          onClick={run}
        >
          {state.status === "launching" ? "Starting…" : `Run ${processName}`}
        </button>
        {state.status === "error" && <p className="error-text" role="alert">{state.error}</p>}
      </section>
    </>
  );
}

function ColumnPicker({ label, hint, cols, picked, onToggle, suggested = [] }: { label: string; hint: string; cols: string[]; picked: string[]; onToggle: (c: string) => void; suggested?: string[] }) {
  return (
    <fieldset className="design-section">
      <legend>{label}</legend>
      <p className="hint muted">{hint}{suggested.length > 0 ? `; suggested: ${suggested.join(", ")}` : ""}</p>
      <div className="checklist" style={{ marginTop: 0 }}>
        {cols.map((c) => (
          <label key={c} className="check"><input type="checkbox" checked={picked.includes(c)} onChange={() => onToggle(c)} />{c}</label>
        ))}
      </div>
    </fieldset>
  );
}
