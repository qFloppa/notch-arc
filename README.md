# Notch

**A USDC clearing layer for agent-to-agent micropayments on Arc Testnet.**

🔗 Live demo: https://arc.notch.bond

Notch lets autonomous agents run a shared tab, accumulate hash-committed micro-charges, net them into a single statement per billing cycle, and settle once in USDC. Any charge can be contested with a bonded dispute that an AI arbitrator rules on — on-chain.

## Origin

Notch began as a top-10 pitch at the **GenLayer Agent Tank Hackathon**. The first version ran on **GenLayer's GenVM**, where dispute arbitration lived *inside* the intelligent contract and the verdict came from GenVM's nondeterministic LLM consensus (a leader proposes a ruling, validators agree on it).

This repo is the **Arc** rebuild of the same idea: pure-USDC settlement on Arc Testnet, with the AI decision-making moved to an off-chain **Gemini** relayer that commits each ruling back on-chain. Most of it was scaffolded and deployed with **Arc Studio**.

## The problem

Agents are starting to pay other agents constantly — a fraction of a cent per API call, summary, or lookup. Settling each of those on-chain is impractical (gas, latency, a wallet prompt per $0.005), and there's no automated, provable way for an agent to say "you billed me but didn't deliver."

Notch addresses both:

- **Netting** — charges accumulate on a tab and clear once per cycle, not per call.
- **Disputes** — every charge commits a keccak256 hash of its evidence receipt, so a contested charge is adjudicated against tamper-proof evidence by an AI arbitrator.

## How it works

1. **Open a tab** between a payer and a payee with a cycle length.
2. **Record charges** — amount, memo (the agreed service), and an evidence URI whose keccak256 hash is committed on-chain.
3. **Close the cycle** (only once the cycle window has elapsed) → a **statement** with the netted total and a hash of all line items.
4. **Accept or dispute** — the payee accepts, or the payer disputes a charge by posting a **1 USDC bond** with a claim (not delivered, off-spec, overcharged, duplicate, SLA breach).
5. **Arbitrate** — the Gemini relayer fetches the evidence, checks the hash, and submits a ruling on-chain: `upheld` (charge excused), `adjusted` (charge reduced), or `rejected` (charge stands). The bond is credited to whoever was right.
6. **Settle** — the payer approves USDC and pays the net amount to the payee.

The dispute **bond** and the **bill** are independent: a won bond is credited back as a claimable balance you can withdraw at any time, separate from settling the statement.

## Architecture

- **Contract** — `contracts/Notch.sol`, Solidity `^0.8.20`, built with Foundry. Holds tabs, line items, statements, disputes and bond credits. MIT-licensed.
- **Frontend** — `src/`, React 18 + Vite + TypeScript, wagmi v2 / viem, ConnectKit, Tailwind, Sonner.
- **Relayer** — `relayer/` (local Bun server) and `api/` (Vercel Function); the frontend reaches it at `/relayer/*`. It does no log scanning: the frontend pushes a disputeId, the relayer reads the chain, calls Gemini, and submits the ruling.

## Deployed contract (Arc Testnet)

| | |
|---|---|
| Contract | `0x53F07375799558592Ea90344d14495D007C30f97` |
| Explorer | https://explorer.testnet.arc.io/address/0x53F07375799558592Ea90344d14495D007C30f97 |
| Chain ID | 5042002 |
| USDC | `0x3600000000000000000000000000000000000000` (6 decimals, native gas asset) |
| Bond | 1 USDC |
| Dispute window | 3600 s |

> An earlier deployment (`0xeffe…0938a`) is stale — on it a won dispute refunded the bond but didn't excuse the charge. Use the address above.

## Running locally

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev        # Vite dev server
```

### Relayer (required for disputes to resolve)

The arbitrator is a separate process — `bun run dev` does **not** start it, so without it disputes stay open forever.

```bash
cd relayer
cp env.example .env   # GEMINI_API_KEY, ARBITRATOR_PRIVATE_KEY, NOTCH_CONTRACT_ADDRESS, ARC_TESTNET_RPC_URL
bun install
bun run dev           # :3001 — the Vite dev server proxies /relayer → :3001
```

The `ARBITRATOR_PRIVATE_KEY` wallet must be the contract's `arbitrator`, or `submitRuling` reverts.

### Contracts

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test
```

## Built with Arc Studio

Most of the scaffolding — the React/wagmi frontend, the Solidity contract, and the full deploy-and-fund pipeline (compile → deploy via Circle's Smart Contract Platform → faucet the deployer wallet → wire the live address into the app) — was generated with **Arc Studio**, Arc's app builder. The hand-written work went into the product logic: the dispute accounting, the cycle-close countdown UX, and hardening the Gemini relayer against rate limits.



