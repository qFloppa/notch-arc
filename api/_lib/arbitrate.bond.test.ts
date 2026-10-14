/** Mock RPC and Gemini; no transactions. Run: bun api/_lib/arbitrate.bond.test.ts */
import assert from 'node:assert/strict'
import { encodeFunctionData, encodeFunctionResult, formatUnits, type Abi } from 'viem'
import artifact from '../../contracts/out/Notch.sol/Notch.json'

process.env.GEMINI_API_KEY = 'test-only'
process.env.ARBITRATOR_PRIVATE_KEY = `0x${'0'.repeat(63)}1`
process.env.NOTCH_CONTRACT_ADDRESS = '0x1111111111111111111111111111111111111111'
process.env.NOTCH_CONTRACT_ADDRESS_ARC = '0x2222222222222222222222222222222222222222'
process.env.ARC_TESTNET_RPC_URL = 'http://127.0.0.1:1'
process.env.ARC_MAINNET_RPC_URL = 'http://127.0.0.1:1'

const { ARC_TESTNET_ID, ARC_MAINNET_ID } = await import('./chains.js')
const { processDispute, processedDisputes, retryAfter } = await import('./arbitrate.js')
const abi = artifact.abi as Abi
const disputeId = `0x${'a'.repeat(64)}` as const
const itemId = `0x${'b'.repeat(64)}` as const
const statementId = `0x${'c'.repeat(64)}` as const
const tabId = `0x${'d'.repeat(64)}` as const
const wallet = '0x3333333333333333333333333333333333333333' as const
const disputeCall = encodeFunctionData({ abi, functionName: 'getDispute', args: [disputeId] })
const itemCall = encodeFunctionData({ abi, functionName: 'getItem', args: [itemId] })
let recordedBond = 3_000_000n
let prompt = ''
const originalFetch = globalThis.fetch

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input)
  const body = JSON.parse(String(init?.body))
  if (url.startsWith('http://127.0.0.1:1')) {
    assert.equal(body.method, 'eth_call', 'the test must not reach any wallet transaction RPC')
    let result: `0x${string}`
    if (body.params[0].data === disputeCall) {
      result = encodeFunctionResult({ abi, functionName: 'getDispute', result: {
        disputeId, statementId, itemId, claimant: wallet, claimKind: 'not_delivered', claim: 'Nothing delivered',
        bondAmount: recordedBond, status: 0, outcome: '', revisedItemAmount: 0n, claimantBondAward: 0n,
        rationale: '', evidenceHashMatched: false, openedAt: 1n, resolvedAt: 0n, bondCredited: false,
      } })
    } else {
      assert.equal(body.params[0].data, itemCall, 'arbitration must use the stored dispute bond, not the current global bond')
      result = encodeFunctionResult({ abi, functionName: 'getItem', result: {
        itemId, tabId, payer: wallet, payee: wallet, amount: 5_000_000n, memo: 'Service',
        evidenceUri: '', evidenceHash: itemId, cycle: 0n, createdAt: 1n,
      } })
    }
    return Response.json({ jsonrpc: '2.0', id: body.id, result })
  }
  assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'))
  prompt = body.contents[0].parts[0].text
  // Stop after inspecting the actual prompt, before any transaction can be prepared.
  return new Response('test stops before signing', { status: 401 })
}) as typeof fetch

try {
  for (const [chainId, bond] of [[ARC_MAINNET_ID, 3_000_000n], [ARC_TESTNET_ID, 125_001n]] as const) {
    recordedBond = bond
    prompt = ''
    const result = await processDispute(disputeId, chainId)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /Gemini API error 401/)
    assert.ok(prompt.includes(`Dispute bond: ${formatUnits(bond, 6)} USDC`), 'relayer must forward the recorded bond on each network')
  }
} finally {
  globalThis.fetch = originalFetch
  processedDisputes.clear()
  retryAfter.clear()
}
console.log('arbitrate stored bond: all assertions passed')
