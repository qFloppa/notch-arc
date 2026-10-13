/**
 * Notch contract config — formatters, shared constants and the relayer push.
 *
 * Per-network contract addresses and the active-network hook live in networks.ts;
 * call sites get {address, abi, chainId} from useNotch().contract rather than a
 * single hardcoded deployment.
 */

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

const pushedDisputes = new Set<string>()

export type PushResult =
  | { ok: true; outcome?: string; skipped?: string }
  | { ok: false; error: string; retryAfterMs?: number }

/**
 * Hand a disputeId to the arbitrator relayer and report what came back, so the UI can
 * show "reviewing" vs "overloaded, retrying". `/relayer` is the Vite dev proxy locally
 * and a vercel.json rewrite to /api/relayer in production.
 *
 * Deduped per page load while a push is in flight or has succeeded — pushing twice would
 * pay Gemini twice for one dispute. A failed push clears the dedupe so a later poll can
 * retry (e.g. after a transient overload). Callers may re-invoke on each poll; this
 * swallows the duplicates.
 */
export async function pushDispute(disputeId: `0x${string}`, chainId: number): Promise<PushResult | null> {
  const key = `${chainId}:${disputeId}`
  if (pushedDisputes.has(key)) return null   // in flight or already done this load
  pushedDisputes.add(key)
  console.log('[notch] Pushing disputeId to relayer:', disputeId, 'chain', chainId)
  try {
    const res = await fetch('/relayer/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disputeId, chainId }),
    })
    const data = await res.json() as PushResult
    console.log('[notch] Relayer response:', data)
    if (!data.ok) pushedDisputes.delete(key)   // allow a later poll to retry
    return data
  } catch (e) {
    pushedDisputes.delete(key)                 // network failure — let a later poll retry
    console.warn('[notch] Relayer push failed:', e)
    return { ok: false, error: 'relayer unreachable' }
  }
}
