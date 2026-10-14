/** No live keys or RPC calls. Run: bun api/_lib/arbitrate.chains.test.ts */
import assert from 'node:assert'

// Override any local .env before loading the relayer. This key is a public test fixture.
process.env.GEMINI_API_KEY = 'test-only'
process.env.ARBITRATOR_PRIVATE_KEY = `0x${'0'.repeat(63)}1`
process.env.ARBITRATOR_PRIVATE_KEY_ARC = `0x${'0'.repeat(63)}2`
process.env.NOTCH_CONTRACT_ADDRESS = '0x1111111111111111111111111111111111111111'
process.env.ARC_TESTNET_RPC_URL = 'http://127.0.0.1:1'
process.env.ARC_MAINNET_RPC_URL = 'http://127.0.0.1:1'
process.env.NOTCH_CONTRACT_ADDRESS_ARC = ''
delete process.env.VITE_NOTCH_CONTRACT_ADDRESS

const { RELAYER_CHAINS, ARC_TESTNET_ID, ARC_MAINNET_ID } = await import('./chains.js')
const { processDispute, health, processedDisputes, retryAfter } = await import('./arbitrate.js')
const originalFetch = globalThis.fetch
globalThis.fetch = (async () => { throw new Error('test must not make network requests') }) as typeof fetch

try {
  const disputeId = `0x${'1'.repeat(64)}` as const
  const missing = await processDispute(disputeId, ARC_MAINNET_ID)
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.match(missing.error, /not configured for Arc .*NOTCH_CONTRACT_ADDRESS_ARC/)

  const status = health()
  assert.equal(status.status, 'ok', 'configured testnet keeps the relayer healthy')
  assert.equal(status.chains.find(c => c.chainId === ARC_MAINNET_ID)?.contract, null)
  assert.deepEqual(status.chains.find(c => c.chainId === ARC_MAINNET_ID)?.missingEnv, ['NOTCH_CONTRACT_ADDRESS_ARC'])

  RELAYER_CHAINS[ARC_MAINNET_ID].contract = '0x2222222222222222222222222222222222222222'
  processedDisputes.add(`${ARC_TESTNET_ID}:${disputeId}`)
  retryAfter.set(`${ARC_MAINNET_ID}:${disputeId}`, Date.now() + 60_000)
  assert.deepEqual(await processDispute(disputeId, ARC_TESTNET_ID), { ok: true, skipped: 'already processed' })
  const mainnet = await processDispute(disputeId, ARC_MAINNET_ID)
  assert.equal(mainnet.ok, false, 'testnet dedupe must not skip the mainnet dispute')
  if (!mainnet.ok) assert.equal(mainnet.error, 'backing off')

  processedDisputes.clear()
  retryAfter.clear()
} finally {
  globalThis.fetch = originalFetch
}
console.log('arbitrate chains: all assertions passed')
