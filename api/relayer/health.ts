/**
 * GET /api/relayer/health  (also /relayer/health via vercel.json rewrite)
 *
 * Confirms env vars landed: each chains[].arbitrator must equal that chain's contract
 * arbitrator. Per-chain missingEnv/invalidEnv identify configuration issues; global
 * status is "ok" when at least one chain is configured. Legacy top-level arbitrator
 * remains the testnet address. A readable 200, not an opaque 500.
 */

import { health } from '../_lib/arbitrate.js'

type Res = { status(code: number): Res; json(body: unknown): void }

export default function handler(_req: unknown, res: Res) {
  res.status(200).json(health())
}
