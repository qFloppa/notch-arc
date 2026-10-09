/**
 * arbitrate.ts — the actual arbitration work, independent of how it's triggered.
 *
 * Two callers:
 *   - relayer/server.ts          local Bun HTTP server (`bun run dev` in relayer/)
 *   - api/relayer/dispute.ts     Vercel Function (production)
 *
 * No eth_getLogs anywhere (broken on Arc Testnet RPC) — a dispute is discovered only
 * by being pushed in by the frontend, which reads the chain itself.
 */

import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from 'viem/chains'
import { judgeDispute, fetchEvidence } from './gemini'

// ---- Config ----------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const ARBITRATOR_PRIVATE_KEY = process.env.ARBITRATOR_PRIVATE_KEY
export const CONTRACT_ADDRESS = (
  process.env.VITE_NOTCH_CONTRACT_ADDRESS ??
  process.env.NOTCH_CONTRACT_ADDRESS
) as `0x${string}` | undefined

// Deliberately NOT thrown at module load. A serverless runtime reports a module-load
// throw as a bare FUNCTION_INVOCATION_FAILED 500 with no message, which makes a missing
// env var indistinguishable from a broken deploy. Report it per-request instead.
function missingConfig(): string[] {
  const missing: string[] = []
  if (!GEMINI_API_KEY) missing.push('GEMINI_API_KEY')
  if (!ARBITRATOR_PRIVATE_KEY) missing.push('ARBITRATOR_PRIVATE_KEY')
  if (!CONTRACT_ADDRESS) missing.push('VITE_NOTCH_CONTRACT_ADDRESS')
  return missing
}


// RPC: prefer an explicitly configured URL, then the Arc Studio proxy, then viem's
// default. The proxy token is a ~30min JWT, so an explicit URL is the only sane
// choice in production.
function buildRpcUrl(): string {
  const explicit = process.env.ARC_TESTNET_RPC_URL
  if (explicit) return explicit
  const proxyBase = process.env.RPC_PROXY_BASE_URL
  const proxyToken = process.env.RPC_PROXY_TOKEN
  const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',')
  if (proxyBase && proxyToken && proxyChains.includes('Arc_Testnet')) {
    return `${proxyBase}/api/rpc/Arc_Testnet?_rpc_token=${proxyToken}`
  }
  return arcTestnet.rpcUrls.default.http[0]
}

export const RPC_URL = buildRpcUrl()

// ---- Contract ABI (minimal) ------------------------------------------------

const GET_DISPUTE_ABI = [{
  type: 'function', name: 'getDispute',
  inputs: [{ name: 'disputeId', type: 'bytes32' }],
  outputs: [{ type: 'tuple', components: [
    { name: 'disputeId', type: 'bytes32' },
    { name: 'statementId', type: 'bytes32' },
    { name: 'itemId', type: 'bytes32' },
    { name: 'claimant', type: 'address' },
    { name: 'claimKind', type: 'string' },
    { name: 'claim', type: 'string' },
    { name: 'bondAmount', type: 'uint256' },
    { name: 'status', type: 'uint8' },
    { name: 'outcome', type: 'string' },
    { name: 'revisedItemAmount', type: 'uint256' },
    { name: 'claimantBondAward', type: 'uint256' },
    { name: 'rationale', type: 'string' },
    { name: 'evidenceHashMatched', type: 'bool' },
    { name: 'openedAt', type: 'uint256' },
    { name: 'resolvedAt', type: 'uint256' },
    { name: 'bondCredited', type: 'bool' },
  ]}],
  stateMutability: 'view',
}] as const

const GET_ITEM_ABI = [{
  type: 'function', name: 'getItem',
  inputs: [{ name: 'itemId', type: 'bytes32' }],
  outputs: [{ type: 'tuple', components: [
    { name: 'itemId', type: 'bytes32' },
    { name: 'tabId', type: 'bytes32' },
    { name: 'payer', type: 'address' },
    { name: 'payee', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'memo', type: 'string' },
    { name: 'evidenceUri', type: 'string' },
    { name: 'evidenceHash', type: 'bytes32' },
    { name: 'cycle', type: 'uint256' },
    { name: 'createdAt', type: 'uint256' },
  ]}],
  stateMutability: 'view',
}] as const

const SUBMIT_RULING_ABI = [{
  type: 'function', name: 'submitRuling',
  inputs: [
    { name: 'disputeId', type: 'bytes32' },
    { name: 'outcome', type: 'string' },
    { name: 'revisedItemAmount', type: 'uint256' },
    { name: 'claimantBondAward', type: 'uint256' },
    { name: 'evidenceHashMatched', type: 'bool' },
    { name: 'rationale', type: 'string' },
  ],
  outputs: [],
  stateMutability: 'nonpayable',
}] as const

// ---- Clients (lazy) --------------------------------------------------------
// Built on first use, never at module load — privateKeyToAccount() throws on a missing
// or malformed key, and a load-time throw is the same opaque 500 as above.

let _clients: {
  account: ReturnType<typeof privateKeyToAccount>
  publicClient: ReturnType<typeof createPublicClient>
  walletClient: ReturnType<typeof createWalletClient>
} | null = null

