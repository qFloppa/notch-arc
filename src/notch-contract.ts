/**
 * Notch contract config — Arc Testnet
 * Address: 0xeffe19557a9cac8bf25ef6d3f072481d46a0938a
 */
import artifact from '../contracts/out/Notch.sol/Notch.json'

export const NOTCH_CONTRACT = {
  address: '0xeffe19557a9cac8bf25ef6d3f072481d46a0938a' as const,
  abi: artifact.abi,
} as const

export const ARC_TESTNET_CHAIN_ID = 5042002

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as `0x${string}`

/** 1 USDC in 6-decimal units — the dispute bond amount */
export const BOND_AMOUNT = 1_000_000n

export type StatementStatus = 'Open' | 'Accepted' | 'Disputed' | 'Resolved' | 'Settled'
export type DisputeStatus = 'Pending' | 'Resolved'

export const STATUS_LABELS: Record<number, StatementStatus> = {
  0: 'Open',
  1: 'Accepted',
  2: 'Disputed',
  3: 'Resolved',
  4: 'Settled',
}

export const CLAIM_KINDS = [
  'not_delivered',
  'off_spec',
  'overcharged',
  'duplicate',
  'sla_breach',
] as const

export type ClaimKind = typeof CLAIM_KINDS[number]

export function formatUsdc(raw: bigint): string {
  const n = Number(raw) / 1_000_000
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return '—'
  return new Date(Number(ts) * 1000).toLocaleString()
}
