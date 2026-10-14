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
import { judgeDispute, fetchEvidence } from './gemini.js'
import { RELAYER_CHAINS } from './chains.js'

// ---- Config ----------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const ARBITRATOR_PRIVATE_KEY = process.env.ARBITRATOR_PRIVATE_KEY

// Deliberately NOT thrown at module load. A serverless runtime reports a module-load
// throw as a bare FUNCTION_INVOCATION_FAILED 500 with no message, which makes a missing
// env var indistinguishable from a broken deploy. Report it per-request instead.
function missingConfig(chainId: number): string[] {
  const missing: string[] = []
  if (!GEMINI_API_KEY) missing.push('GEMINI_API_KEY')
  if (!ARBITRATOR_PRIVATE_KEY) missing.push('ARBITRATOR_PRIVATE_KEY')
  const cfg = RELAYER_CHAINS[chainId]
  if (!cfg?.contract) missing.push(cfg?.contractEnvVar ?? 'NOTCH_CONTRACT_ADDRESS')
  return missing
}


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

function buildClients(chainId: number) {
  const { chain, rpcUrl } = RELAYER_CHAINS[chainId]
  const account = privateKeyToAccount(ARBITRATOR_PRIVATE_KEY as `0x${string}`)
  return {
    account,
    publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
    walletClient: createWalletClient({ account, chain, transport: http(rpcUrl) }),
  }
}

// Inferred, not annotated: an explicit ReturnType<typeof createWalletClient> erases the
// chain generic, and writeContract then demands an explicit `chain` arg.
const _clients = new Map<number, ReturnType<typeof buildClients>>()

function clients(chainId: number) {
  let c = _clients.get(chainId)
  if (!c) { c = buildClients(chainId); _clients.set(chainId, c) }
  return c
}

/** Arbitrator address, or null if the key isn't configured — never throws. */
export function arbitratorAddress(): string | null {
  try {
    return privateKeyToAccount(ARBITRATOR_PRIVATE_KEY as `0x${string}`).address
  } catch {
    return null
  }
}

// ---- State -----------------------------------------------------------------
// ponytail: in-memory. Long-lived locally; per-instance on Vercel, where it only
// dedupes within a warm instance. Real idempotency is on-chain — status must be
// Open and only the arbitrator can submit a ruling.

export const processedDisputes = new Set<string>()
export const retryAfter = new Map<string, number>()   // chainId:disputeId -> earliest next attempt
export const rulingLog: Array<{ chainId: number; disputeId: string; outcome: string; at: string; rationale: string }> = []

/** For /health — never throws, so a misconfigured deploy still returns a readable page. */
export function health() {
  const chains = Object.entries(RELAYER_CHAINS).map(([id, cfg]) => ({
    chainId: Number(id),
    label: cfg.label,
    contract: cfg.contract ?? null,
    rpc: cfg.rpcUrl,
    missingEnv: missingConfig(Number(id)),
  }))
  return {
    status: chains.some(c => c.missingEnv.length === 0) ? 'ok' : 'misconfigured',
    arbitrator: arbitratorAddress(),
    chains,
    processedThisInstance: processedDisputes.size,
    latestRulings: rulingLog.slice(-10),
  }
}

export type ProcessResult =
  | { ok: true; outcome: string; txHash: string; rationale: string }
  | { ok: true; skipped: string }
  | { ok: false; error: string; retryAfterMs?: number }

// ---- Process a single dispute ----------------------------------------------

export async function processDispute(disputeId: `0x${string}`, chainId: number): Promise<ProcessResult> {
  const cfg = RELAYER_CHAINS[chainId]
  if (!cfg) return { ok: false, error: `unsupported chainId: ${chainId}` }
  const missing = missingConfig(chainId)
  if (missing.length > 0) {
    return { ok: false, error: `relayer not configured for ${cfg.label} — missing env: ${missing.join(', ')}` }
  }
  const key = `${chainId}:${disputeId}`
  if (processedDisputes.has(key)) return { ok: true, skipped: 'already processed' }
  const backoff = retryAfter.get(key) ?? 0
  if (backoff > Date.now()) {
    return { ok: false, error: 'backing off', retryAfterMs: backoff - Date.now() }
  }
  processedDisputes.add(key)

  const contract = cfg.contract!
  console.log(`[relayer] Processing dispute ${disputeId} on ${cfg.label}`)

  try {
    const { publicClient, walletClient } = clients(chainId)
    const dispute = await publicClient.readContract({
      address: contract,
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
      address: contract,
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
        bondAmount: dispute.bondAmount,
      },
      GEMINI_API_KEY!
    )

    console.log(`[relayer] Ruling: ${ruling.outcome} — ${ruling.rationale}`)

    const hash = await walletClient.writeContract({
      address: contract,
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
      chainId,
      disputeId,
      outcome: ruling.outcome,
      at: new Date().toISOString(),
      rationale: ruling.rationale,
    })
    return { ok: true, outcome: ruling.outcome, txHash: hash, rationale: ruling.rationale }
  } catch (err) {
    const ms = (err as { retryAfterMs?: number })?.retryAfterMs ?? 60_000
    retryAfter.set(key, Date.now() + ms)
    processedDisputes.delete(key)  // allow retry after backoff
    console.error(`[relayer] Error processing dispute ${disputeId} — retrying in ${Math.round(ms / 1000)}s:`, err)
    return { ok: false, error: err instanceof Error ? err.message : String(err), retryAfterMs: ms }
  }
}
