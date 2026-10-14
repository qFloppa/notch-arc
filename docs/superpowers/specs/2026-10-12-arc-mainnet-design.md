# Arc Mainnet Support for Notch — Design

Date: 2026-10-12
Status: approved design, not yet planned or implemented

## Intent

Run Notch on Arc mainnet (chain 5042) alongside the existing Arc Testnet
deployment, as a **showcase with small real USDC amounts** where the operator
controls most or all participants. Blast radius is the operator's own funds.

Stated by the user:

- Mainnet showcase, small real amounts — not a third-party production launch.
- Both networks live at once, selected by an **in-app network switcher**.
- **Testnet is the switcher default.**
- A single arbitrator wallet signs rulings on both networks.
- A `mainnet.` subdomain was floated as a possibility.

Assumptions made here, not stated by the user:

- The `mainnet.notch.bond` subdomain becomes an optional deep link that
  preselects mainnet, not a separate build. The switcher makes a second build
  unnecessary.
- Updated on 2026-10-14: the mainnet owner can edit the dispute bond in the app (see Deploy Runbook).
- No migration of existing `localStorage` tab registries.

## Success criteria

1. A visitor on `arc.notch.bond` lands on Arc Testnet and sees today's
   behaviour, unchanged.
2. The switcher moves the wallet to Arc mainnet, and every read, write,
   explorer link, and dispute push follows it.
3. Testnet tabs never appear in the mainnet view, or vice versa.
4. A mainnet dispute is arbitrated by the existing Gemini relayer and the
   ruling lands on the mainnet contract.
5. The UI can never present one network's chrome while the wallet signs on
   another.
6. Before the mainnet contract is deployed, the mainnet option is visibly
   unavailable rather than broken.

## Verified facts

Probed 2026-10-12 against Arc mainnet:

| Fact | Value |
|---|---|
| Chain ID | 5042 (`0x13b2`), live, head ≈ 25.5M |
| RPC hosts answering `eth_chainId` unauthenticated | `rpc.mainnet.arc.io`, `rpc.blockdaemon.mainnet.arc.io`, `rpc.drpc.mainnet.arc.io`, `rpc.quicknode.mainnet.arc.io` |
| USDC token | `0x3600000000000000000000000000000000000000` — `decimals() = 6`, `symbol() = "USDC"`, **byte-identical to testnet** |
| Multicall3 | deployed at canonical `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Native gas currency | USDC, 18 decimals |
| Explorer | `https://explorer.arc.io` |

Mainnet RPC needs no proxy token, unlike testnet (where viem's default host is
Cloudflare-blocked and the Arc Studio proxy token is a ~30 minute JWT). An
override env var is still provided, but the defaults work.

`viem/chains` already exports `arc` (5042). `src/onchain-facts.ts` already
carries the chain 5042 entry.

## Current state

Testnet is hardcoded in 9 files — 48 references to `ARC_TESTNET_CHAIN_ID`:

| File | refs |
|---|---|
| `src/components/TabView.tsx` | 19 |
| `src/components/DisputePanel.tsx` | 8 |
| `src/components/ClaimCredit.tsx` | 5 |
| `src/components/OpenTabForm.tsx` | 4 |
| `src/components/RecordChargeForm.tsx` | 4 |
| `src/components/Header.tsx` | 3 |
| `src/App.tsx` | 2 |
| `src/components/RulingAdmin.tsx` | 2 |
| `src/notch-contract.ts` | 1 (the declaration) |

Eight of those are write guards with the literal string
`'Switch to Arc Testnet first.'`.

Two pieces of existing work this design reuses rather than rebuilds:

- **`src/onchain-facts.ts` is already chainId-parameterized.** `getChain`,
  `getUsdc`, `buildTxExplorerUrl`, and `buildAddressExplorerUrl` all take a
  chainId and already know chain 5042. Explorer links and USDC lookups need no
  new code; call sites stop passing a constant.
- **`src/components/Header.tsx:40-49` already has a `useSwitchChain`-backed
  button** with `isPending` handling. The switcher extends this, it is not new
  UI from scratch.

## Design

### 1. Network resolution — no new app state

New `src/networks.ts`:

- `NOTCH_ADDRESSES: Record<number, Address | undefined>` mapping
  `arcTestnet.id` → the current `0x53F0…` literal (env-overridable) and
  `arc.id` → `import.meta.env.VITE_NOTCH_ADDRESS_ARC`.
- `resolveNetwork(walletChainId: number | undefined, hostname: string)` — a
  **pure function**, taking hostname rather than reading `location` at module
  scope, so the unit check can exercise it without a DOM.
- `useNotch()`, a thin hook wrapping it, returning
  `{ chainId, address, abi, isConfigured, isWalletOnNetwork, isTestnet }`.

Resolution rule, in order:

1. If `walletChainId` has a **configured** address in `NOTCH_ADDRESSES`, that
   is the active network.
2. Otherwise, if `hostname` starts with `mainnet.` and `arc.id` is configured,
   the active network is Arc mainnet.
