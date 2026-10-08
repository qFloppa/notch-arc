/**
 * Notch dispute arbitrator relayer
 *
 * Two discovery modes (both avoid eth_getLogs which is broken on Arc Testnet RPC):
 *
 * 1. PUSH — the frontend POSTs { disputeId } to /dispute immediately after a
 *    DisputeOpened tx confirms. Processed within seconds.
 *
 * 2. SCAN FALLBACK — every POLL_INTERVAL_MS the relayer re-checks every statementId
 *    the frontend has registered via /register-statement, reading each one's
 *    disputeByStatementAndItem mapping directly. The frontend re-registers on every
 *    tab load, so this manifest rebuilds itself after a relayer restart.
 *
 * No getLogs. No block-range queries.
 */

import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from 'viem/chains'
import { judgeDispute, fetchEvidence } from './gemini'

// ---- Config ----------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const ARBITRATOR_PRIVATE_KEY = process.env.ARBITRATOR_PRIVATE_KEY
const CONTRACT_ADDRESS = (
  process.env.VITE_NOTCH_CONTRACT_ADDRESS ??
  process.env.NOTCH_CONTRACT_ADDRESS
) as `0x${string}` | undefined
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '20000', 10)
const PORT = parseInt(process.env.PORT ?? '3001', 10)

if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required in relayer/.env')
if (!ARBITRATOR_PRIVATE_KEY) throw new Error('ARBITRATOR_PRIVATE_KEY is required in relayer/.env')
if (!CONTRACT_ADDRESS) throw new Error('VITE_NOTCH_CONTRACT_ADDRESS (or NOTCH_CONTRACT_ADDRESS) is required')

// RPC: prefer an explicitly configured URL, then the Arc Studio proxy, then viem's
// default. The proxy token is a ~30min JWT, so an explicit URL is the durable choice
// for a long-running relayer.
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

const RPC_URL = buildRpcUrl()

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

const DISPUTE_BY_STATEMENT_ABI = [{
  type: 'function', name: 'disputeByStatementAndItem',
  inputs: [{ name: 'statementId', type: 'bytes32' }, { name: 'itemId', type: 'bytes32' }],
  outputs: [{ type: 'bytes32' }],
  stateMutability: 'view',
}] as const

