/** Self-check for relayer routing. Run with: bun api/_lib/chains.test.ts */
import assert from 'node:assert'
import { resolveRelayerChain, DEFAULT_RELAYER_CHAIN_ID, ARC_TESTNET_ID, ARC_MAINNET_ID } from './chains.js'

// A cached browser bundle without a chainId must always target testnet.
assert.equal(DEFAULT_RELAYER_CHAIN_ID, ARC_TESTNET_ID)
assert.deepEqual(resolveRelayerChain(undefined), { ok: true, chainId: ARC_TESTNET_ID })
assert.deepEqual(resolveRelayerChain(null), { ok: true, chainId: ARC_TESTNET_ID })

assert.deepEqual(resolveRelayerChain(ARC_TESTNET_ID), { ok: true, chainId: ARC_TESTNET_ID })
assert.deepEqual(resolveRelayerChain(ARC_MAINNET_ID), { ok: true, chainId: ARC_MAINNET_ID })
assert.deepEqual(resolveRelayerChain(String(ARC_MAINNET_ID)), { ok: true, chainId: ARC_MAINNET_ID })
assert.deepEqual(resolveRelayerChain(String(ARC_TESTNET_ID)), { ok: true, chainId: ARC_TESTNET_ID })

for (const bad of [1, 999, 'abc', '', '5042.0', ' 5042', '5.042e3', {}, [], true, Number.NaN, Infinity, 5042.5]) {
  assert.equal(resolveRelayerChain(bad).ok, false, `expected rejection for ${String(bad)}`)
}

console.log('chains: all assertions passed')