3. Otherwise, Arc Testnet.

So disconnected visitors, and visitors whose wallet sits on Ethereum (chain 1,
present in config only for ENS), browse testnet — satisfying "testnet is the
default".

The two returned booleans are distinct and both load-bearing:

- `isConfigured` — the active network has a Notch address. False only for Arc
  mainnet before deployment.
- `isWalletOnNetwork` — `walletChainId === chainId`. This is what the eight
  write guards check; by the resolution rule it is false exactly when the
  wallet sits on an unsupported chain. Its toast names the resolved network to
  switch to.

Reads use the resolved chainId and work via the configured transport regardless
of where the wallet sits, so read-only browsing of either network never
requires a switch.

Call sites change from `{ ...NOTCH_CONTRACT, chainId: ARC_TESTNET_CHAIN_ID }`
to `{ ...notch }`. `ARC_TESTNET_CHAIN_ID` and `NOTCH_CONTRACT` are **deleted**
from `src/notch-contract.ts`, which keeps its formatters, status labels, claim
kinds, `USDC_ADDRESS`, and `pushDispute`. The bond follow-up reads `bondAmount()`
from the active contract instead of keeping a fixed `BOND_AMOUNT` constant.

The ABI stays a single import — one contract source, two deployments.

**Why the wallet's chain is the selection, rather than separate app state:** a
standalone "selected network" value can drift out of sync with what the wallet
actually signs. On mainnet that drift spends real USDC. One source of truth
makes criterion 5 unrepresentable rather than merely tested.

### 2. wagmi config

`src/config.ts` adds `arc` to `chains` and a matching transport, with a
`VITE_ARC_MAINNET_RPC_URL` override mirroring the `VITE_ARC_TESTNET_RPC_URL`
override added in `dcf6f77`. Chain order stays `[arcTestnet, arc, mainnet]` so
wagmi's own default chain is testnet.

Naming hazard to respect: `mainnet` imported in that file is **Ethereum**, kept
only for ENS resolution. Arc mainnet is `arc`. No identifier in the codebase
should use a bare "mainnet" to mean Arc.

### 3. Switcher UI

`Header.tsx`: the static `Arc Testnet` pill (line 30-35) and the conditional
`wrongChain` button (line 40-49) collapse into one segmented two-button
control calling `switchChain({ chainId })`, preserving the existing `isPending`
treatment.

- Injected wallets receive `wallet_addEthereumChain` automatically from viem's
  `arc` definition, so no manual network-add instructions are needed.
- When `VITE_NOTCH_ADDRESS_ARC` is unset, the mainnet segment renders disabled
  with a "not deployed yet" title. This satisfies criterion 6 and lets the
  whole plumbing ship and merge before the contract exists or the deployer is
  funded.
- Arc mainnet carries persistent visual marking (existing `--danger` /
  `--accent` tokens) so "which money is real" is never ambiguous.
- The eight write guards stop comparing against a constant and name the
  resolved network in their toast, replacing the hardcoded
  `'Switch to Arc Testnet first.'`.

`RulingAdmin.tsx:186`'s literal `View on Arc Testnet Explorer` and
`OpenTabForm.tsx:58`'s `'New clearing tab is live on Arc Testnet.'` become
network-aware via the same resolved network name.

### 4. tab-store namespacing

`src/tab-store.ts:9-11` keys on `notch:tabs:<address>`. One wallet across two
chains means testnet tabIds render in the mainnet view as nonexistent tabs —
`getTab` reverts or returns zeroes for every one of them.

`getStoredTabIds` and `addStoredTabId` take a `chainId` first argument; the key
becomes `notch:tabs:<chainId>:<address>`. Existing keys go unread. No
migration: this is a showcase, and silently adopting testnet tabIds into
mainnet is the exact bug being fixed.

The module's doc comment, which currently explains the store in terms of Arc
Testnet's missing `eth_getLogs`, is updated — the constraint applies to both
Arc networks.

### 5. Relayer

`api/_lib/arbitrate.ts` currently imports `arcTestnet` (line 14) and resolves a
single contract address (lines 21-24) and RPC URL (lines 41-51).

- Replace both with a per-chainId map: chain object, RPC URL, contract address.
- `pushDispute(disputeId)` in `src/notch-contract.ts:70` becomes
  `pushDispute(disputeId, chainId)`; the POST body becomes
  `{ disputeId, chainId }`.
- A **missing** `chainId` defaults to testnet, so a stale cached browser bundle
  cannot silently trigger arbitration against mainnet funds. An
  **unrecognized** `chainId` is rejected with a clear 400.
- `missingConfig()` reports per-network, so a mainnet dispute arriving without
  mainnet config returns a named error rather than a bare 500.

New env vars: `NOTCH_CONTRACT_ADDRESS_ARC`, and optional `ARC_MAINNET_RPC_URL`.
Existing testnet vars keep working. One `ARBITRATOR_PRIVATE_KEY` signs both, as
chosen.

