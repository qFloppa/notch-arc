/** No live Gemini calls. Run: bun api/_lib/gemini.bond.test.ts */
import assert from 'node:assert/strict'
import { formatUnits } from 'viem'
import { judgeDispute } from './gemini.js'

const originalFetch = globalThis.fetch
let award: unknown = 2.5
let requestBody = ''
globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
  requestBody = String(init?.body)
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
    outcome: 'upheld', revisedItemAmountUsdc: 0, claimantBondAwardUsdc: award,
    evidenceHashMatched: true, rationale: 'Service was not delivered.',
  }) }] } }] })
}) as typeof fetch

const ctx = {
  claimKind: 'not_delivered', claim: 'Nothing delivered', memo: 'Service',
  evidenceUri: '', evidenceContent: null, chargeAmount: 5_000_000n,
  bondAmount: 3_000_000n,
}

try {
  const aboveOne = await judgeDispute(ctx, 'test-only')
  assert.equal(aboveOne.claimantBondAward, 2_500_000n, 'awards above 1 USDC must be supported')
  assert.equal(aboveOne.revisedItemAmount, 0n)
  assert.match(JSON.parse(requestBody).contents[0].parts[0].text, /Dispute bond: 3 USDC/)
  assert.doesNotMatch(JSON.parse(requestBody).system_instruction.parts[0].text, /1 USDC bond|0 to 1\.0/)

  for (const bond of [125_001n, 1n, 10_000_000n, 9_007_199_254_740_993n]) {
    award = Number(formatUnits(bond, 6)) * 2
    const ruling = await judgeDispute({ ...ctx, bondAmount: bond }, 'test-only')
    assert.equal(ruling.claimantBondAward, bond, 'an award must clamp to the exact recorded bond')
    assert.ok(JSON.parse(requestBody).contents[0].parts[0].text.includes(`Dispute bond: ${formatUnits(bond, 6)} USDC`))
  }

  award = -1
  assert.equal((await judgeDispute(ctx, 'test-only')).claimantBondAward, 0n)
  award = 0.1234567
  assert.equal((await judgeDispute(ctx, 'test-only')).claimantBondAward, 123_457n)
  award = 1e100
  assert.equal((await judgeDispute(ctx, 'test-only')).claimantBondAward, ctx.bondAmount)
  award = '2.5'
  await assert.rejects(() => judgeDispute(ctx, 'test-only'), /Invalid claimant bond award/)
} finally {
  globalThis.fetch = originalFetch
}
console.log('gemini bond: all assertions passed')
