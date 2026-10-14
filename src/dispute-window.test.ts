/** Run: bun src/dispute-window.test.ts */
import assert from 'node:assert/strict'
import { createPublicClient, custom, encodeFunctionResult, parseAbi, toHex } from 'viem'
import { arc } from 'viem/chains'
import { getDisputeWindow, readDisputeWindow } from './dispute-window'

const address = '0x1111111111111111111111111111111111111111' as const
const abi = parseAbi(['function disputeWindowSeconds() view returns (uint256)'])

assert.equal(getDisputeWindow(1000n, undefined, 5000n), undefined, 'unknown configuration cannot enable filing')
assert.equal(getDisputeWindow(1000n, 3600n, undefined), undefined, 'unknown chain time cannot enable filing')
assert.equal(getDisputeWindow(0n, 3600n, 1000n), undefined, 'an absent statement cannot enable filing')
assert.deepEqual(getDisputeWindow(1000n, 3600n, 4599n), { deadline: 4600n, remaining: 1n, expired: false })
assert.deepEqual(getDisputeWindow(1000n, 3600n, 4600n), { deadline: 4600n, remaining: 0n, expired: false }, 'Solidity allows the exact deadline')
assert.deepEqual(getDisputeWindow(1000n, 3600n, 4601n), { deadline: 4600n, remaining: 0n, expired: true })
assert.equal(getDisputeWindow(1000n, 7200n, 4601n)?.expired, false, 'owner extension reopens an existing statement window')
assert.equal(getDisputeWindow(1000n, 60n, 1100n)?.expired, true, 'owner reduction affects existing statements')

let timestamp = 4601n
let windowSeconds = 3600n
let failRead = false
const calls: { method: string; params?: unknown }[] = []
const client = createPublicClient({ chain: arc, transport: custom({
  request({ method, params }) {
    calls.push({ method: String(method), params: params as unknown })
    if (failRead) return Promise.reject(new Error('RPC unavailable'))
    if (method === 'eth_getBlockByNumber') return Promise.resolve({ number: '0x2a', timestamp: toHex(timestamp) })
    if (method === 'eth_call') return Promise.resolve(encodeFunctionResult({ abi, functionName: 'disputeWindowSeconds', result: windowSeconds }))
    return Promise.reject(new Error(`Unexpected RPC: ${method}`))
  },
}, { retryCount: 0 }) })

assert.equal((await readDisputeWindow(client, address, 1000n)).expired, true, 'fresh preflight catches expiry after the form was opened')
assert.deepEqual((calls.find(call => call.method === 'eth_call')?.params as unknown[])[1], '0x2a', 'window read uses the same block as chain time')
windowSeconds = 7200n
assert.equal((await readDisputeWindow(client, address, 1000n)).expired, false, 'preflight reads a changed owner setting')
timestamp = 8201n
assert.equal((await readDisputeWindow(client, address, 1000n)).expired, true)
failRead = true
await assert.rejects(readDisputeWindow(client, address, 1000n), /RPC unavailable/, 'RPC failure cannot authorize a wallet action')
assert.ok(calls.every(call => call.method === 'eth_getBlockByNumber' || call.method === 'eth_call'), 'preflight is read-only')
console.log('dispute deadline: all assertions passed')

