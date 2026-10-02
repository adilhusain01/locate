// Small JSON state file per job (last scanned block, known accounts). Lives next to the run records.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.RUNLOG_DIR ?? "runs";
mkdirSync(dir, { recursive: true });

export function loadState<T>(job: string, fallback: T): T {
  const p = join(dir, `state-${job}.json`);
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

export function saveState<T>(job: string, state: T) {
  writeFileSync(join(dir, `state-${job}.json`), JSON.stringify(state, null, 2));
}
