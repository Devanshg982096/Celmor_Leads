import "server-only";

export type ApifyRunStatus =
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "ABORTING"
  | "ABORTED"
  | "TIMING-OUT"
  | "TIMED-OUT";

export interface ApifyRunMeta {
  id: string;
  status: ApifyRunStatus;
  defaultDatasetId: string;
}

const BASE = "https://api.apify.com/v2";

/**
 * Start an Apify Actor run without blocking. Returns the run metadata so we
 * can poll later. The actor input is sent as the POST body (Content-Type JSON).
 */
export async function startRun(
  actorId: string,
  input: unknown,
  token: string,
): Promise<ApifyRunMeta> {
  const url = `${BASE}/acts/${actorId}/runs?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Apify start ${actorId} ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  const body = (await res.json()) as {
    data?: { id: string; status: ApifyRunStatus; defaultDatasetId: string };
  };
  if (!body.data?.id) throw new Error("Apify start returned no run id");
  return {
    id: body.data.id,
    status: body.data.status,
    defaultDatasetId: body.data.defaultDatasetId,
  };
}

/** Poll a run for its current status. */
export async function getRun(runId: string, token: string): Promise<ApifyRunMeta> {
  const url = `${BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`Apify getRun ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  const body = (await res.json()) as {
    data?: { id: string; status: ApifyRunStatus; defaultDatasetId: string };
  };
  if (!body.data) throw new Error("Apify getRun returned no data");
  return {
    id: body.data.id,
    status: body.data.status,
    defaultDatasetId: body.data.defaultDatasetId,
  };
}

/** Fetch the dataset items produced by a SUCCEEDED run. */
export async function getDatasetItems<T>(
  datasetId: string,
  token: string,
): Promise<T[]> {
  const url = `${BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    throw new Error(`Apify dataset ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  return (await res.json()) as T[];
}

export function isTerminal(status: ApifyRunStatus): boolean {
  return (
    status === "SUCCEEDED" ||
    status === "FAILED" ||
    status === "ABORTED" ||
    status === "TIMED-OUT"
  );
}
