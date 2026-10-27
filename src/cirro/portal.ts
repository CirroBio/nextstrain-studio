// Pages in the Cirro web app, for what Cirro itself does better than this app: sharing a project's
// data with other projects, and the full pipeline launch form.
export const portal = {
  dataset: (tenantUrl: string, projectId: string, datasetId: string) => `${tenantUrl}/project/${projectId}/dataset/${datasetId}`,
  shares: (tenantUrl: string, projectId: string) => `${tenantUrl}/project/${projectId}/shares`,
  launch: (tenantUrl: string, projectId: string, processId: string) => `${tenantUrl}/project/${projectId}/pipeline/${processId}`,
};