function clients() {
  if (_clients) return _clients
  const account = privateKeyToAccount(ARBITRATOR_PRIVATE_KEY as `0x${string}`)
  _clients = {
    account,
    publicClient: createPublicClient({ chain: arcTestnet, transport: http(RPC_URL) }),
    walletClient: createWalletClient({ account, chain: arcTestnet, transport: http(RPC_URL) }),
  }
  return _clients
}

/** Arbitrator address, or null if the key isn't configured — never throws. */
export function arbitratorAddress(): string | null {
  try {
    return clients().account.address
  } catch {
    return null
  }
}

// ---- State -----------------------------------------------------------------
// ponytail: in-memory. Long-lived locally; per-instance on Vercel, where it only
// dedupes within a warm instance. Real idempotency is on-chain — status must be
// Open and only the arbitrator can submit a ruling.

export const processedDisputes = new Set<string>()
export const retryAfter = new Map<string, number>()   // disputeId -> earliest next attempt (ms epoch)
export const rulingLog: Array<{ disputeId: string; outcome: string; at: string; rationale: string }> = []

/** For /health — never throws, so a misconfigured deploy still returns a readable page. */
export function health() {
  const missing = missingConfig()
  return {
    status: missing.length === 0 ? 'ok' : 'misconfigured',
    missingEnv: missing,
    arbitrator: arbitratorAddress(),
    contract: CONTRACT_ADDRESS ?? null,
    rpc: RPC_URL,
    processedThisInstance: processedDisputes.size,
    latestRulings: rulingLog.slice(-10),
  }
}

export type ProcessResult =
  | { ok: true; outcome: string; txHash: string; rationale: string }
  | { ok: true; skipped: string }
  | { ok: false; error: string; retryAfterMs?: number }

// ---- Process a single dispute ----------------------------------------------

export async function processDispute(disputeId: `0x${string}`): Promise<ProcessResult> {
  const missing = missingConfig()
  if (missing.length > 0) {
    return { ok: false, error: `relayer not configured — missing env: ${missing.join(', ')}` }
  }
  if (processedDisputes.has(disputeId)) return { ok: true, skipped: 'already processed' }
  const backoff = retryAfter.get(disputeId) ?? 0
  if (backoff > Date.now()) {
    return { ok: false, error: 'backing off', retryAfterMs: backoff - Date.now() }
  }
  processedDisputes.add(disputeId)

  console.log(`[relayer] Processing dispute ${disputeId}`)

  const { publicClient, walletClient } = clients()

  try {
    const dispute = await publicClient.readContract({
      address: CONTRACT_ADDRESS!,
      abi: GET_DISPUTE_ABI,
      functionName: 'getDispute',
      args: [disputeId],
    }) as {
      status: number; claimKind: string; claim: string
      bondAmount: bigint; itemId: `0x${string}`; openedAt: bigint
    }

    // An unknown disputeId reads back as a zeroed struct, whose status is 0 (Open).
    // Without this guard any caller could spend our Gemini quota on invented ids.
    if (dispute.openedAt === 0n) {
      console.log(`[relayer] Dispute ${disputeId} does not exist, skipping`)
      return { ok: false, error: 'dispute not found' }
    }

    if (dispute.status !== 0) {
      console.log(`[relayer] Dispute ${disputeId} already resolved, skipping`)
      return { ok: true, skipped: 'already resolved on-chain' }
    }

    const item = await publicClient.readContract({
      address: CONTRACT_ADDRESS!,
      abi: GET_ITEM_ABI,
      functionName: 'getItem',
      args: [dispute.itemId],
    }) as { amount: bigint; memo: string; evidenceUri: string }

    console.log(`[relayer] Fetching evidence: ${item.evidenceUri}`)
    const evidenceContent = await fetchEvidence(item.evidenceUri)

    console.log(`[relayer] Calling Gemini for dispute ${disputeId}`)
    const ruling = await judgeDispute(
      {
        claimKind: dispute.claimKind,
        claim: dispute.claim,
        memo: item.memo,
        evidenceUri: item.evidenceUri,
        evidenceContent,
        chargeAmount: item.amount,
      },
      GEMINI_API_KEY!
    )

    console.log(`[relayer] Ruling: ${ruling.outcome} — ${ruling.rationale}`)

    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS!,
      abi: SUBMIT_RULING_ABI,
      functionName: 'submitRuling',
      args: [
        disputeId,
        ruling.outcome,
        ruling.revisedItemAmount,
        ruling.claimantBondAward,
        ruling.evidenceHashMatched,
        ruling.rationale,
      ],
    })

    console.log(`[relayer] Ruling submitted: ${hash}`)
    rulingLog.push({
      disputeId,
      outcome: ruling.outcome,
      at: new Date().toISOString(),
      rationale: ruling.rationale,
    })
    return { ok: true, outcome: ruling.outcome, txHash: hash, rationale: ruling.rationale }
  } catch (err) {
    const ms = (err as { retryAfterMs?: number })?.retryAfterMs ?? 60_000
    retryAfter.set(disputeId, Date.now() + ms)
    processedDisputes.delete(disputeId)  // allow retry after backoff
    console.error(`[relayer] Error processing dispute ${disputeId} — retrying in ${Math.round(ms / 1000)}s:`, err)
    return { ok: false, error: err instanceof Error ? err.message : String(err), retryAfterMs: ms }
  }
}
