import assert from "node:assert/strict";
import test from "node:test";
import { succeeded, decided } from "../lib/chain.ts";

test("Studio Next success requires a successful execution and accepted status", () => {
  assert.equal(succeeded({ status_name: "ACCEPTED", tx_execution_result_name: "FINISHED_WITH_RETURN" }), true);
  assert.equal(succeeded({ status_name: "PENDING", tx_execution_result_name: "FINISHED_WITH_RETURN" }), false);
  assert.equal(succeeded({ status_name: "FINALIZED", consensus_data: { leader_receipt: [{ execution_result: "ERROR" }] } }), false);
  assert.equal(succeeded({ status_name: "ACCEPTED", consensus_data: { leader_receipt: [{ execution_result: "SUCCESS" }] } }), true);
  assert.equal(decided({ status_name: "VALIDATORS_TIMEOUT" }), true);
});
