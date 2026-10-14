/** Relayer push payload and per-network dedupe. Run: bun src/notch-contract.test.ts */
import assert from 'node:assert'
import { arc, arcTestnet } from 'viem/chains'
import { pushDispute } from './notch-contract'

const requests: Array<{ disputeId: string; chainId: number }> = []
const originalFetch = globalThis.fetch
let fail = false
globalThis.fetch = (_input, init) => {
  if (typeof init?.body !== 'string') throw new Error('expected a JSON string')
  requests.push(JSON.parse(init.body) as { disputeId: string; chainId: number })
  return Promise.resolve(Response.json(fail ? { ok: false, error: 'backing off' } : { ok: true, skipped: 'already resolved on-chain' }))
}

try {
  const disputeId = `0x${'1'.repeat(64)}` as const
  await pushDispute(disputeId, arcTestnet.id)
  await pushDispute(disputeId, arc.id)
  assert.deepEqual(requests, [
    { disputeId, chainId: arcTestnet.id },
    { disputeId, chainId: arc.id },
  ], 'the same dispute ID on both networks must reach each relayer chain')
  assert.equal(await pushDispute(disputeId, arcTestnet.id), null)
  assert.equal(requests.length, 2, 'a successful push is deduped on its own chain')

  const retryId = `0x${'2'.repeat(64)}` as const
  fail = true
  await pushDispute(retryId, arc.id)
  fail = false
  assert.equal((await pushDispute(retryId, arc.id))?.ok, true, 'a failed push can be retried')
  assert.equal(requests.length, 4)
} finally {
  globalThis.fetch = originalFetch
}
console.log('relayer push: all assertions passed')
