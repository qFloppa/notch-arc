/**
 * Notch dispute arbitrator relayer — local dev server.
 *
 * Thin HTTP wrapper around the shared arbitration module (api/_lib/arbitrate.ts).
 * Production runs that same module as a Vercel Function (api/relayer/*); this exists so
 * `bun run dev` in relayer/ gives you the identical behaviour behind the Vite /relayer
 * proxy. The shared code lives under api/_lib — not here — because Vercel treats relayer/
 * as a separate package (own package.json) and won't bundle imports that cross into it.
 *
 * Discovery is push-only: the frontend POSTs { disputeId, chainId } here, both right after a
 * DisputeOpened tx confirms and on every tab load for any dispute still Open. The
 * frontend already reads the chain, so it needs no help finding them — and that works
 * the same whether this process just restarted or is a cold serverless instance.
 */

import { processDispute, health, arbitratorAddress } from '../api/_lib/arbitrate.js'
import { RELAYER_CHAINS, resolveRelayerChain } from '../api/_lib/chains.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const headers = { 'Content-Type': 'application/json' }

    // GET /health — status page
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify(health()), { headers })
    }

    // POST /dispute — frontend pushes a disputeId to be arbitrated
    if (req.method === 'POST' && url.pathname === '/dispute') {
      let body: { disputeId?: unknown; chainId?: unknown }
      try {
        const parsed: unknown = await req.json()
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad request')
        body = parsed as typeof body
      } catch {
        return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers })
      }
      const disputeId = body.disputeId
      if (typeof disputeId !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(disputeId)) {
        return new Response(JSON.stringify({ error: 'invalid disputeId' }), { status: 400, headers })
      }
      const chain = resolveRelayerChain(body.chainId)
      if (!chain.ok) {
        return new Response(JSON.stringify({ error: chain.error }), { status: 400, headers })
      }
      console.log(`[relayer] Dispute pushed: ${disputeId} on chain ${chain.chainId}`)
      const result = await processDispute(disputeId as `0x${string}`, chain.chainId)
      return new Response(JSON.stringify(result), { status: result.ok ? 200 : 502, headers })
    }

    return new Response('Notch Relayer\n  GET  /health\n  POST /dispute', { status: 200 })
  },
})

console.log(`[relayer] Notch arbitrator relayer starting`)
console.log(`[relayer] Arbitrator: ${arbitratorAddress() ?? '(key not configured)'}`)
for (const cfg of Object.values(RELAYER_CHAINS)) {
  console.log(`[relayer] ${cfg.label}: ${cfg.contract ?? '(not configured)'} via ${cfg.rpcUrl}`)
}
console.log(`[relayer] Status:     http://localhost:${PORT}/health`)
