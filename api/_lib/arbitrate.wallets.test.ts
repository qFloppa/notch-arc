/** Separate per-chain signer/config regression. No live keys or transactions.
 * Run: bun api/_lib/arbitrate.wallets.test.ts
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { encodeFunctionData, encodeFunctionResult, type Abi } from 'viem'
import artifact from '../../contracts/out/Notch.sol/Notch.json'

const scenario = process.argv[2]
// Public test fixtures: private keys 1 and 2, never production secrets.
const TESTNET_KEY = `0x${'0'.repeat(63)}1`
const MAINNET_KEY = `0x${'0'.repeat(63)}2`
const TESTNET_WALLET = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf'
const MAINNET_WALLET = '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF'

if (!scenario) {
  for (const name of ['both', 'no-mainnet', 'no-testnet', 'invalid-mainnet']) {
    const child = spawnSync(process.execPath, [import.meta.filename, name], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GEMINI_API_KEY: 'test-only',
        ARBITRATOR_PRIVATE_KEY: name === 'no-testnet' ? '' : TESTNET_KEY,
        ARBITRATOR_PRIVATE_KEY_ARC: name === 'no-mainnet' ? '' : name === 'invalid-mainnet' ? 'invalid-secret-fixture' : MAINNET_KEY,
        NOTCH_CONTRACT_ADDRESS: '0x1111111111111111111111111111111111111111',
        NOTCH_CONTRACT_ADDRESS_ARC: '0x2222222222222222222222222222222222222222',
        ARC_TESTNET_RPC_URL: 'http://127.0.0.1:1/testnet',
        ARC_MAINNET_RPC_URL: 'http://127.0.0.1:1/mainnet',
      },
    })
    assert.equal(child.status, 0, `${name}: ${child.stdout}\n${child.stderr}`)
  }
  console.log('arbitrator wallets: all assertions passed')
} else {
  const { ARC_TESTNET_ID, ARC_MAINNET_ID } = await import('./chains.js')
  const { processDispute, health, arbitratorAddress } = await import('./arbitrate.js')
  const status = health()
  assert.equal(status.status, 'ok', 'one configured network keeps the relayer healthy')
  const testnet = status.chains.find(c => c.chainId === ARC_TESTNET_ID)!
  const mainnet = status.chains.find(c => c.chainId === ARC_MAINNET_ID)!
  const addresses = status.chains as Array<{ chainId: number; arbitrator?: string | null; invalidEnv?: string[] }>
  assert.equal(status.arbitrator, scenario === 'no-testnet' ? null : TESTNET_WALLET, 'legacy health field remains the testnet address')
  assert.equal(arbitratorAddress(), scenario === 'no-testnet' ? null : TESTNET_WALLET)
  assert.equal(addresses.find(c => c.chainId === ARC_TESTNET_ID)?.arbitrator, scenario === 'no-testnet' ? null : TESTNET_WALLET)
  assert.equal(addresses.find(c => c.chainId === ARC_MAINNET_ID)?.arbitrator, ['no-mainnet', 'invalid-mainnet'].includes(scenario) ? null : MAINNET_WALLET)
  assert.equal(arbitratorAddress(1), null, 'unsupported chains must not use a default wallet')
  assert.ok(!JSON.stringify(status).includes(TESTNET_KEY), 'health must not expose testnet secrets')
  assert.ok(!JSON.stringify(status).includes(MAINNET_KEY), 'health must not expose mainnet secrets')

  const disputeId = `0x${'a'.repeat(64)}` as const
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => { calls++; throw new Error('unexpected network request') }) as typeof fetch
  try {
    if (scenario === 'no-mainnet') {
      assert.deepEqual(mainnet.missingEnv, ['ARBITRATOR_PRIVATE_KEY_ARC'])
      const result = await processDispute(disputeId, ARC_MAINNET_ID)
      assert.equal(result.ok, false)
      if (!result.ok) assert.match(result.error, /missing env: ARBITRATOR_PRIVATE_KEY_ARC/)
      assert.equal(calls, 0, 'a missing mainnet key must never fall back to testnet')
    } else if (scenario === 'invalid-mainnet') {
      assert.deepEqual(mainnet.missingEnv, [])
      assert.deepEqual(addresses.find(c => c.chainId === ARC_MAINNET_ID)?.invalidEnv, ['ARBITRATOR_PRIVATE_KEY_ARC'])
      const result = await processDispute(disputeId, ARC_MAINNET_ID)
      assert.equal(result.ok, false)
      if (!result.ok) {
        assert.match(result.error, /invalid env: ARBITRATOR_PRIVATE_KEY_ARC/)
        assert.ok(!result.error.includes('invalid-secret-fixture'))
      }
      assert.equal(calls, 0)
    } else if (scenario === 'no-testnet') {
      assert.deepEqual(testnet.missingEnv, ['ARBITRATOR_PRIVATE_KEY'])
      const result = await processDispute(disputeId, ARC_TESTNET_ID)
      assert.equal(result.ok, false)
      if (!result.ok) assert.match(result.error, /missing env: ARBITRATOR_PRIVATE_KEY/)
      assert.equal(calls, 0, 'mainnet-only configuration must not enable testnet arbitration')
    }

    const abi = artifact.abi as Abi
    const itemId = `0x${'b'.repeat(64)}` as const
    const statementId = `0x${'c'.repeat(64)}` as const
    const tabId = `0x${'d'.repeat(64)}` as const
    const disputeCall = encodeFunctionData({ abi, functionName: 'getDispute', args: [disputeId] })
    const nonceSenders: string[] = []
    let rpcNetwork = ''
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const body = JSON.parse(String(init?.body))
      if (url.startsWith('https://generativelanguage.googleapis.com/')) {
        return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
          outcome: 'upheld', revisedItemAmountUsdc: 0, claimantBondAwardUsdc: 1, evidenceHashMatched: false, rationale: 'Fixture ruling',
        }) }] } }] })
      }
      assert.equal(url, `http://127.0.0.1:1/${rpcNetwork}`, 'client must use the requested network transport')
      assert.notEqual(body.method, 'eth_sendRawTransaction', 'the test must stop before signing/sending')
      let result: unknown
      if (body.method === 'eth_call') {
        result = body.params[0].data.slice(0, 10) === disputeCall.slice(0, 10)
          ? encodeFunctionResult({ abi, functionName: 'getDispute', result: {
            disputeId, statementId, itemId, claimant: TESTNET_WALLET, claimKind: 'not_delivered', claim: 'Nothing delivered',
            bondAmount: 1_000_000n, status: 0, outcome: '', revisedItemAmount: 0n, claimantBondAward: 0n,
            rationale: '', evidenceHashMatched: false, openedAt: 1n, resolvedAt: 0n, bondCredited: false,
          } })
          : encodeFunctionResult({ abi, functionName: 'getItem', result: {
            itemId, tabId, payer: TESTNET_WALLET, payee: MAINNET_WALLET, amount: 1_000_000n, memo: 'Service',
            evidenceUri: '', evidenceHash: itemId, cycle: 0n, createdAt: 1n,
          } })
      } else if (body.method === 'eth_getTransactionCount') {
        // This is the real wallet client's chosen sender, immediately before signing.
        nonceSenders.push(body.params[0])
        return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32602, message: 'fixture stops before signing' } })
      } else if (body.method === 'eth_getBlockByNumber') {
        result = { number: '0x1', hash: itemId, parentHash: statementId, nonce: '0x0000000000000000',
          sha3Uncles: tabId, logsBloom: `0x${'0'.repeat(512)}`, transactionsRoot: tabId, stateRoot: tabId,
          receiptsRoot: tabId, miner: TESTNET_WALLET, difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x',
          size: '0x0', gasLimit: '0x1c9c380', gasUsed: '0x0', timestamp: '0x1', transactions: [], uncles: [], baseFeePerGas: '0x1' }
      } else if (body.method === 'eth_chainId') {
        result = rpcNetwork === 'mainnet' ? '0x13b2' : '0x4cef52'
      } else if (body.method === 'eth_estimateGas') result = '0x186a0'
      else if (body.method === 'eth_maxPriorityFeePerGas' || body.method === 'eth_gasPrice') result = '0x1'
      else throw new Error(`unexpected RPC method: ${body.method}`)
      return Response.json({ jsonrpc: '2.0', id: body.id, result })
    }) as typeof fetch

    const workingChains = scenario === 'no-testnet' ? [ARC_MAINNET_ID]
      : ['no-mainnet', 'invalid-mainnet'].includes(scenario) ? [ARC_TESTNET_ID] : [ARC_TESTNET_ID, ARC_MAINNET_ID]
    // Alternate networks to exercise independent cached clients, too.
    for (const [index, chainId] of [...workingChains, ...workingChains].entries()) {
      rpcNetwork = chainId === ARC_MAINNET_ID ? 'mainnet' : 'testnet'
      nonceSenders.length = 0
      const id = `0x${(index + 1).toString().repeat(64)}` as `0x${string}`
      const result = await processDispute(id, chainId)
      assert.equal(result.ok, false)
      if (!result.ok) assert.match(result.error, /fixture stops before signing/)
      assert.equal(nonceSenders[0]?.toLowerCase(), (chainId === ARC_MAINNET_ID ? MAINNET_WALLET : TESTNET_WALLET).toLowerCase(), 'ruling must be prepared by the correct per-chain signer')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}