const GET_STATEMENT_ABI = [{
  type: 'function', name: 'getStatement',
  inputs: [{ name: 'statementId', type: 'bytes32' }],
  outputs: [{ type: 'tuple', components: [
    { name: 'statementId', type: 'bytes32' },
    { name: 'tabId', type: 'bytes32' },
    { name: 'cycle', type: 'uint256' },
    { name: 'closedAt', type: 'uint256' },
    { name: 'closedBy', type: 'address' },
    { name: 'statementHash', type: 'bytes32' },
    { name: 'status', type: 'uint8' },
    { name: 'netAmount', type: 'uint256' },
    { name: 'itemIds', type: 'bytes32[]' },
    { name: 'acceptedBy', type: 'address' },
    { name: 'acceptedAt', type: 'uint256' },
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

// ---- Clients ---------------------------------------------------------------

const account = privateKeyToAccount(ARBITRATOR_PRIVATE_KEY as `0x${string}`)

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(RPC_URL),
})

const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(RPC_URL),
})

// ---- State -----------------------------------------------------------------

const processedDisputes = new Set<string>()
const retryAfter = new Map<string, number>()          // disputeId -> earliest next attempt (ms epoch)
const pendingDisputeIds = new Set<string>()          // pushed by frontend, not yet processed
const knownStatementIds = new Set<string>()          // registered by frontend for fallback scan
const rulingLog: Array<{ disputeId: string; outcome: string; at: string; rationale: string }> = []

// ---- Process a single dispute ----------------------------------------------

async function processDispute(disputeId: `0x${string}`) {
  if (processedDisputes.has(disputeId)) return
  if ((retryAfter.get(disputeId) ?? 0) > Date.now()) return
  processedDisputes.add(disputeId)

  console.log(`[relayer] Processing dispute ${disputeId}`)

  try {
    const dispute = await publicClient.readContract({
      address: CONTRACT_ADDRESS!,
      abi: GET_DISPUTE_ABI,
      functionName: 'getDispute',
      args: [disputeId],
    }) as {
      status: number; claimKind: string; claim: string
      bondAmount: bigint; itemId: `0x${string}`
    }

    if (dispute.status !== 0) {
      console.log(`[relayer] Dispute ${disputeId} already resolved, skipping`)
      return
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
  } catch (err) {
    const ms = (err as { retryAfterMs?: number })?.retryAfterMs ?? 60_000
    retryAfter.set(disputeId, Date.now() + ms)
    console.error(`[relayer] Error processing dispute ${disputeId} — retrying in ${Math.round(ms / 1000)}s:`, err)
    processedDisputes.delete(disputeId)  // allow retry after backoff
  }
}

// ---- Fallback scan — checks registered statements for disputes -------------

async function scanStatements() {
  if (knownStatementIds.size === 0) return
  for (const statementId of knownStatementIds) {
    try {
      const stmt = await publicClient.readContract({
        address: CONTRACT_ADDRESS!,
        abi: GET_STATEMENT_ABI,
        functionName: 'getStatement',
        args: [statementId as `0x${string}`],
      }) as { status: number; itemIds: `0x${string}`[] }

      // status 2 = Disputed, status 3 = Resolved
      if (stmt.status !== 2) continue

      for (const itemId of stmt.itemIds) {
        const disputeId = await publicClient.readContract({
          address: CONTRACT_ADDRESS!,
          abi: DISPUTE_BY_STATEMENT_ABI,
          functionName: 'disputeByStatementAndItem',
          args: [statementId as `0x${string}`, itemId],
        }) as `0x${string}`

        const zero = '0x0000000000000000000000000000000000000000000000000000000000000000'
        if (disputeId === zero) continue
        if (!processedDisputes.has(disputeId)) {
          console.log(`[relayer] Fallback scan found unprocessed dispute ${disputeId}`)
          void processDispute(disputeId)
        }
      }
    } catch (err) {
      console.error(`[relayer] Scan error for statement ${statementId}:`, err)
    }
  }
}

// ---- Drain push queue ------------------------------------------------------

async function drainPending() {
  for (const id of [...pendingDisputeIds]) {
    pendingDisputeIds.delete(id)
    void processDispute(id as `0x${string}`)
  }
}

// ---- HTTP server -----------------------------------------------------------

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS headers for Vite dev proxy
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

    // GET /health — status page
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        arbitrator: account.address,
        contract: CONTRACT_ADDRESS,
        rpc: RPC_URL,
        processedDisputes: processedDisputes.size,
        pendingDisputes: pendingDisputeIds.size,
        knownStatements: knownStatementIds.size,
        backingOff: [...retryAfter]
          .filter(([, at]) => at > Date.now())
          .map(([id, at]) => ({ disputeId: id, retryInSeconds: Math.round((at - Date.now()) / 1000) })),
        latestRulings: rulingLog.slice(-10),
      }), { headers })
    }

    // POST /dispute — frontend pushes a disputeId immediately after tx confirms
    if (req.method === 'POST' && url.pathname === '/dispute') {
      try {
        const body = await req.json() as { disputeId?: string }
        if (!body.disputeId || !/^0x[0-9a-fA-F]{64}$/.test(body.disputeId)) {
          return new Response(JSON.stringify({ error: 'invalid disputeId' }), { status: 400, headers })
        }
        pendingDisputeIds.add(body.disputeId)
        void drainPending()
        console.log(`[relayer] Dispute pushed: ${body.disputeId}`)
        return new Response(JSON.stringify({ queued: true }), { headers })
      } catch {
        return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers })
      }
    }

    // POST /register-statement — frontend registers a statementId for fallback scan
    if (req.method === 'POST' && url.pathname === '/register-statement') {
      try {
        const body = await req.json() as { statementId?: string }
        if (!body.statementId || !/^0x[0-9a-fA-F]{64}$/.test(body.statementId)) {
          return new Response(JSON.stringify({ error: 'invalid statementId' }), { status: 400, headers })
        }
        knownStatementIds.add(body.statementId)
        return new Response(JSON.stringify({ registered: true }), { headers })
      } catch {
        return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers })
      }
    }

    return new Response('Notch Relayer\n  GET  /health\n  POST /dispute\n  POST /register-statement', { status: 200 })
  },
})

console.log(`[relayer] Notch arbitrator relayer starting`)
console.log(`[relayer] Arbitrator: ${account.address}`)
console.log(`[relayer] Contract:   ${CONTRACT_ADDRESS}`)
console.log(`[relayer] RPC:        ${RPC_URL}`)
console.log(`[relayer] Poll:       ${POLL_INTERVAL_MS}ms`)
console.log(`[relayer] Status:     http://localhost:${PORT}/health`)

// Initial drain + scan
await drainPending()
await scanStatements()

// Periodic fallback scan
setInterval(() => { void drainPending(); void scanStatements() }, POLL_INTERVAL_MS)
