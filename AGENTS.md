# Notch

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Notch is a USDC clearing layer for agent micropayments supporting Arc Testnet and Arc mainnet. Agents open shared tabs, record hash-committed charges, close billing cycles into netted statements, and raise bonded disputes. Disputes are resolved by a Gemini-powered off-chain arbitrator relayer that fetches evidence, calls the Gemini API, and submits a ruling on-chain.

Testnet is the default. The header switcher follows the connected wallet's chain;
tabs and relayer dispute state are scoped to each network. Arc mainnet is deployed
at `0x385285f6161FB84eDb3C5354B0e3bB1D6b7683a3`. The mainnet switcher option is enabled
when `VITE_NOTCH_ADDRESS_ARC` is configured. Set the same address in the relayer's
`NOTCH_CONTRACT_ADDRESS_ARC`. The funding and deployment runbook is in
`docs/superpowers/plans/2026-10-13-arc-mainnet.md`, Task 6.

Relayer wallets are configured separately: `ARBITRATOR_PRIVATE_KEY` for testnet,
`ARBITRATOR_PRIVATE_KEY_ARC` for mainnet. Each key's public address must match its
chain's contract arbitrator and have USDC gas there. Mainnet never falls back to
the testnet key. Keys stay server-side without a `VITE_` prefix. Health reports
public addresses and missing/invalid variables per chain; its legacy top-level
`arbitrator` field refers to testnet. The previously verified local relayer address
belongs to the testnet configuration and does not determine the mainnet arbitrator.

Mainnet has an owner-only bond editor in the Arbitrator view. It uses the existing
`setBondAmount(uint256)` function and accepts positive USDC amounts with up to six
decimal places. Changes apply to new disputes; existing disputes keep their recorded
bond. Dispute approvals read `bondAmount()` on the active chain, and the Gemini
relayer awards against each dispute's stored bond. There is no fixed frontend bond
constant. Choose a mainnet owner wallet that can be connected in the app.

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| Notch (current) | Arc mainnet | 0x385285f6161FB84eDb3C5354B0e3bB1D6b7683a3 | https://explorer.arc.io/address/0x385285f6161FB84eDb3C5354B0e3bB1D6b7683a3 |
| Notch (current) | Arc Testnet | 0x53F07375799558592Ea90344d14495D007C30f97 | https://explorer.testnet.arc.io/address/0x53F07375799558592Ea90344d14495D007C30f97 |
| Notch (stale — upheld disputes didn't excuse the charge) | Arc Testnet | 0xeffe19557a9cac8bf25ef6d3f072481d46a0938a | https://explorer.testnet.arc.io/address/0xeffe19557a9cac8bf25ef6d3f072481d46a0938a |
| Notch (old, stale — missing getters) | Arc Testnet | 0x7c7cc8322ba3db93381823a9161e47a85d490fc8 | https://explorer.testnet.arc.io/address/0x7c7cc8322ba3db93381823a9161e47a85d490fc8 |

### Arc Testnet constructor args used
- USDC: 0x3600000000000000000000000000000000000000 (Arc Testnet native USDC)
- Arbitrator: 0x5B12Ce46C7194aD57d143bC22847224047b1Ef42 (platform deployer — replace with relayer wallet for production)
- Owner: 0x5B12Ce46C7194aD57d143bC22847224047b1Ef42
- Bond amount: 1_000_000 (1 USDC, 6 decimals)
- Dispute window: 3600 seconds

### Arc mainnet constructor args used

- USDC: 0x3600000000000000000000000000000000000000
- Arbitrator: 0x051Cf644B01DE23EbDca61E7DdBad6bEfdAFF0Df
- Owner: 0x051Cf644B01DE23EbDca61E7DdBad6bEfdAFF0Df
- Initial bond amount: 1_000_000 (1 USDC); current bond verified on 2026-10-14: 100_000 (0.1 USDC)
- Dispute window: 3600 seconds
- Deployment transaction: 0x3f3186b60831029f1862c67bcbe5c85e1b6f7e4c30acf7fc9f9beafb65d71361

The deployment receipt, constructor args, current getters, and live relayer health
were verified through read-only requests. A mainnet 0.1 USDC dispute, upheld ruling,
bond withdrawal, and settlement are confirmed on-chain. Remaining network and owner
wallet checks are pending. The app requires an allowance equal to the
current bond to cap spending if the owner changes it before filing; the contract
itself accepts any allowance at least as large as the bond.

Rabby's simulation service has a reproduced low-balance issue on Arc: at 20 gwei,
it effectively reserved 0.6 USDC before checking an ERC-20 transfer, despite a much
smaller supplied gas limit. Arc RPC accepted the same transfer. Keep over 1 USDC
as a practical workaround at current fees or test another wallet; this is not a
contract minimum. Details and verification are in the deployment plan and README.
The mainnet dispute form shows this Rabby tip before filing, explains that approval
does not add funds, and labels oversized-allowance resets with the exact bond amount.

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
