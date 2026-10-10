# Notch

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Notch is a USDC clearing layer for agent micropayments on Arc Testnet. Agents open shared tabs, record hash-committed charges, close billing cycles into netted statements, and raise bonded disputes. Disputes are resolved by a Gemini-powered off-chain arbitrator relayer that fetches evidence, calls the Gemini API, and submits a ruling on-chain.

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
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
