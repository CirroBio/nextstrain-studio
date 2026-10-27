import { describe, expect, it } from "vitest";
import { ConfigSource, RepositoryType, SyncStatus, type ProcessDetail } from "@cirrobio/api-client";
import { statusOf } from "./setup";
import { PIPELINE_VERSION } from "./pipelines";

const code = (version: string) => ({ version, repositoryPath: "CirroBio/nextstrain-studio", repositoryType: RepositoryType.GithubPublic, entryPoint: "main.nf" });
const settings = (branch: string, syncStatus: SyncStatus) => ({ repository: "CirroBio/nextstrain-studio", branch, syncStatus });
const process = (over: Partial<ProcessDetail>) =>
  ({
    isArchived: false,
    isTenantWide: false,
    linkedProjectIds: ["p1"],
    configSource: ConfigSource.WithProcess,
    pipelineCode: code(PIPELINE_VERSION),
    customSettings: settings(PIPELINE_VERSION, SyncStatus.Successful),
    ...over,
  }) as ProcessDetail;

describe("statusOf", () => {
  it("needs configuring when its configuration never arrived", () => {
    expect(statusOf(process({ customSettings: settings(PIPELINE_VERSION, SyncStatus.Failed) }), "p1", false).status).toBe("unconfigured");
    // Registered with Cirro-stored configuration and never saved: the state setup left on dev.
    expect(statusOf(process({ configSource: ConfigSource.Storage, customSettings: null }), "p1", false).status).toBe("unconfigured");
    expect(statusOf(process({ configSource: ConfigSource.Storage, customSettings: null }), "p1", true).status).toBe("ready");
  });

  it("is ready when linked to the project at this build's version", () => {
    expect(statusOf(process({}), "p1", false).status).toBe("ready");
    expect(statusOf(process({ isTenantWide: true, linkedProjectIds: [] }), "p2", false).status).toBe("ready");
  });

  it("needs linking for another project", () => {
    expect(statusOf(process({}), "p2", false).status).toBe("unlinked");
  });

  it("needs updating when registered for other code", () => {
    expect(statusOf(process({ pipelineCode: code("0000000"), customSettings: settings("0000000", SyncStatus.Successful) }), "p1", false).status).toBe("outdated");
  });

  it("reports archived before anything else", () => {
    expect(statusOf(process({ isArchived: true }), "p2", false).status).toBe("archived");
  });
});
