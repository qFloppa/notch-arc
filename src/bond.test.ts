/** Run: bun src/bond.test.ts */
import assert from 'node:assert/strict'
import { maxUint256, formatUnits } from 'viem'
import { parseBondAmount } from './bond'

for (const [input, expected] of [
  ['1', 1_000_000n],
  [' 2.5 ', 2_500_000n],
  ['0.000001', 1n],
  ['0.125001', 125_001n],
  ['001.250000', 1_250_000n],
  [formatUnits(maxUint256, 6), maxUint256],
] as const) {
  assert.equal(parseBondAmount(input), expected, input)
}

for (const input of ['', '0', '0.000000', '-1', '+1', '1e2', 'NaN', 'Infinity', '1,000', '0.0000001', '1.1234567', '1.', formatUnits(maxUint256 + 1n, 6)]) {
  assert.equal(parseBondAmount(input), null, `${input} must not be sent to setBondAmount`)
}
console.log('bond input: all assertions passed')
