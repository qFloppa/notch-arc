/**
 * GET /api/relayer/health  (also /relayer/health via vercel.json rewrite)
 *
 * Confirms the function's env vars landed: `arbitrator` here must equal the contract's
 * `arbitrator`, or every ruling reverts. If env is missing, status is "misconfigured"
 * and missingEnv lists what to set — a readable 200, not an opaque 500.
 */

import { health } from '../../relayer/arbitrate.js'

type Res = { status(code: number): Res; json(body: unknown): void }

export default function handler(_req: unknown, res: Res) {
  res.status(200).json(health())
}
