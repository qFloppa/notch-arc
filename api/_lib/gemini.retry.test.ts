/**
 * Self-check for the transient-error retry in judgeDispute. No framework — run it with:
 *   bun api/_lib/gemini.retry.test.ts
 * Stubs global fetch to fail with 503 twice, then succeed, and asserts judgeDispute
 * retried rather than throwing, and that a non-retryable 401 throws immediately.
 */

import assert from 'node:assert'
import { judgeDispute } from './gemini.js'

type FetchResult = { status: number; bodyText: string }
function stubFetch(sequence: FetchResult[]) {
  let i = 0
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    const r = sequence[Math.min(i++, sequence.length - 1)]
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => r.bodyText,
      json: async () => JSON.parse(r.bodyText),
    } as Response
  }) as typeof fetch
  return () => calls
}

const ctx = {
  claimKind: 'overcharged', claim: 'x', memo: 'y',
  evidenceUri: '', evidenceContent: null, chargeAmount: 1_000_000n,
}
const okBody = JSON.stringify({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
    outcome: 'rejected', revisedItemAmountUsdc: 1, claimantBondAwardUsdc: 0,
    evidenceHashMatched: false, rationale: 'ok',
  }) }] } }],
})

const err503 = JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'overloaded' } })
const err401 = JSON.stringify({ error: { code: 401, status: 'UNAUTHENTICATED', message: 'bad key' } })

async function main() {
  // 503, 503, then 200 → should retry and resolve
  let calls = stubFetch([
    { status: 503, bodyText: err503 },
    { status: 503, bodyText: err503 },
    { status: 200, bodyText: okBody },
  ])
  const ruling = await judgeDispute(ctx, 'fake-key')
  assert.strictEqual(ruling.outcome, 'rejected')
  assert.strictEqual(calls(), 3, 'should have retried twice then succeeded')

  // 401 → non-retryable, throws on the first attempt
  calls = stubFetch([{ status: 401, bodyText: err401 }])
  await assert.rejects(() => judgeDispute(ctx, 'fake-key'), /401/)
  assert.strictEqual(calls(), 1, '401 must not be retried')

  console.log('gemini retry self-check: OK')
}

void main()
