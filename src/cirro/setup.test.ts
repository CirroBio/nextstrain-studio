import { describe, expect, it } from "vitest";
import { RepositoryType, type ProcessDetail } from "@cirrobio/api-client";
import { statusOf } from "./setup";
import { PIPELINE_VERSION } from "./pipelines";

const process = (over: Partial<ProcessDetail>) =>
  ({ isArchived: false, isTenantWide: false, linkedProjectIds: ["p1"], pipelineCode: { version: PIPELINE_VERSION }, ...over }) as ProcessDetail;

describe("statusOf", () => {
  it("is ready when linked to the project at this build's version", () => {
    expect(statusOf(process({}), "p1").status).toBe("ready");
    expect(statusOf(process({ isTenantWide: true, linkedProjectIds: [] }), "p2").status).toBe("ready");
  });

  it("needs linking for another project", () => {
    expect(statusOf(process({}), "p2").status).toBe("unlinked");
  });

  it("needs updating when registered for other code", () => {
    expect(statusOf(process({ pipelineCode: { version: "0000000", repositoryPath: "", repositoryType: RepositoryType.GithubPublic, entryPoint: "" } }), "p1").status).toBe("outdated");
  });

  it("reports archived before anything else", () => {
    expect(statusOf(process({ isArchived: true }), "p2").status).toBe("archived");
  });
});
