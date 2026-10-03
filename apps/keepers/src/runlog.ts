// Every keeper job writes a run record and keeps its failures with their input, so breakage that raised no
// alert can still be reviewed. Append-only JSON lines under RUNLOG_DIR (default ./runs).
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.RUNLOG_DIR ?? "runs";
mkdirSync(dir, { recursive: true });

export type RunRecord = {
  job: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  summary: Record<string, unknown>;
  failures: { input: unknown; error: string }[];
};

// viem hands back bigint answers, block numbers and nonces; JSON.stringify refuses them, so they go out as strings.
export function jsonSafe(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

export function writeRun(record: RunRecord) {
  appendFileSync(join(dir, `${record.job}.jsonl`), JSON.stringify(record, jsonSafe) + "\n");
}

export async function run<T>(job: string, body: (fail: (input: unknown, error: unknown) => void) => Promise<T>) {
  const startedAt = new Date().toISOString();
  const failures: RunRecord["failures"] = [];
  const fail = (input: unknown, error: unknown) =>
    failures.push({ input, error: error instanceof Error ? error.message : String(error) });
  let summary: Record<string, unknown> = {};
  let ok = true;
  try {
    const out = await body(fail);
    summary = (out as Record<string, unknown>) ?? {};
  } catch (error) {
    ok = false;
    fail("job", error);
  }
  writeRun({ job, startedAt, finishedAt: new Date().toISOString(), ok: ok && failures.length === 0, summary, failures });
  const status = ok && failures.length === 0 ? "ok" : "FAILED";
  console.log(`[${job}] ${status} ${JSON.stringify(summary, jsonSafe)}${failures.length ? ` failures=${failures.length}` : ""}`);
}
