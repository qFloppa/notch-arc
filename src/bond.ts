import { maxUint256, parseUnits } from 'viem'

/** A positive, exact six-decimal USDC amount that fits the contract's uint256. */
export function parseBondAmount(input: string): bigint | null {
  const value = input.trim()
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) return null
  const amount = parseUnits(value, 6)
  return amount > 0n && amount <= maxUint256 ? amount : null
}
