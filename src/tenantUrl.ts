// A tenant's address is an https origin; plain http only for a tenant running on this machine.
export const TENANT_URL = /^(https:\/\/[^/]+|http:\/\/localhost(:\d+)?)\/?$/;
