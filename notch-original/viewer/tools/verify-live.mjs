import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { recompute } from "../lib/preimage.ts";

const base = new URL(process.argv[2] || "https://www.notch.bond");
const explorer = "https://explorer-studio-dev.genlayer.com";
const transactions = [];

async function request(path, body) {
  const response = await fetch(new URL(path, base), {
    ...(body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`${path}: ${data.error || response.status}`);
  return data;
}

async function act(body) {
  const submitted = await request("/api/act", body);
  assert.match(submitted.hash, /^0x[0-9a-fA-F]{64}$/);
  transactions.push({ op: body.op, hash: submitted.hash, url: `${explorer}/tx/${submitted.hash}` });
  console.log(JSON.stringify({ ...transactions.at(-1), expect: submitted.expect }));
  for (let i = 0; i < 120; i++) {
    await delay(5_000);
    const response = await fetch(new URL(`/api/tx?hash=${submitted.hash}`, base), { signal: AbortSignal.timeout(90_000) });
    const receipt = await response.json();
    if (!response.ok) throw new Error(`Receipt HTTP ${response.status}; resume using the printed hash`);
    if (receipt.state === "pending") continue;
    assert.equal(receipt.state, "ok", JSON.stringify(receipt));
    console.log(`${body.op}: ${receipt.status}, execution succeeded`);
    return submitted.expect;
  }
  throw new Error(`Consensus timed out: ${submitted.hash}; inspect before retrying`);
}

const initial = await request("/api/state");
assert.equal(initial.network.chainId, 61997);
assert.equal(initial.network.explorer, explorer);
console.log(JSON.stringify({ network: initial.network }));
const { tab } = await act({ op: "open_tab" });
console.log(`Demo: ${new URL(`/?tab=${tab}`, base)}`);
await act({ op: "bill", tab, flavour: "good" });
const { notch_id } = await act({ op: "bill", tab, flavour: "off_spec" });
const { statement_id } = await act({ op: "close", tab });
const closed = await request(`/api/state?tab=${tab}`);
const statement = closed.statements.find((s) => s.id === statement_id);
assert.equal((await recompute(statement)).hash, statement.statement_hash);
console.log(`Statement hash verified: ${statement.statement_hash}`);
const { dispute_id } = await act({
  op: "dispute", statement_id, notch_id, kind: "off_spec",
  claim: "The receipt shows qty 0 and TOTAL 0.00 with an upstream timeout, so the agreed delivery terms were not met.",
});
await act({ op: "resolve", dispute_id });
const final = await request(`/api/state?tab=${tab}`);
const dispute = final.statements.find((s) => s.id === statement_id).dispute;
console.log(JSON.stringify({ tab, statement_id, dispute, transactions }, null, 2));
assert.equal(dispute.status, "resolved");
assert.equal(dispute.evidence_hash_matched, true, "Evidence mismatch bypasses model judgment");
assert.ok(["upheld", "adjusted", "rejected"].includes(dispute.outcome));
assert.ok(dispute.rationale.length > 0);
assert.ok(final.precedents.off_spec.some((c) => c.case_id === dispute_id));
console.log("PASS: public app, chain 61997, verified statement, model judgment, persisted case history");
