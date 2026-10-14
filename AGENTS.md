# Notch

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Notch is a USDC clearing layer for agent micropayments supporting Arc Testnet and Arc mainnet. Agents open shared tabs, record hash-committed charges, close billing cycles into netted statements, and raise bonded disputes. Disputes are resolved by a Gemini-powered off-chain arbitrator relayer that fetches evidence, calls the Gemini API, and submits a ruling on-chain.

Testnet is the default. The header switcher follows the connected wallet's chain;
tabs and relayer dispute state are scoped to each network. Arc mainnet deployment
is pending, and the mainnet switcher option is disabled until `VITE_NOTCH_ADDRESS_ARC`
is configured. Set the matching relayer `NOTCH_CONTRACT_ADDRESS_ARC` after verifying
the deployment. The funding and deployment runbook is in
`docs/superpowers/plans/2026-10-13-arc-mainnet.md`, Task 6.

Mainnet has an owner-only bond editor in the Arbitrator view. It uses the existing
`setBondAmount(uint256)` function and accepts positive USDC amounts with up to six
decimal places. Changes apply to new disputes; existing disputes keep their recorded
bond. Dispute approvals read `bondAmount()` on the active chain, and the Gemini
relayer awards against each dispute's stored bond. There is no fixed frontend bond
constant. Choose a mainnet owner wallet that can be connected in the app.

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| Notch (current) | Arc Testnet | 0x53F07375799558592Ea90344d14495D007C30f97 | https://explorer.testnet.arc.io/address/0x53F07375799558592Ea90344d14495D007C30f97 |
| Notch (stale — upheld disputes didn't excuse the charge) | Arc Testnet | 0xeffe19557a9cac8bf25ef6d3f072481d46a0938a | https://explorer.testnet.arc.io/address/0xeffe19557a9cac8bf25ef6d3f072481d46a0938a |
| Notch (old, stale — missing getters) | Arc Testnet | 0x7c7cc8322ba3db93381823a9161e47a85d490fc8 | https://explorer.testnet.arc.io/address/0x7c7cc8322ba3db93381823a9161e47a85d490fc8 |

### Constructor args used
- USDC: 0x3600000000000000000000000000000000000000 (Arc Testnet native USDC)
- Arbitrator: 0x5B12Ce46C7194aD57d143bC22847224047b1Ef42 (platform deployer — replace with relayer wallet for production)
- Owner: 0x5B12Ce46C7194aD57d143bC22847224047b1Ef42
- Bond amount: 1_000_000 (1 USDC, 6 decimals)
- Dispute window: 3600 seconds

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chains: Arc Testnet (5042002, `arcTestnet`) and Arc mainnet (5042, `arc`), imported from `viem/chains`; selected with the header wallet-network switcher
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000 on both Arc networks); bond amount is read from the active contract (initial deployment example: 1 USDC)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)
- `src/components/BondSettings.tsx` - owner-only mainnet bond editor

## To Run

```bash
bun install
bun run dev
```
