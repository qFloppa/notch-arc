/**
 * Notch dispute arbitrator relayer — local dev server.
 *
 * Thin HTTP wrapper around relayer/arbitrate.ts. Production runs the same module as a
 * Vercel Function (api/relayer/*); this exists so `bun run dev` in relayer/ gives you
 * the identical behaviour behind the Vite /relayer proxy.
 *
 * Discovery is push-only: the frontend POSTs { disputeId } here, both right after a
 * DisputeOpened tx confirms and on every tab load for any dispute still Open. The
 * frontend already reads the chain, so it needs no help finding them — and that works
 * the same whether this process just restarted or is a cold serverless instance.
 */

import { processDispute, health, arbitratorAddress, CONTRACT_ADDRESS, RPC_URL } from './arbitrate'

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
      let disputeId: string | undefined
      try {
        disputeId = (await req.json() as { disputeId?: string }).disputeId
      } catch {
        return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers })
      }
      if (!disputeId || !/^0x[0-9a-fA-F]{64}$/.test(disputeId)) {
        return new Response(JSON.stringify({ error: 'invalid disputeId' }), { status: 400, headers })
      }
      console.log(`[relayer] Dispute pushed: ${disputeId}`)
      const result = await processDispute(disputeId as `0x${string}`)
      return new Response(JSON.stringify(result), { status: result.ok ? 200 : 502, headers })
    }

    return new Response('Notch Relayer\n  GET  /health\n  POST /dispute', { status: 200 })
  },
})

console.log(`[relayer] Notch arbitrator relayer starting`)
console.log(`[relayer] Arbitrator: ${arbitratorAddress() ?? '(key not configured)'}`)
console.log(`[relayer] Contract:   ${CONTRACT_ADDRESS}`)
console.log(`[relayer] RPC:        ${RPC_URL}`)
console.log(`[relayer] Status:     http://localhost:${PORT}/health`)
