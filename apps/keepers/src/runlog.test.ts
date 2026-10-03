// Requirement: a run record must always reach the log, even when a failure's input or the summary holds
// bigint values (viem returns feed answers as bigint). Before the fix, JSON.stringify threw and the keeper died.
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "locate-runlog-"));
process.env.RUNLOG_DIR = dir;
const { run } = await import("./runlog.ts");
const { loadState, saveState } = await import("./state.ts");

test("run records with bigint inputs and summaries are written as strings", async () => {
  await run("unit-job", async (fail) => {
    fail({ ticker: "NVDA", answer: 18_765_000_000n, updatedAt: 1_790_000_000n }, new Error("nonce too low"));
    return { written: 0n, markets: 15 };
  });
  const lines = readFileSync(join(dir, "unit-job.jsonl"), "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.ok, false);
  assert.equal(record.failures[0].input.answer, "18765000000");
  assert.equal(record.failures[0].error, "nonce too low");
  assert.equal(record.summary.written, "0");
  assert.equal(record.summary.markets, 15);
});

test("state files survive bigint fields", () => {
  saveState("unit-state", { lastBlock: 127_000_000n, accounts: ["0xabc"] });
  const back = loadState<{ lastBlock: string; accounts: string[] }>("unit-state", { lastBlock: "0", accounts: [] });
  assert.equal(back.lastBlock, "127000000");
  assert.deepEqual(back.accounts, ["0xabc"]);
});
