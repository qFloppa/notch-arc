/**
 * POST /api/relayer/dispute  (also reachable as /relayer/dispute via vercel.json rewrite)
 *
 * Arbitrates one dispute and returns the result. Must await — a serverless invocation
 * is killed the moment it responds, so there is no "process it in the background".
 */

import { processDispute } from '../_lib/arbitrate.js'

type Req = { method?: string; body?: unknown }
type Res = { status(code: number): Res; json(body: unknown): void }

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  // Vercel parses JSON bodies, but only when the client sent the right content-type.
  let body: { disputeId?: string } = {}
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as { disputeId?: string }
  } catch {
    res.status(400).json({ error: 'bad request' })
    return
  }

  const disputeId = body.disputeId
  if (!disputeId || !/^0x[0-9a-fA-F]{64}$/.test(disputeId)) {
    res.status(400).json({ error: 'invalid disputeId' })
    return
  }

  const result = await processDispute(disputeId as `0x${string}`)
  res.status(result.ok ? 200 : 502).json(result)
}