The in-flight dedupe set at `src/notch-contract.ts:54` is keyed by disputeId
alone. DisputeIds are per-contract and will not collide across networks in
practice, but the key becomes `${chainId}:${disputeId}` anyway — it is free and
removes the question.

Side benefit: per-chain explicit addresses remove the current footgun where
`relayer/.env` points `VITE_NOTCH_CONTRACT_ADDRESS` at the stale `0xeffe…`
contract while the frontend uses `0x53F0…`. That stale value is also corrected
as part of this work.

### 6. Deploy runbook

Ordered, because the deployer is currently unfunded:

1. Acquire real USDC on Arc mainnet for the deployer and the arbitrator wallet.
   Gas is native USDC at 18 decimals; the ERC-20 at `0x3600…0000` is 6
   decimals. Both wallets need gas; the arbitrator needs it to submit rulings.
2. `forge create contracts/Notch.sol:Notch --rpc-url https://rpc.mainnet.arc.io`
   with constructor args: USDC `0x3600000000000000000000000000000000000000`,
   arbitrator = the relayer wallet, owner = same, bond amount, dispute window.
3. Set `VITE_NOTCH_ADDRESS_ARC` (build-time, frontend) and
   `NOTCH_CONTRACT_ADDRESS_ARC` (runtime, relayer function) in Vercel.
4. Record the address and constructor args in `AGENTS.md`'s deployed-contracts
   table alongside the testnet entries.

**CREATE2 is deliberately skipped.** `contracts/script/DeployCreate2.s.sol` and
`Create2Factory.sol` exist and could yield one shared address across both
chains — all five constructor args happen to be identical, since USDC sits at
the same address and the arbitrator and owner are the same wallet. But that
only works if testnet is *also* redeployed through the factory, and the live
`0x53F0…` was not. Redeploying testnet would discard existing demo state to
save one map entry.

**Bond sizing — updated by user request on 2026-10-14.** The deployment example
starts at 1 USDC, and the mainnet contract owner can change it through the app's
Arbitrator view using the existing `setBondAmount` function. Only positive amounts
with up to six decimal places are accepted. The dispute form reads the active
contract's current bond and rechecks it and the allowance before signing. Changes
apply to new disputes; arbitration uses the bond recorded on each existing dispute.
The frontend has no fixed bond constant or per-network bond map.

## Testing

The contract is unchanged, so `contracts/test/*.t.sol` continues to cover its
logic and needs no additions.

The primary safety net is `bun run typecheck`. Because `ARC_TESTNET_CHAIN_ID`
and `NOTCH_CONTRACT` are **deleted** rather than deprecated, any one of the 48
call sites that is missed fails to compile. A silent wrong-chain read is not
reachable through an incomplete migration.

A unit check covers the two pieces of non-trivial new logic, which are both
pure and both have a money-adjacent failure mode:

- `resolveNetwork()` in `src/networks.ts`: a wallet on a configured chain wins;
  a wallet on an unconfigured chain falls back to testnet; a `mainnet.`
  hostname preselects mainnet only when a mainnet address is configured; an
  unset mainnet address leaves mainnet unconfigured. Pure, so no DOM needed.
- `src/tab-store.ts` key derivation: two chainIds with one address yield
  disjoint registries.

Manual verification, in order:

1. Full testnet flow on `arc.notch.bond` — unchanged behaviour (criterion 1).
2. Switch to mainnet; confirm the tab list is empty (criterion 3).
3. One small real tab through record → close cycle → accept → settle.
4. One small real dispute, confirming the Gemini ruling lands on the mainnet
   contract (criterion 4).
5. Confirm explorer links from the mainnet view resolve to `explorer.arc.io`,
   not the testnet explorer.

## Non-goals

- Cross-chain tabs, cross-chain netting, CCTP, or any bridging.
- Per-network arbitrator keys (one wallet, as chosen).
- A CREATE2 shared contract address.
- Migration of existing `localStorage` tab registries.
- A separate mainnet build or second Vercel project.
- Third-party production readiness: no audit, no arbitrator key hardening, no
  bond economics review. This is a controlled showcase, and that framing is
  load-bearing for every risk decision above.

## Files touched

New:

- `src/networks.ts`
- a unit check for network resolution and tab-store keys

Modified:

- `src/config.ts` — add `arc` chain + transport + RPC override
- `src/notch-contract.ts` — delete `ARC_TESTNET_CHAIN_ID` / `NOTCH_CONTRACT`,
  thread chainId through `pushDispute` and the dedupe key
- `src/tab-store.ts` — chainId-namespaced keys
- `src/App.tsx`, `src/components/Header.tsx`, `TabView.tsx`,
  `DisputePanel.tsx`, `ClaimCredit.tsx`, `OpenTabForm.tsx`,
  `RecordChargeForm.tsx`, `RulingAdmin.tsx` — resolved network instead of the
  constant
- `api/_lib/arbitrate.ts` — per-chain config map
- `relayer/env.example`, `relayer/.env` — new vars, stale address corrected
- `AGENTS.md`, `README.md` — mainnet deployment documented
