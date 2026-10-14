/**
 * Self-check for active-network resolution. No framework — run it with:
 *   bun src/networks.test.ts
 * resolveNetwork is pure and takes the address map, so this needs no DOM, no
 * wallet, and no Vite env.
 */

import assert from 'node:assert'
import { resolveNetwork, ARC_TESTNET_ID, ARC_MAINNET_ID } from './networks'
import { getStoredTabIds, addStoredTabId } from './tab-store'

const BOTH = {
  [ARC_TESTNET_ID]: '0x53F07375799558592Ea90344d14495D007C30f97',
  [ARC_MAINNET_ID]: '0x1111111111111111111111111111111111111111',
} as const
const TESTNET_ONLY = { [ARC_TESTNET_ID]: '0x53F07375799558592Ea90344d14495D007C30f97' } as const

// A wallet on a configured chain selects that chain.
assert.equal(resolveNetwork(ARC_TESTNET_ID, 'arc.notch.bond', BOTH), ARC_TESTNET_ID)
assert.equal(resolveNetwork(ARC_MAINNET_ID, 'arc.notch.bond', BOTH), ARC_MAINNET_ID)

// Disconnected, or on an unrelated chain (Ethereum, kept in config for ENS): testnet.
assert.equal(resolveNetwork(undefined, 'arc.notch.bond', BOTH), ARC_TESTNET_ID)
assert.equal(resolveNetwork(1, 'arc.notch.bond', BOTH), ARC_TESTNET_ID)

// REVIEW FOCUS 1: wallet on Arc mainnet while mainnet has no deployment.
// Must fall back to testnet rather than resolve to an address-less chain.
assert.equal(resolveNetwork(ARC_MAINNET_ID, 'arc.notch.bond', TESTNET_ONLY), ARC_TESTNET_ID)

// The mainnet. hostname preselects mainnet only when it is actually deployed.
assert.equal(resolveNetwork(undefined, 'mainnet.notch.bond', BOTH), ARC_MAINNET_ID)
assert.equal(resolveNetwork(undefined, 'mainnet.notch.bond', TESTNET_ONLY), ARC_TESTNET_ID)

// A connected wallet outranks the hostname — the wallet is what signs.
assert.equal(resolveNetwork(ARC_TESTNET_ID, 'mainnet.notch.bond', BOTH), ARC_TESTNET_ID)

// Resolution never returns a chain without an address.
for (const wallet of [undefined, 1, 999, ARC_TESTNET_ID, ARC_MAINNET_ID]) {
  for (const host of ['arc.notch.bond', 'mainnet.notch.bond', 'localhost']) {
    for (const map of [BOTH, TESTNET_ONLY]) {
      const resolved = resolveNetwork(wallet, host, map)
      assert.ok((map as Record<number, string>)[resolved], `unconfigured chain ${resolved}`)
    }
  }
}

// ---- tab-store chain namespacing -------------------------------------------

// Minimal localStorage stand-in — bun has no DOM. Safe to install here rather
// than before the import: tab-store reads localStorage per call, not at load.
const store = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
}

const WALLET = '0xAbCdEf0000000000000000000000000000000001'
const TAB_A = '0xaa'.padEnd(66, 'a') as `0x${string}`
const TAB_B = '0xbb'.padEnd(66, 'b') as `0x${string}`

addStoredTabId(ARC_TESTNET_ID, WALLET, TAB_A)
addStoredTabId(ARC_MAINNET_ID, WALLET, TAB_B)

// One wallet, two chains, disjoint registries.
assert.deepEqual(getStoredTabIds(ARC_TESTNET_ID, WALLET), [TAB_A])
assert.deepEqual(getStoredTabIds(ARC_MAINNET_ID, WALLET), [TAB_B])

// Case-insensitive on the address, as before.
assert.deepEqual(getStoredTabIds(ARC_TESTNET_ID, WALLET.toLowerCase()), [TAB_A])

// REVIEW FOCUS 5: a pre-existing un-namespaced key is not adopted by either chain.
store.set(`notch:tabs:${WALLET.toLowerCase()}`, JSON.stringify(['0xdeadbeef']))
assert.deepEqual(getStoredTabIds(ARC_TESTNET_ID, WALLET), [TAB_A])
assert.deepEqual(getStoredTabIds(ARC_MAINNET_ID, WALLET), [TAB_B])

// Corrupt JSON still degrades to empty rather than throwing.
store.set(`notch:tabs:${ARC_TESTNET_ID}:${WALLET.toLowerCase()}`, '{not json')
assert.deepEqual(getStoredTabIds(ARC_TESTNET_ID, WALLET), [])

console.log('networks: all assertions passed')
