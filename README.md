# Notch

**A USDC clearing layer for agent-to-agent micropayments on Arc Testnet and Arc mainnet.**

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
4. **Accept or dispute** — the payee accepts, or the payer disputes a charge by posting the **current on-chain USDC bond** with a claim (not delivered, off-spec, overcharged, duplicate, SLA breach).
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

## Networks

The header switcher changes the connected wallet's chain. Contract reads, writes,
receipts, explorer links, and dispute arbitration follow that network. Testnet
(5042002) is the default; tabs are stored separately for each network and wallet.
Existing tab IDs can be added with the dashboard's paste field on their original network.

Arc mainnet (5042) uses real USDC for dispute bonds and gas. The deployment example
starts with a 1 USDC bond, which the contract owner can change in the app.
Mainnet deployment is pending, so its switcher option stays disabled until
`VITE_NOTCH_ADDRESS_ARC` is set to a verified deployment address and the frontend
is rebuilt. Set the same address in the relayer's `NOTCH_CONTRACT_ADDRESS_ARC`.
`VITE_ARC_MAINNET_RPC_URL` and `ARC_MAINNET_RPC_URL` are optional RPC overrides for
the frontend and relayer, respectively.

An optional `mainnet.` hostname preselects mainnet when configured; a connected
wallet on a configured Arc chain always takes priority. See the
[deployment plan](docs/superpowers/plans/2026-10-13-arc-mainnet.md#task-6-deploy-to-arc-mainnet-and-document-it)
for funding, deployment, and verification steps.

### Mainnet bond settings

Once mainnet is deployed and configured, switch to Arc mainnet and connect the
contract owner's wallet. Open **Arbitrator → Mainnet dispute bond**, enter a positive
USDC amount with up to six decimal places, and confirm **Update bond amount** in
your wallet. The control uses the contract's existing owner-only `setBondAmount`.

Changes affect new disputes. Existing disputes keep their recorded bond, which the
Gemini relayer uses when awarding it. The dispute form reads the current bond from
the active network and rechecks it and your allowance before requesting a signature.
Approval is set to the exact bond, including lowering an older allowance, so a
bond increase while your wallet confirmation is open cannot collect extra USDC.

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
The mainnet constructor's `owner` must be a wallet you can connect in the app to
manage the bond; it may be different from the arbitrator.

### Contracts

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test
```

## Built with Arc Studio

Most of the scaffolding — the React/wagmi frontend, the Solidity contract, and the full deploy-and-fund pipeline (compile → deploy via Circle's Smart Contract Platform → faucet the deployer wallet → wire the live address into the app) — was generated with **Arc Studio**, Arc's app builder. The hand-written work went into the product logic: the dispute accounting, the cycle-close countdown UX, and hardening the Gemini relayer against rate limits.



