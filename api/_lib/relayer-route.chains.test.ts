/** Serverless route validation, with no live keys or network. Run: bun api/_lib/relayer-route.chains.test.ts */
import assert from 'node:assert'
import { arc, arcTestnet } from 'viem/chains'

delete process.env.GEMINI_API_KEY
delete process.env.ARBITRATOR_PRIVATE_KEY
delete process.env.ARBITRATOR_PRIVATE_KEY_ARC
delete process.env.NOTCH_CONTRACT_ADDRESS
delete process.env.NOTCH_CONTRACT_ADDRESS_ARC
delete process.env.VITE_NOTCH_CONTRACT_ADDRESS
const { default: handler } = await import('../relayer/dispute.js')

async function request(body: unknown, method = 'POST') {
  let code = 0
  let response: unknown
  const res = {
    status(value: number) { code = value; return res },
    json(value: unknown) { response = value },
  }
  await handler({ method, body }, res)
  return { code, body: response as { error?: string } }
}

const disputeId = `0x${'1'.repeat(64)}`
const legacy = await request({ disputeId })
assert.equal(legacy.code, 502)
assert.match(legacy.body.error ?? '', /not configured for Arc Testnet/)

for (const chainId of [arc.id, String(arc.id)]) {
  const mainnet = await request(JSON.stringify({ disputeId, chainId }))
  assert.equal(mainnet.code, 502)
  assert.match(mainnet.body.error ?? '', /not configured for Arc .*NOTCH_CONTRACT_ADDRESS_ARC/)
  assert.match(mainnet.body.error ?? '', /ARBITRATOR_PRIVATE_KEY_ARC/)
}
assert.equal((await request({ disputeId, chainId: arcTestnet.id })).code, 502)
assert.deepEqual(await request({ disputeId, chainId: 1 }), { code: 400, body: { error: 'unsupported chainId: 1' } })
for (const body of ['{', 'null', null, [], { disputeId: 123 }, { disputeId: '0x123' }]) {
  assert.equal((await request(body)).code, 400, 'malformed input should return 400')
}
assert.equal((await request({}, 'GET')).code, 405)
console.log('relayer route chains: all assertions passed')
