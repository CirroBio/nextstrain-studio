import { describe, expect, it } from "vitest";
import { groupAuspiceFiles, parseAuspiceName, viewerFileName } from "./auspiceFiles";

describe("parseAuspiceName", () => {
  it("separates sidecars from main datasets", () => {
    expect(parseAuspiceName("data/auspice/zika.json")).toEqual({ path: "data/auspice/zika", sidecar: undefined });
    expect(parseAuspiceName("auspice/ncov_global_tip-frequencies.json")).toEqual({ path: "auspice/ncov_global", sidecar: "tip-frequencies" });
    expect(parseAuspiceName("x_root-sequence.json.gz")).toEqual({ path: "x", sidecar: "root-sequence" });
  });

  it("ignores files that are not JSON", () => {
    expect(parseAuspiceName("results/tree.nwk")).toBeNull();
    expect(parseAuspiceName("metadata.tsv")).toBeNull();
    expect(parseAuspiceName(".json")).toBeNull();
  });
});

describe("groupAuspiceFiles", () => {
  it("attaches sidecars in the same folder only", () => {
    const groups = groupAuspiceFiles(
      ["a/zika.json", "a/zika_tip-frequencies.json", "b/zika_root-sequence.json", "a/mpox.json", "notes.txt"],
      (f) => f
    );
    expect(groups).toEqual([
      { path: "a/mpox", main: "a/mpox.json", sidecars: {} },
      { path: "a/zika", main: "a/zika.json", sidecars: { "tip-frequencies": "a/zika_tip-frequencies.json" } },
    ]);
  });
});

describe("viewerFileName", () => {
  it("gives every file of a dataset one stem", () => {
    expect(viewerFileName("flu/seasonal h3n2")).toBe("flu_seasonal_h3n2.json");
    expect(viewerFileName("flu/seasonal h3n2", "tip-frequencies")).toBe("flu_seasonal_h3n2_tip-frequencies.json");
    expect(viewerFileName("zika", undefined, true)).toBe("zika.json.gz");
  });
});
