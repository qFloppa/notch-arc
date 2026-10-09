/**
 * gemini.ts — Gemini judge for Notch disputes
 *
 * Takes structured dispute context (claim kind, claim text, agreed service terms from memo,
 * evidence content) and returns a validated ruling.
 */

export type Outcome = 'upheld' | 'adjusted' | 'rejected'

export interface DisputeContext {
  claimKind: string
  claim: string
  memo: string          // agreed service description from the line item
  evidenceUri: string
  evidenceContent: string | null  // fetched text content of evidence, or null if unreachable
  chargeAmount: bigint  // original item amount in USDC 6-decimal units
}

export interface Ruling {
  outcome: Outcome
  revisedItemAmount: bigint  // in USDC 6-decimal units; equals chargeAmount for upheld/rejected
  claimantBondAward: bigint  // how much of the 1 USDC bond to award the claimant
  evidenceHashMatched: boolean
  rationale: string
}

const VALID_OUTCOMES: Outcome[] = ['upheld', 'adjusted', 'rejected']

// Free-tier request quota is per-project-PER-MODEL, so switching model gets a fresh
// daily bucket when one is exhausted. Override with GEMINI_MODEL in relayer/.env.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'

const SYSTEM_PROMPT = `You are a neutral payment arbitrator for agent-to-agent service charges.
You will receive a dispute filed by a service payer against a charge. Your job is to evaluate the
dispute fairly and return a structured JSON ruling.

Rules:
- "upheld": the payer's claim is valid — the service was not delivered or was materially off-spec.
- "adjusted": the service was partially delivered — the charge should be reduced.
- "rejected": the payer's claim has no merit — the charge stands as billed.
- Be conservative: only uphold or adjust if there is clear evidence that the service failed to meet the agreed terms.
- If evidence is unreachable or missing, you may still rule based on the claim alone, but note this.

Always respond with ONLY valid JSON matching this schema:
{
  "outcome": "upheld" | "adjusted" | "rejected",
  "revisedItemAmountUsdc": number,  // float, e.g. 0.50 — must be <= original charge; use original if upheld/rejected
  "claimantBondAwardUsdc": number,  // float — how much of the 1 USDC bond goes to claimant (0 to 1.0)
  "evidenceHashMatched": boolean,
  "rationale": string  // 1-3 sentence explanation
}`

export async function judgeDispute(ctx: DisputeContext, geminiApiKey: string): Promise<Ruling> {
  const userMessage = `
Dispute Details:
- Claim kind: ${ctx.claimKind}
- Payer's claim: ${ctx.claim}
- Agreed service (memo): ${ctx.memo}
- Original charge: ${(Number(ctx.chargeAmount) / 1_000_000).toFixed(6)} USDC
- Evidence URI: ${ctx.evidenceUri || '(none provided)'}
- Evidence content: ${ctx.evidenceContent ? ctx.evidenceContent.slice(0, 3000) : '(unreachable or not provided)'}

Return a JSON ruling.`

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      // Gemini 3.x are thinking models and thinking tokens count against
      // maxOutputTokens — with a small budget the JSON gets truncated mid-key.
      // This is a short structured classification, so skip thinking entirely.
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 2048,
    },
  })

  // 503 (model overloaded) and 500 are transient — Gemini recommends an immediate
  // retry. Retry in-call so one dispute POST still returns the real ruling instead of
  // failing and leaving the frontend to re-push minutes later. ponytail: fixed 4
  // attempts / ~7s total; good enough, raise the schedule if overloads get longer.
  const RETRY_DELAYS_MS = [1000, 2000, 4000]
  let response: Response
  let attempt = 0
  for (;;) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    )
    if (response.ok) break
    if ((response.status === 503 || response.status === 500) && attempt < RETRY_DELAYS_MS.length) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      attempt++
      continue
    }
    break
  }

  if (!response.ok) {
    const errText = await response.text()
    const err = new Error(`Gemini API error ${response.status}: ${errText}`)
    if (response.status === 429) {
      // Gemini returns RetryInfo.retryDelay as e.g. "44040s" — honour it so we
      // don't hammer an exhausted quota every poll.
      const m = errText.match(/"retryDelay":\s*"(\d+)(?:\.\d+)?s"/)
      ;(err as Error & { retryAfterMs?: number }).retryAfterMs = m ? Number(m[1]) * 1000 : 300_000
    }
    throw err
  }

  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> }; finishReason?: string }>
  }
  const finishReason = data.candidates?.[0]?.finishReason
  if (finishReason && finishReason !== 'STOP') {
    throw new Error(`Gemini stopped early (finishReason=${finishReason}) — ruling JSON incomplete`)
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')

  let parsed: {
    outcome: string
    revisedItemAmountUsdc: number
    claimantBondAwardUsdc: number
    evidenceHashMatched: boolean
    rationale: string
  }

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Failed to parse Gemini JSON: ${text}`)
  }

  // Validate outcome
  if (!VALID_OUTCOMES.includes(parsed.outcome as Outcome)) {
    throw new Error(`Invalid outcome from Gemini: ${parsed.outcome}`)
  }
  const outcome = parsed.outcome as Outcome

  // Clamp and convert amounts
  const chargeUsdc = Number(ctx.chargeAmount) / 1_000_000
  const revisedUsdc = Math.min(Math.max(0, parsed.revisedItemAmountUsdc ?? chargeUsdc), chargeUsdc)
  const bondUsdc = Math.min(Math.max(0, parsed.claimantBondAwardUsdc ?? 0), 1.0)

  const revisedItemAmount = BigInt(Math.round(revisedUsdc * 1_000_000))
  const claimantBondAward = BigInt(Math.round(bondUsdc * 1_000_000))

  return {
    outcome,
    revisedItemAmount,
    claimantBondAward,
    evidenceHashMatched: Boolean(parsed.evidenceHashMatched),
    rationale: String(parsed.rationale ?? '').slice(0, 1000),
  }
}

export async function fetchEvidence(uri: string): Promise<string | null> {
  if (!uri || uri.startsWith('ipfs://')) return null  // IPFS not fetched in relayer for now
  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const text = await res.text()
    return text.slice(0, 5000)  // cap evidence size
  } catch {
    return null
  }
}
