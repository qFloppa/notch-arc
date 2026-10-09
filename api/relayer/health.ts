/**
 * GET /api/relayer/health  (also /relayer/health via vercel.json rewrite)
 *
 * Confirms the function's env vars landed: the arbitrator address printed here must be
 * the contract's `arbitrator`, or every ruling reverts. The counters are per-instance
 * and reset on cold start — they are not a dispute history.
 */

import { arbitratorAddress, CONTRACT_ADDRESS, RPC_URL, processedDisputes, rulingLog } from '../../relayer/arbitrate'

type Res = { status(code: number): Res; json(body: unknown): void }

export default function handler(_req: unknown, res: Res) {
  res.status(200).json({
    status: 'ok',
    arbitrator: arbitratorAddress,
    contract: CONTRACT_ADDRESS,
    rpc: RPC_URL,
    processedThisInstance: processedDisputes.size,
    latestRulings: rulingLog.slice(-10),
  })
}
