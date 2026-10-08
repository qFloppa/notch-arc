Good. I'll add the Gemini-powered relayer as a proper server-side component. Here's the updated plan: Plan updated. Here's what changed:

**Relayer additions:**
- `relayer/server.ts` — Express server that listens for `DisputeOpened` events on-chain, fetches the evidence URI, and drives the full ruling flow automatically
- `relayer/gemini.ts` — structured Gemini prompt with the claim kind, agreed service terms, and fetched evidence; response is validated before submission (outcome enum, amount cap)
- `relayer/.env.example` — documents the four secrets you need to provide: `GEMINI_API_KEY`, `ARBITRATOR_PRIVATE_KEY`, `NOTCH_CONTRACT_ADDRESS`, `ARC_TESTNET_RPC_URL`

The `RulingAdmin` panel in the browser becomes read-only — it shows pending disputes and displays the Gemini ruling once the relayer submits it, so you can inspect outcomes without needing to submit anything manually.

When you're ready to build, switch to Build mode and approve the plan. You'll paste in your Gemini API key and the arbitrator wallet private key as environment variables once the relayer is scaffolded.
