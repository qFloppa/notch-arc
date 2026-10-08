# Implementation Plan: Notch on Arc

## Summary
A USDC clearing contract for agent-to-agent micropayments on Arc Testnet. Agents accumulate hash-committed charges on a shared tab, close cycles into netted statements, and raise bonded disputes that a trusted off-chain relayer resolves.

## Architecture

- **Blockchain:** Arc Testnet — USDC as gas, EVM-compatible, sub-second finality
- **Contract:** `Notch.sol` — single contract managing tabs, line items, statements, and disputes. Core functions: `openTab`, `recordCharge`, `closeCycle`, `acceptStatement`, `openDispute`, `submitRuling`, `withdraw`
- **Dispute model:** Off-chain relayer server (Express/Node.js) holds an `ARBITRATOR_PRIVATE_KEY` and a `GEMINI_API_KEY`. When a dispute is opened on-chain, the relayer fetches the evidence URI, sends evidence + claim + agreed terms to Gemini, parses a structured verdict (outcome, adjustedAmount, rationale), then signs and submits `submitRuling(...)` to the contract on behalf of the arbitrator address.
- **Frontend:** React + Tailwind dashboard with ConnectKit wallet connection. Two surfaces: (1) agent-facing — open tabs, record charges, close cycles; (2) inspector — browse tabs, view statements, file disputes, read rulings
- **Wallet:** ConnectKit (browser wallet for humans; contract ABI callable directly by agents via RPC)

## Files to Create / Modify

1. `contracts/Notch.sol` — full clearing contract: tabs, line items, statements, disputes, bond logic, ruling, withdrawal
2. `contracts/test/Notch.t.sol` — Foundry unit tests covering the happy path and dispute lifecycle
3. `src/config.ts` — add Arc Testnet chain + deployed contract address (already exists, extend it)
4. `src/components/TabView.tsx` — tab detail: charge list, cycle summary, statement hash verification
5. `src/components/OpenTabForm.tsx` — form to open a new tab (payer + payee addresses, cycle seconds)
6. `src/components/RecordChargeForm.tsx` — form / agent endpoint to post a charge (memo, amount, evidence URI + hash)
7. `src/components/CycleDashboard.tsx` — list open tabs, close a cycle, compute + verify statement hash client-side
8. `src/components/DisputePanel.tsx` — file a dispute (bond, claim kind, claim text), view ruling outcome
9. `src/components/RulingAdmin.tsx` — read-only panel showing pending disputes and their Gemini rulings once submitted
10. `relayer/server.ts` — Express server; polls or listens for `DisputeOpened` events, fetches evidence URI, calls Gemini API with structured prompt (claim kind, terms, evidence text), parses verdict, submits `submitRuling` on-chain using arbitrator key
11. `relayer/gemini.ts` — Gemini API client: structured prompt construction, response parsing, outcome validation (must be one of `upheld / adjusted / rejected`, amount clamped to original charge)
12. `relayer/.env.example` — documents `GEMINI_API_KEY`, `ARBITRATOR_PRIVATE_KEY`, `NOTCH_CONTRACT_ADDRESS`, `ARC_TESTNET_RPC_URL`
13. `src/App.tsx` — route between dashboard, tab detail, and admin panel (extend existing file)

## Build Sequence

1. Write `Notch.sol` — data structures (Tab, LineItem, Statement, Dispute), all state-changing functions, USDC bond handling, dispute window, arbitrator role
2. Audit + unit tests — balanced preset; fix any critical/high findings before deploy
3. Deploy to Arc Testnet — platform deployer, record contract address in `.env` and `src/config.ts`
4. Build dashboard UI — `CycleDashboard`, `TabView`, `OpenTabForm`, `RecordChargeForm`
5. Build dispute UI — `DisputePanel`, `RulingAdmin`
6. Build relayer — `relayer/server.ts` event listener, `relayer/gemini.ts` judge logic, env wiring
7. Wire `App.tsx` routing and ConnectKit wallet connection

## Done When

- [ ] A tab can be opened between two addresses and charges recorded on-chain
- [ ] Closing a cycle emits a statement; the browser independently recomputes the statement hash and it matches storage
- [ ] A bonded dispute can be filed against a statement charge
- [ ] The arbitrator address can submit a ruling; bond credit is settled accordingly
- [ ] `withdraw()` pays out settled credit to the winner
- [ ] All Foundry unit tests pass
- [ ] The app runs on Arc Testnet with a ConnectKit-connected wallet
- [ ] The relayer detects a `DisputeOpened` event, calls Gemini, and submits a ruling on-chain without human intervention
- [ ] Gemini verdict is constrained: outcome is one of `upheld / adjusted / rejected`, adjusted amount never exceeds the original charge
