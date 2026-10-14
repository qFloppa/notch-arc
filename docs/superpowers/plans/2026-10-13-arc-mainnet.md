# Arc Mainnet Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution method: NATIVE, chosen by the user on 2026-10-13.** Implement every task yourself in-session; do not dispatch per-task subagents. One fresh reviewer on the most capable model checks the whole branch at the end. Do not re-ask which execution method to use.
>
> **Status (2026-10-14): Tasks 1–5 are implemented on `arc-mainnet`.** Task 1 was committed by Claude; the remaining frontend and relayer work was continued by Codex. Task 6 funding and deployment remain operator work. Browser and wallet testing was deferred by the user on 2026-10-14.

**Goal:** Run Notch on Arc mainnet (chain 5042) alongside Arc Testnet, selected by an in-app network switcher that defaults to testnet.

**Architecture:** The connected wallet's chain *is* the network selection — there is no separate app-level "selected network" state, because such state can disagree with what the wallet signs and on mainnet that disagreement spends real USDC. A pure `resolveNetwork()` maps the wallet's chain to the active Notch deployment, falling back to testnet. The relayer gains a per-chain config map and receives a `chainId` with every dispute push.

**Tech Stack:** React 18, Vite 6, TypeScript, wagmi 2.19.5, viem 2.56.8, ConnectKit, Tailwind, Sonner, Bun, Foundry.

**Spec:** `docs/superpowers/specs/2026-10-12-arc-mainnet-design.md`

## Continuation and verification record (2026-10-14)

- Verified the inherited frontend migration and completed per-chain relayer routing,
  clients, dedupe, retry state, health output, both HTTP entry points, and env examples.
  Corrected the ignored local `relayer/.env` testnet address without committing secrets.
- Network/account changes remount the page state so old tabs, statements, forms, and
  transaction state cannot carry into another network. Receipt reads also specify chainId.
  The header switcher remains visible on small screens and reports failed wallet switches.
- Added regression checks for identical dispute IDs on different chains, failed push
  retries, missing/empty mainnet config, chain-specific relayer state, legacy requests
  without chainId, and invalid HTTP input. The frontend and API type checks and frontend
  lint pass. All six self-checks, including the existing Gemini retry check, and the
  production frontend build pass.
- The full `bun run check` is blocked by existing setup issues: its lint script uses
  shell syntax that this Windows Bun launcher rejects, and `scripts/compass-deploy.ts`
  imports the unavailable `@circlefin/compass-chains` package (npm returns 404). Direct
  `oxlint --type-aware src`, `oxlint .`, and a temporary TypeScript config including
  `src` and `api` pass; no fake types or exclusions were added to the project config.
- Local Vite serves HTTP 200. Relayer health lists both chains; missing mainnet config
  returns HTTP 502 with its env-var name, and chain 1 returns HTTP 400. Tests use fixtures
  and the HTTP smoke check uses an unreachable RPC URL, so no transactions were sent.
- Foundry 1.7.1 compiled with Solc 0.8.28 successfully. `forge test` reports **no tests
  found**: this checkout has no `contracts/test` files. Generated artifact changes were
  restored after the compile check.
- Browser runtime is unavailable in this session; the user chose to leave browser
  testing for later. Task 4 Step 3 and the wallet flows in Task 6 remain manual checks.
- README and AGENTS describe mainnet as pending. No deployment address was invented,
  no funds were moved, and no remote environment variables were changed.
- The required fresh reviewer found no Critical or Important migration issues and
  assessed Tasks 1–5 as ready to commit. Browser/wallet behavior and deployed-mainnet
  settlement/arbitration remain unverified, as recorded above.

### Bond configuration follow-up (2026-10-14)

- The user requested a modifiable mainnet bond and chose an owner-only control in
  the app. `BondSettings` appears in the mainnet Arbitrator view for the connected
  contract owner. It validates positive six-decimal USDC amounts and calls the
  existing `setBondAmount`; no Solidity changes or redeployment of testnet.
- Dispute forms read the current bond and allowance on the active network, recheck
  both before signing, and stop for review if the bond changed. Approval must equal
  the current bond, so an older larger allowance is lowered before filing. A bond
  increase during wallet confirmation cannot collect more through this app flow.
  Write and receipt failures are visible with transaction explorer links.
- Gemini receives each dispute's recorded bond and clamps claimant awards to that
  exact amount, including bonds above or below 1 USDC. Changing the global bond
  affects only new disputes.
- All ten self-checks pass: the six migration checks plus `src/bond.test.ts`,
  `src/components/BondSettings.test.ts`, `api/_lib/gemini.bond.test.ts`, and
  `api/_lib/arbitrate.bond.test.ts`. The rendering check uses real wagmi hooks and
  fixture wallet/query state without a browser. RPC and Gemini checks use mocks.
- Final production build, `oxlint --type-aware src`, `oxlint .`, the temporary
  `src`/`api` TypeScript check, and `git diff --check` pass. The previously recorded
  full-check blockers and deferred browser/wallet testing still apply. Mainnet
  deployment and actual owner transactions remain pending.
- Reviewer found no remaining material issues after verifying exact-allowance
  handling and visible wagmi receipt/write errors; the follow-up is ready to commit.

Current code checkpoints:

- [x] Task 1: network resolution and wagmi configuration
- [x] Task 2: chain-scoped tab storage
- [x] Task 3: frontend contract, explorer, and write-guard migration
- [x] Task 4: header network switcher implementation
- [x] Task 5: per-chain relayer configuration and routing
- [ ] Task 4 Step 3: connected-wallet/browser verification (deferred by user)
- [ ] Task 6: operator funding, deployment, configuration, and mainnet end-to-end checks

The step checkboxes below are the original handoff checklist and do not reconstruct
Claude's historical red-test checkpoints. This record captures the verified final state.

## Global Constraints

- Chain IDs: Arc Testnet `5042002` (`arcTestnet` from `viem/chains`), Arc mainnet `5042` (`arc` from `viem/chains`). Never hardcode the numbers where the viem export is available.
- **Naming hazard:** `mainnet` imported in `src/config.ts` is **Ethereum** (chain 1), present only for ENS resolution. Arc mainnet is `arc`. No identifier may use a bare "mainnet" to mean Arc — use `ARC_MAINNET_ID` / `arc`.
- USDC is at `0x3600000000000000000000000000000000000000` with `decimals() = 6` on **both** Arc networks. `USDC_ADDRESS` stays a single constant.
- **Updated by user request on 2026-10-14:** the mainnet bond is editable by the contract owner in the app. Read `bondAmount()` from the active contract for dispute approvals; arbitration uses the bond stored on each dispute. No fixed frontend bond constant or per-network bond map. The deployment example starts at 1 USDC.
- Testnet is the default network everywhere except the `mainnet.` hostname.
- Tests use no framework: `node:assert` + a `bun <file>` entry point, matching `api/_lib/gemini.retry.test.ts`.
- Verification commands: `bun run check` (lint + typecheck), `bun run typecheck`, `bun <testfile>`, `bun run contracts:test`.
- The Solidity contract is **not** modified by this plan.

## Deviation from the spec (approved in plan review)

The spec's §1 gives `useNotch()` an `isConfigured` flag. That flag is **vacuous**: `resolveNetwork()` only ever returns a chain that has a configured address (rule 1 requires one, rule 2 requires one, rule 3 is testnet which always has one). So the active network is always configured.

Replaced by a module-level `MAINNET_AVAILABLE` boolean, consumed only by the Header switcher to disable the mainnet segment pre-deploy. The upside: `contract.address` is always defined, so no non-null assertions or zero-address placeholders leak into the 8 call-site files.

Behaviour when the wallet is on Arc mainnet but `VITE_NOTCH_ADDRESS_ARC` is unset: resolution falls through to testnet, `isWalletOnNetwork` is false, and writes are blocked with "Switch to Arc Testnet first." Safe, and Task 1's test pins it.

## Review Focus

1. **Wallet on Arc mainnet with mainnet unconfigured** — must resolve to testnet and block writes, never read a nonexistent mainnet deployment. (Task 1)
2. **Relayer push with no `chainId`** (stale cached browser bundle) — must default to testnet, never to mainnet, or an old tab could spend the arbitrator's real USDC. (Task 5)
3. **Relayer push for a chain whose contract env var is unset** — must return a named configuration error, not a 500 and not a write against the other chain's address. (Task 5)
4. **Same disputeId pushed on both networks** — the frontend dedupe set and the relayer's `processedDisputes`/`retryAfter` must not collapse two different disputes into one. Pinned by the chain-keyed state in Task 5 Steps 5 and 7, and exercised by the two-network dispute in Task 6 Step 6; not unit-testable without a private key, so it is a required code-review point.
5. **Pre-existing un-namespaced `notch:tabs:<address>` localStorage keys** — must not be adopted into either network's tab list. (Task 2)

---

## File Structure

**Create:**
- `src/networks.ts` — active-network resolution, per-chain Notch addresses, `useNotch()` hook. One responsibility: "which Arc network, and where is Notch on it".
- `src/networks.test.ts` — resolution table + tab-store key derivation checks.
- `api/_lib/chains.ts` — relayer-side per-chain config map (chain object, RPC URL, contract address). Separate from `arbitrate.ts` so the resolution logic is importable by a test without constructing wallet clients.
- `api/_lib/chains.test.ts` — relayer chain resolution and rejection checks.

**Modify:**
- `src/config.ts` — add `arc` chain + transport + `VITE_ARC_MAINNET_RPC_URL` override.
- `src/notch-contract.ts` — delete `ARC_TESTNET_CHAIN_ID` and `NOTCH_CONTRACT`; thread `chainId` through `pushDispute` and the dedupe key.
- `src/tab-store.ts` — chainId-namespaced keys.
- `src/App.tsx`, `src/components/{Header,TabView,DisputePanel,ClaimCredit,OpenTabForm,RecordChargeForm,RulingAdmin}.tsx` — consume `useNotch()`.
- `api/_lib/arbitrate.ts` — per-chain clients, `processDispute(disputeId, chainId)`, per-chain `health()`.
- `api/relayer/dispute.ts`, `relayer/server.ts` — parse and forward `chainId`.
- `relayer/env.example`, `relayer/.env` — new vars; correct the stale `0xeffe…` address.
- `AGENTS.md`, `README.md` — document the mainnet deployment and the switcher.

---

### Task 1: Network resolution module

**Files:**
- Create: `src/networks.ts`
- Create: `src/networks.test.ts`
- Modify: `src/config.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks. Uses `requireChain` from `@/onchain-facts` (already exists, already knows chain 5042) and the Foundry artifact at `../contracts/out/Notch.sol/Notch.json`.
- Produces:
  - `ARC_TESTNET_ID: number` (5042002), `ARC_MAINNET_ID: number` (5042)
  - `MAINNET_AVAILABLE: boolean`
  - `NotchAddresses = Partial<Record<number, \`0x${string}\`>>`
  - `NOTCH_ADDRESSES: NotchAddresses`
  - `resolveNetwork(walletChainId: number | undefined, hostname: string, addresses?: NotchAddresses): number`
  - `useNotch(): { chainId: number; name: string; isTestnet: boolean; isWalletOnNetwork: boolean; contract: { address: \`0x${string}\`; abi: typeof artifact.abi; chainId: number } }`

Every later task spreads `notch.contract` into wagmi contract hooks. That object carries `address`, `abi`, **and** `chainId` together, so a call site cannot accidentally read one network's address on another network's transport.

- [ ] **Step 1: Write the failing test**

Create `src/networks.test.ts`:

```ts
/**
 * Self-check for active-network resolution. No framework — run it with:
 *   bun src/networks.test.ts
 * resolveNetwork is pure and takes the address map, so this needs no DOM, no
 * wallet, and no Vite env.
 */

import assert from 'node:assert'
import { resolveNetwork, ARC_TESTNET_ID, ARC_MAINNET_ID } from './networks'

const BOTH = {
  [ARC_TESTNET_ID]: '0x53F07375799558592Ea90344d14495D007C30f97',
  [ARC_MAINNET_ID]: '0x1111111111111111111111111111111111111111',
} as const
const TESTNET_ONLY = { [ARC_TESTNET_ID]: '0x53F07375799558592Ea90344d14495D007C30f97' } as const

// A wallet on a configured chain selects that chain.
assert.equal(resolveNetwork(ARC_TESTNET_ID, 'arc.notch.bond', BOTH), ARC_TESTNET_ID)
assert.equal(resolveNetwork(ARC_MAINNET_ID, 'arc.notch.bond', BOTH), ARC_MAINNET_ID)

// Disconnected, or on an unrelated chain (Ethereum, kept in config for ENS): testnet.
assert.equal(resolveNetwork(undefined, 'arc.notch.bond', BOTH), ARC_TESTNET_ID)
assert.equal(resolveNetwork(1, 'arc.notch.bond', BOTH), ARC_TESTNET_ID)

// REVIEW FOCUS 1: wallet on Arc mainnet while mainnet has no deployment.
// Must fall back to testnet rather than resolve to an address-less chain.
assert.equal(resolveNetwork(ARC_MAINNET_ID, 'arc.notch.bond', TESTNET_ONLY), ARC_TESTNET_ID)

// The mainnet. hostname preselects mainnet only when it is actually deployed.
assert.equal(resolveNetwork(undefined, 'mainnet.notch.bond', BOTH), ARC_MAINNET_ID)
assert.equal(resolveNetwork(undefined, 'mainnet.notch.bond', TESTNET_ONLY), ARC_TESTNET_ID)

// A connected wallet outranks the hostname — the wallet is what signs.
assert.equal(resolveNetwork(ARC_TESTNET_ID, 'mainnet.notch.bond', BOTH), ARC_TESTNET_ID)

// Resolution never returns a chain without an address.
for (const wallet of [undefined, 1, 999, ARC_TESTNET_ID, ARC_MAINNET_ID]) {
  for (const host of ['arc.notch.bond', 'mainnet.notch.bond', 'localhost']) {
    for (const map of [BOTH, TESTNET_ONLY]) {
      const resolved = resolveNetwork(wallet, host, map)
      assert.ok((map as Record<number, string>)[resolved], `unconfigured chain ${resolved}`)
    }
  }
}

console.log('networks: all assertions passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun src/networks.test.ts`
Expected: FAIL — `Cannot find module './networks'`.

- [ ] **Step 3: Write the implementation**

Create `src/networks.ts`:

```ts
/**
 * networks.ts — which Arc network is active, and where Notch lives on it.
 *
 * The connected wallet's chain IS the selection. A separate "selected network"
 * value could disagree with what the wallet actually signs, and on mainnet that
 * disagreement spends real USDC, so there is deliberately no such state.
 *
 * resolveNetwork() is pure and takes the address map, so it is checkable without a
 * DOM, a wallet, or Vite's env — see networks.test.ts.
 */

import { useAccount } from 'wagmi'
import { arc, arcTestnet } from 'viem/chains'
import { requireChain } from '@/onchain-facts'
import artifact from '../contracts/out/Notch.sol/Notch.json'

export const ARC_TESTNET_ID = arcTestnet.id
export const ARC_MAINNET_ID = arc.id

export type NotchAddresses = Partial<Record<number, `0x${string}`>>

/**
 * Deployed Notch per chain. Testnet has a literal fallback because it is long
 * deployed; mainnet is env-only and absent until the operator deploys it.
 * Must be VITE_-prefixed to reach the browser bundle; baked in at build time.
 */
export const NOTCH_ADDRESSES: NotchAddresses = {
  [ARC_TESTNET_ID]:
    (import.meta.env.VITE_NOTCH_ADDRESS_ARC_TESTNET as `0x${string}` | undefined) ??
    '0x53F07375799558592Ea90344d14495D007C30f97',
  [ARC_MAINNET_ID]: import.meta.env.VITE_NOTCH_ADDRESS_ARC as `0x${string}` | undefined,
}

/** Gates the switcher's mainnet segment — false until Notch is deployed to Arc mainnet. */
export const MAINNET_AVAILABLE = !!NOTCH_ADDRESSES[ARC_MAINNET_ID]

/**
 * The chainId whose Notch deployment the UI should read and write.
 *
 * Only ever returns a chain that HAS an address, so callers never handle
 * `undefined`. A wallet on Arc mainnet before the mainnet deploy therefore lands on
 * testnet, where `isWalletOnNetwork` is false and writes are blocked.
 */
export function resolveNetwork(
  walletChainId: number | undefined,
  hostname: string,
  addresses: NotchAddresses = NOTCH_ADDRESSES,
): number {
  if (walletChainId !== undefined && addresses[walletChainId]) return walletChainId
  if (hostname.startsWith('mainnet.') && addresses[ARC_MAINNET_ID]) return ARC_MAINNET_ID
  return ARC_TESTNET_ID
}

export function useNotch() {
  const { chainId: walletChainId } = useAccount()
  const chainId = resolveNetwork(walletChainId, window.location.hostname)
  // Non-null is sound: resolveNetwork only returns chains present in the map.
  const address = NOTCH_ADDRESSES[chainId]!
  return {
    chainId,
    name: requireChain(chainId).name,
    isTestnet: chainId === ARC_TESTNET_ID,
    isWalletOnNetwork: walletChainId === chainId,
    /** Spread into any wagmi contract hook — address, abi and chainId travel together. */
    contract: { address, abi: artifact.abi, chainId },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun src/networks.test.ts`
Expected: PASS — `networks: all assertions passed`.

- [ ] **Step 5: Add the `arc` chain to the wagmi config**

Replace the whole body of `src/config.ts` with:

```ts
/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Must be VITE_-prefixed to reach the browser bundle; baked in at build time.
const ARC_TESTNET_RPC_URL =
  import.meta.env.VITE_ARC_TESTNET_RPC_URL || arcTestnet.rpcUrls.default.http[0]
// Arc mainnet's default hosts answer unauthenticated, unlike testnet's — the
// override exists for parity and for swapping in a dedicated provider.
const ARC_MAINNET_RPC_URL =
  import.meta.env.VITE_ARC_MAINNET_RPC_URL || arc.rpcUrls.default.http[0]

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, ARC_TESTNET_RPC_URL)
registerChain(arc.id, ARC_MAINNET_RPC_URL)

export const config = createConfig({
  // arcTestnet first: wagmi's own default chain, and Notch's default network.
  // `mainnet` here is ETHEREUM, for ENS resolution only — Arc mainnet is `arc`.
  chains: [arcTestnet, arc, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(ARC_TESTNET_RPC_URL),
    [arc.id]: http(ARC_MAINNET_RPC_URL),
    [mainnet.id]: http(), // ENS resolution uses Ethereum mainnet
  },
})
```

- [ ] **Step 6: Verify lint and types**

Run: `bun run check`
Expected: exit 0. `src/networks.ts` is not yet consumed, so nothing else changes.

- [ ] **Step 7: Commit**

```bash
git add src/networks.ts src/networks.test.ts src/config.ts
git commit -m "Add Arc mainnet to wagmi config and network resolution module"
```

---

### Task 2: Namespace the tab store by chain

**Files:**
- Modify: `src/tab-store.ts`
- Modify: `src/networks.test.ts` (append)

**Interfaces:**
- Consumes: `ARC_TESTNET_ID`, `ARC_MAINNET_ID` from Task 1.
- Produces: `getStoredTabIds(chainId: number, address: string): \`0x${string}\`[]` and `addStoredTabId(chainId: number, address: string, tabId: \`0x${string}\`): void`. Both gain `chainId` as the **first** parameter. Task 3 updates the two call sites.

A tabId exists only on the chain whose contract minted it. Keyed by address alone, one wallet's testnet tabs render in the mainnet view, where `getTab` returns a zeroed struct for each — the dashboard fills with phantom tabs.

- [ ] **Step 1: Write the failing test**

Add the tab-store import to the **top** of `src/networks.test.ts`, beside the existing imports — ESM hoists imports, but oxlint's `import/first` rule flags one that appears after executable code:

```ts
import { getStoredTabIds, addStoredTabId } from './tab-store'
```

Then append to `src/networks.test.ts`, before the final `console.log`:

```ts
// ---- tab-store chain namespacing -------------------------------------------

// Minimal localStorage stand-in — bun has no DOM. Safe to install here rather
// than before the import: tab-store reads localStorage per call, not at load.
const store = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
}

const WALLET = '0xAbCdEf0000000000000000000000000000000001'
const TAB_A = '0xaa'.padEnd(66, 'a') as `0x${string}`
const TAB_B = '0xbb'.padEnd(66, 'b') as `0x${string}`

addStoredTabId(ARC_TESTNET_ID, WALLET, TAB_A)
addStoredTabId(ARC_MAINNET_ID, WALLET, TAB_B)

// One wallet, two chains, disjoint registries.
assert.deepEqual(getStoredTabIds(ARC_TESTNET_ID, WALLET), [TAB_A])
assert.deepEqual(getStoredTabIds(ARC_MAINNET_ID, WALLET), [TAB_B])

// Case-insensitive on the address, as before.
assert.deepEqual(getStoredTabIds(ARC_TESTNET_ID, WALLET.toLowerCase()), [TAB_A])

// REVIEW FOCUS 5: a pre-existing un-namespaced key is not adopted by either chain.
store.set(`notch:tabs:${WALLET.toLowerCase()}`, JSON.stringify(['0xdeadbeef']))
assert.deepEqual(getStoredTabIds(ARC_TESTNET_ID, WALLET), [TAB_A])
assert.deepEqual(getStoredTabIds(ARC_MAINNET_ID, WALLET), [TAB_B])

// Corrupt JSON still degrades to empty rather than throwing.
store.set(`notch:tabs:${ARC_TESTNET_ID}:${WALLET.toLowerCase()}`, '{not json')
assert.deepEqual(getStoredTabIds(ARC_TESTNET_ID, WALLET), [])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun src/networks.test.ts`
Expected: FAIL — `addStoredTabId` currently takes `(address, tabId)`, so the chainId is treated as the address and the assertions do not match.

- [ ] **Step 3: Write the implementation**

Replace the whole body of `src/tab-store.ts` with:

```ts
/**
 * tab-store.ts — localStorage-backed tab ID registry.
 * Neither Arc network's public RPC supports eth_getLogs, so we store tabIds
 * locally after each openTab transaction.
 *
 * Keyed by chainId as well as wallet: a tabId exists only on the chain whose
 * contract minted it, so sharing one registry across networks would render
 * testnet tabs in the mainnet view as zeroed phantom tabs.
 */

const KEY_PREFIX = 'notch:tabs:'

function storageKey(chainId: number, address: string): string {
  return `${KEY_PREFIX}${chainId}:${address.toLowerCase()}`
}

export function getStoredTabIds(chainId: number, address: string): `0x${string}`[] {
  try {
    const raw = localStorage.getItem(storageKey(chainId, address))
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return parsed.filter((id): id is `0x${string}` => typeof id === 'string' && id.startsWith('0x'))
  } catch {
    return []
  }
}

export function addStoredTabId(chainId: number, address: string, tabId: `0x${string}`): void {
  try {
    const existing = getStoredTabIds(chainId, address)
    if (!existing.includes(tabId)) {
      localStorage.setItem(storageKey(chainId, address), JSON.stringify([...existing, tabId]))
    }
  } catch {
    // localStorage unavailable — no-op
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun src/networks.test.ts`
Expected: PASS — `networks: all assertions passed`.

- [ ] **Step 5: Confirm the expected type errors appear at the call sites**

Run: `bun run typecheck`
Expected: FAIL with exactly two errors, both "Expected 3 arguments, but got 2" or similar, at `src/App.tsx:34` (`getStoredTabIds`) and wherever `addStoredTabId` is called. Task 3 fixes them.

Record the reported call sites — Task 3 must update every one.

- [ ] **Step 6: Commit**

```bash
git add src/tab-store.ts src/networks.test.ts
git commit -m "Namespace the tab store by chainId"
```

Note: typecheck is intentionally red at this commit; Task 3 closes it. If the executing workflow forbids a red commit, perform Tasks 2 and 3 as one commit.

---

### Task 3: Migrate the frontend off `ARC_TESTNET_CHAIN_ID`

**Files:**
- Modify: `src/notch-contract.ts` (delete lines 7-12 exports)
- Modify: `src/App.tsx`
- Modify: `src/components/ClaimCredit.tsx`
- Modify: `src/components/TabView.tsx`
- Modify: `src/components/DisputePanel.tsx`
- Modify: `src/components/OpenTabForm.tsx`
- Modify: `src/components/RecordChargeForm.tsx`
- Modify: `src/components/RulingAdmin.tsx`

`src/components/Header.tsx` is handled in Task 4.

**Interfaces:**
- Consumes: `useNotch()` from Task 1; the 3-argument tab-store functions from Task 2.
- Produces: no new exports. Removes `NOTCH_CONTRACT` and `ARC_TESTNET_CHAIN_ID` from `src/notch-contract.ts`.

This is one atomic task because `bun run typecheck` cannot pass partway through: the constant is deleted, so every remaining reference is a compile error. That is the safety net — a missed call site cannot silently read the wrong chain.

There are 48 references across 9 files. The transformation has exactly **three** shapes.

- [ ] **Step 1: Enumerate every call site**

Run:
```bash
grep -rn "ARC_TESTNET_CHAIN_ID\|NOTCH_CONTRACT" src --include=*.ts --include=*.tsx
```

Expected counts per file (from the spec's survey): `TabView.tsx` 19+15, `DisputePanel.tsx` 8+5, `ClaimCredit.tsx` 5+3, `OpenTabForm.tsx` 4+3, `RecordChargeForm.tsx` 4+2, `Header.tsx` 3, `App.tsx` 2+2, `RulingAdmin.tsx` 2+4, `notch-contract.ts` 1+1.

- [ ] **Step 2: Apply the three transformations in every file except `Header.tsx`**

**Shape A — contract hook arguments.** Two properties collapse into one spread:

```diff
-  const { data: creditRaw, refetch } = useReadContract({
-    ...NOTCH_CONTRACT,
-    functionName: 'getCredit',
-    args: [address ?? ZERO],
-    chainId: ARC_TESTNET_CHAIN_ID,
+  const { data: creditRaw, refetch } = useReadContract({
+    ...notch.contract,
+    functionName: 'getCredit',
+    args: [address ?? ZERO],
```

Applies to `useReadContract`, `useWriteContract().writeContract(...)`, `useSimulateContract`, and `client.readContract` calls. Where a call spread `NOTCH_CONTRACT` but passed **no** `chainId` (e.g. `src/App.tsx:43`, inside `client.readContract`), still switch to `...notch.contract` — the extra `chainId` is harmless there and keeps one idiom.

**Shape B — explorer URLs and other chainId arguments.**

```diff
-onClick: () => window.open(buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, tx), '_blank')
+onClick: () => window.open(buildTxExplorerUrl(notch.chainId, tx), '_blank')
```

Also `usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID })` → `usePublicClient({ chainId: notch.chainId })`.

**Shape C — the eight write guards.** Replace the constant comparison with the hook's flag, and name the resolved network in the message:

```diff
-if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
+if (!notch.isWalletOnNetwork) { toast.error(`Switch to ${notch.name} first.`); return }
```

Guard locations: `ClaimCredit.tsx:58`, `DisputePanel.tsx:227`, `DisputePanel.tsx:247`, `OpenTabForm.tsx:69`, `RecordChargeForm.tsx:64`, `TabView.tsx:450`, `TabView.tsx:533`, `TabView.tsx:548`, `TabView.tsx:565`.

In each file: add `import { useNotch } from '../networks'` (`'./networks'` in `App.tsx`), add `const notch = useNotch()` as the first hook in the component, and drop `ARC_TESTNET_CHAIN_ID` / `NOTCH_CONTRACT` from the `../notch-contract` import — keep the formatters and other named imports from it.

Where a component destructured `chainId` from `useAccount()` **only** for a guard, remove it from the destructuring to avoid an unused-variable lint error. `ClaimCredit.tsx:15` becomes `const { address } = useAccount()`.

Worked example — `src/components/ClaimCredit.tsx` in full after the change:

```tsx
import { useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'
import { formatUsdc } from '../notch-contract'
import { useNotch } from '../networks'
import { buildTxExplorerUrl } from '@/onchain-facts'

const ZERO = '0x0000000000000000000000000000000000000000' as const

/**
 * Global claimable-balance banner. Credits (won dispute bonds) are per-wallet, not
 * per-tab, so this lives above every view — the payee can claim without first finding
 * a tab they can see. Renders nothing when there's nothing to claim.
 */
export default function ClaimCredit() {
  const { address } = useAccount()
  const notch = useNotch()

  const { data: creditRaw, refetch } = useReadContract({
    ...notch.contract,
    functionName: 'getCredit',
    args: [address ?? ZERO],
    // ponytail: poll so a ruling that lands while the payee waits here shows up on its own.
    query: { enabled: !!address, refetchInterval: 10_000 },
  })
  const credit = (creditRaw as bigint | undefined) ?? 0n

  const { writeContract, data: tx, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: tx })

  useEffect(() => {
    if (isSuccess && tx) {
      toast.success('Claimed to your wallet', {
        action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(notch.chainId, tx), '_blank') },
      })
      void refetch()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, tx])

  if (!address || credit === 0n) return null

  return (
    <div
      className="mb-6 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ background: 'var(--surface)', border: '1px solid rgba(63,185,80,0.3)' }}
    >
      <div>
        <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--subtle)' }}>Claimable balance</p>
        <p className="display text-xl font-bold tabular" style={{ color: 'var(--success)' }}>
          {formatUsdc(credit)} <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>USDC</span>
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
          Won dispute bonds, held in the Notch contract. Claim to move them to your wallet.
        </p>
      </div>
      <button
        onClick={() => {
          if (!notch.isWalletOnNetwork) { toast.error(`Switch to ${notch.name} first.`); return }
          writeContract({ ...notch.contract, functionName: 'withdraw', args: [credit] })
        }}
        disabled={isPending || isConfirming}
        className="py-2.5 px-5 rounded-xl font-semibold text-sm disabled:opacity-40 shrink-0"
        style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid rgba(63,185,80,0.3)' }}
      >
        {isPending ? 'Confirm in wallet…' : isConfirming ? 'Claiming…' : `Claim ${formatUsdc(credit)} USDC`}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Update the two tab-store call sites and the network-named copy**

In `src/App.tsx`: `const client = usePublicClient({ chainId: notch.chainId })`, and `getStoredTabIds(notch.chainId, address)`. Add `notch.chainId` to the `useEffect` dependency array alongside `address`, `client`, `refreshToken` — switching networks must reload the tab list.

Find the `addStoredTabId` call (reported by Task 2 Step 5, in `OpenTabForm.tsx`) and pass `notch.chainId` first.

Replace the two network-named strings:
- `src/components/OpenTabForm.tsx:58` — `description: 'New clearing tab is live on Arc Testnet.'` → `` description: `New clearing tab is live on ${notch.name}.` ``
- `src/components/RulingAdmin.tsx:186` — `View on Arc Testnet Explorer` → `` {`View on ${notch.name} Explorer`} ``

`RulingAdmin.tsx`'s `DisputeCard` is a separate component from the one holding `tabIds`; call `useNotch()` inside each component that needs it rather than threading it through props.

- [ ] **Step 4: Delete the old exports**

In `src/notch-contract.ts`, delete lines 5-12 — the artifact import, the `NOTCH_CONTRACT` object, and `ARC_TESTNET_CHAIN_ID`. Keep `USDC_ADDRESS`, the status/claim types and labels, the formatters, and `pushDispute`. The 2026-10-14 bond follow-up also removes `BOND_AMOUNT` in favor of an on-chain read. Update the file's header comment, which currently names one testnet address, to say that per-network addresses now live in `networks.ts`.

- [ ] **Step 5: Verify nothing references the deleted exports**

Run:
```bash
grep -rn "ARC_TESTNET_CHAIN_ID\|NOTCH_CONTRACT" src --include=*.ts --include=*.tsx
```
Expected: only `src/components/Header.tsx` (3 hits), which Task 4 handles.

- [ ] **Step 6: Verify the only remaining type errors are in `Header.tsx`**

Run: `bun run typecheck`
Expected: FAIL, with every error confined to `src/components/Header.tsx` — it still imports the two deleted exports. Task 4 replaces that file wholesale and closes them.

Confirm no error points at any other file. An error elsewhere means a call site was missed in Step 2.

- [ ] **Step 7: Run the whole test suite**

Run: `bun src/networks.test.ts && bun api/_lib/gemini.retry.test.ts && bun run contracts:test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/notch-contract.ts src/App.tsx src/components
git commit -m "Resolve the active Arc network per call site instead of hardcoding testnet"
```

As in Task 2, typecheck is intentionally red at this commit — `Header.tsx` closes it in Task 4. If the executing workflow forbids a red commit, perform Tasks 3 and 4 as one commit.

---

### Task 4: Network switcher in the header

**Files:**
- Modify: `src/components/Header.tsx`

**Interfaces:**
- Consumes: `useNotch()`, `MAINNET_AVAILABLE`, `ARC_TESTNET_ID`, `ARC_MAINNET_ID` from Task 1.
- Produces: no exports.

`Header.tsx:30-35` is a static `Arc Testnet` pill and `:40-49` a conditional "Switch to Arc" button. They collapse into one segmented control. Mainnet is marked with `--danger` tokens — the same treatment the old wrong-chain warning used — so real money is never visually ambiguous.

- [ ] **Step 1: Write the implementation**

Replace the whole body of `src/components/Header.tsx` with:

```tsx
import { ConnectKitButton } from 'connectkit'
import { useSwitchChain } from 'wagmi'
import { useNotch, MAINNET_AVAILABLE, ARC_TESTNET_ID, ARC_MAINNET_ID } from '../networks'
import NotchLogo from './NotchLogo'

/**
 * The switcher drives the WALLET's chain, not a separate app-level selection —
 * see networks.ts. So the active segment always reflects what will actually sign.
 */
export default function Header() {
  const notch = useNotch()
  const { switchChain, isPending } = useSwitchChain()

  const segments = [
    { id: ARC_TESTNET_ID, label: 'Testnet', available: true },
    { id: ARC_MAINNET_ID, label: 'Mainnet', available: MAINNET_AVAILABLE },
  ]

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: 'rgba(13,17,23,0.85)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo — the notch tally-stick render at 28px, slightly rotated for character */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-11 flex items-center justify-center shrink-0">
            <NotchLogo width={22} height={44} rotate={-6} />
          </div>
          <span className="display font-semibold text-base" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Notch
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <div
            className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            {segments.map(({ id, label, available }) => {
              const active = notch.chainId === id
              const isMainnet = id === ARC_MAINNET_ID
              return (
                <button
                  key={id}
                  onClick={() => switchChain({ chainId: id })}
                  disabled={isPending || active || !available}
                  title={available ? undefined : 'Not deployed to Arc mainnet yet'}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md disabled:cursor-default"
                  style={{
                    background: active
                      ? isMainnet ? 'var(--danger-dim)' : 'var(--accent-dim)'
                      : 'transparent',
                    color: active
                      ? isMainnet ? 'var(--danger)' : 'var(--accent)'
                      : available ? 'var(--muted)' : 'var(--subtle)',
                    opacity: available ? 1 : 0.4,
                  }}
                >
                  {isPending && !active ? '…' : label}
                </button>
              )
            })}
          </div>

          {!notch.isWalletOnNetwork && (
            <button
              onClick={() => switchChain({ chainId: notch.chainId })}
              disabled={isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(248,81,73,0.25)' }}
            >
              {isPending ? 'Switching…' : `Switch to ${notch.name}`}
            </button>
          )}
          <ConnectKitButton />
        </div>
      </div>
    </header>
  )
}
```

The wrong-chain button is kept as well as the segmented control: a wallet sitting on Ethereum resolves to testnet, so the testnet segment looks active while the wallet cannot sign. `isWalletOnNetwork` is the honest signal, and the button is how the user fixes it.

- [ ] **Step 2: Verify lint and types**

Run: `bun run check`
Expected: exit 0, with no remaining references to the deleted constants anywhere in `src`.

- [ ] **Step 3: Confirm the app runs**

Run: `bun run dev`, open the app, connect a wallet.
Expected: the Testnet segment is active and the Mainnet segment is greyed with the "Not deployed to Arc mainnet yet" tooltip, because `VITE_NOTCH_ADDRESS_ARC` is unset. The existing testnet flows behave exactly as before. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.tsx
git commit -m "Add an Arc network switcher to the header"
```

---

### Task 5: Per-chain relayer configuration

**Files:**
- Create: `api/_lib/chains.ts`
- Create: `api/_lib/chains.test.ts`
- Modify: `api/_lib/arbitrate.ts`
- Modify: `api/relayer/dispute.ts`
- Modify: `relayer/server.ts`
- Modify: `src/notch-contract.ts` (`pushDispute`)
- Modify: `src/components/DisputePanel.tsx` and any other `pushDispute` caller
- Modify: `relayer/env.example`, `relayer/.env`

**Interfaces:**
- Consumes: `notch.chainId` from Task 1 at the `pushDispute` call sites.
- Produces:
  - `api/_lib/chains.ts`: `RELAYER_CHAINS: Record<number, { chain: Chain; rpcUrl: string; contract?: \`0x${string}\` }>`, `DEFAULT_RELAYER_CHAIN_ID: number`, `resolveRelayerChain(chainId: unknown): { ok: true; chainId: number } | { ok: false; error: string }`
  - `src/notch-contract.ts`: `pushDispute(disputeId: \`0x${string}\`, chainId: number): Promise<PushResult | null>`
  - `api/_lib/arbitrate.ts`: `processDispute(disputeId: \`0x${string}\`, chainId: number)`, `health()` unchanged in name but per-chain in shape

- [ ] **Step 1: Write the failing test**

Create `api/_lib/chains.test.ts`:

```ts
/**
 * Self-check for relayer chain resolution. No framework — run it with:
 *   bun api/_lib/chains.test.ts
 * These are the money-adjacent cases: an absent chainId must never mean mainnet.
 */

import assert from 'node:assert'
import { resolveRelayerChain, DEFAULT_RELAYER_CHAIN_ID, ARC_TESTNET_ID, ARC_MAINNET_ID } from './chains.js'

// REVIEW FOCUS 2: a stale browser bundle sends no chainId. Default to testnet —
// never to mainnet, where a ruling would spend the arbitrator's real USDC.
assert.equal(DEFAULT_RELAYER_CHAIN_ID, ARC_TESTNET_ID)
assert.deepEqual(resolveRelayerChain(undefined), { ok: true, chainId: ARC_TESTNET_ID })
assert.deepEqual(resolveRelayerChain(null), { ok: true, chainId: ARC_TESTNET_ID })

// Both Arc networks are accepted when named explicitly.
assert.deepEqual(resolveRelayerChain(ARC_TESTNET_ID), { ok: true, chainId: ARC_TESTNET_ID })
assert.deepEqual(resolveRelayerChain(ARC_MAINNET_ID), { ok: true, chainId: ARC_MAINNET_ID })

// A JSON body may carry the number as a string.
assert.deepEqual(resolveRelayerChain('5042'), { ok: true, chainId: ARC_MAINNET_ID })

// Anything else is rejected rather than silently coerced to a default.
for (const bad of [1, 999, 'abc', '', {}, [], true, Number.NaN]) {
  const r = resolveRelayerChain(bad)
  assert.equal(r.ok, false, `expected rejection for ${JSON.stringify(bad)}`)
}

console.log('chains: all assertions passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun api/_lib/chains.test.ts`
Expected: FAIL — `Cannot find module './chains.js'`.

- [ ] **Step 3: Write the implementation**

Create `api/_lib/chains.ts`:

```ts
/**
 * chains.ts — which Arc network a relayer request targets, and the per-chain config.
 *
 * Split out of arbitrate.ts so resolution is testable without building wallet
 * clients (which need a private key).
 *
 * Env, per chain. Testnet keeps its historical un-suffixed names for compatibility
 * with deploys that already set them.
 */

import { arc, arcTestnet } from 'viem/chains'
import type { Chain } from 'viem'

export const ARC_TESTNET_ID = arcTestnet.id
export const ARC_MAINNET_ID = arc.id

/**
 * A request that does not name a chain is treated as testnet. This is the safe
 * default on purpose: a cached browser bundle from before the mainnet launch sends
 * no chainId, and defaulting that to mainnet would spend real USDC on a ruling.
 */
export const DEFAULT_RELAYER_CHAIN_ID = ARC_TESTNET_ID

// The Arc Studio RPC proxy only ever covers testnet, and its token is a ~30min JWT.
function testnetRpc(): string {
  const explicit = process.env.ARC_TESTNET_RPC_URL
  if (explicit) return explicit
  const proxyBase = process.env.RPC_PROXY_BASE_URL
  const proxyToken = process.env.RPC_PROXY_TOKEN
  const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',')
  if (proxyBase && proxyToken && proxyChains.includes('Arc_Testnet')) {
    return `${proxyBase}/api/rpc/Arc_Testnet?_rpc_token=${proxyToken}`
  }
  return arcTestnet.rpcUrls.default.http[0]
}

export interface RelayerChain {
  chain: Chain
  rpcUrl: string
  contract?: `0x${string}`
  label: string
  /** Name of the env var that supplies `contract`, for error messages. */
  contractEnvVar: string
}

export const RELAYER_CHAINS: Record<number, RelayerChain> = {
  [ARC_TESTNET_ID]: {
    chain: arcTestnet,
    rpcUrl: testnetRpc(),
    contract: (process.env.VITE_NOTCH_CONTRACT_ADDRESS ??
      process.env.NOTCH_CONTRACT_ADDRESS) as `0x${string}` | undefined,
    label: 'Arc Testnet',
    contractEnvVar: 'NOTCH_CONTRACT_ADDRESS',
  },
  [ARC_MAINNET_ID]: {
    chain: arc,
    // Arc mainnet's default hosts answer unauthenticated — no proxy path needed.
    rpcUrl: process.env.ARC_MAINNET_RPC_URL || arc.rpcUrls.default.http[0],
    contract: process.env.NOTCH_CONTRACT_ADDRESS_ARC as `0x${string}` | undefined,
    label: 'Arc',
    contractEnvVar: 'NOTCH_CONTRACT_ADDRESS_ARC',
  },
}

export type ChainResolution =
  | { ok: true; chainId: number }
  | { ok: false; error: string }

/** Accepts a number or a numeric string; rejects anything not a known Arc network. */
export function resolveRelayerChain(chainId: unknown): ChainResolution {
  if (chainId === undefined || chainId === null) {
    return { ok: true, chainId: DEFAULT_RELAYER_CHAIN_ID }
  }
  const n =
    typeof chainId === 'number' ? chainId
    : typeof chainId === 'string' && /^\d+$/.test(chainId) ? Number(chainId)
    : Number.NaN
  if (!Number.isInteger(n) || !RELAYER_CHAINS[n]) {
    return { ok: false, error: `unsupported chainId: ${String(chainId)}` }
  }
  return { ok: true, chainId: n }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun api/_lib/chains.test.ts`
Expected: PASS — `chains: all assertions passed`.

- [ ] **Step 5: Make `arbitrate.ts` per-chain**

In `api/_lib/arbitrate.ts`:

Replace the imports and config block (lines 12-53) with:

```ts
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { judgeDispute, fetchEvidence } from './gemini.js'
import { RELAYER_CHAINS, ARC_TESTNET_ID, ARC_MAINNET_ID } from './chains.js'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const ARBITRATOR_PRIVATE_KEY = process.env.ARBITRATOR_PRIVATE_KEY

// Deliberately NOT thrown at module load. A serverless runtime reports a module-load
// throw as a bare FUNCTION_INVOCATION_FAILED 500 with no message, which makes a missing
// env var indistinguishable from a broken deploy. Report it per-request instead.
function missingConfig(chainId: number): string[] {
  const missing: string[] = []
  if (!GEMINI_API_KEY) missing.push('GEMINI_API_KEY')
  if (!ARBITRATOR_PRIVATE_KEY) missing.push('ARBITRATOR_PRIVATE_KEY')
  const cfg = RELAYER_CHAINS[chainId]
  if (!cfg?.contract) missing.push(cfg?.contractEnvVar ?? 'NOTCH_CONTRACT_ADDRESS')
  return missing
}
```

Delete the exported `CONTRACT_ADDRESS` and `RPC_URL` constants and the `buildRpcUrl` function — `chains.ts` owns both now.

Replace `buildClients`/`clients` (lines 117-133) with a per-chain cache:

```ts
// ---- Clients (lazy, per chain) ---------------------------------------------
// Built on first use, never at module load — privateKeyToAccount() throws on a missing
// or malformed key, and a load-time throw is the same opaque 500 as above.

function buildClients(chainId: number) {
  const { chain, rpcUrl } = RELAYER_CHAINS[chainId]
  const account = privateKeyToAccount(ARBITRATOR_PRIVATE_KEY as `0x${string}`)
  return {
    account,
    publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
    walletClient: createWalletClient({ account, chain, transport: http(rpcUrl) }),
  }
}

// Inferred, not annotated: an explicit ReturnType<typeof createWalletClient> erases the
// chain generic, and writeContract then demands an explicit `chain` arg.
const _clients = new Map<number, ReturnType<typeof buildClients>>()

function clients(chainId: number) {
  let c = _clients.get(chainId)
  if (!c) { c = buildClients(chainId); _clients.set(chainId, c) }
  return c
}

/** Arbitrator address, or null if the key isn't configured — never throws. */
export function arbitratorAddress(): string | null {
  try {
    return privateKeyToAccount(ARBITRATOR_PRIVATE_KEY as `0x${string}`).address
  } catch {
    return null
  }
}
```

Make `health()` report both chains:

```ts
export function health() {
  const chains = Object.entries(RELAYER_CHAINS).map(([id, cfg]) => ({
    chainId: Number(id),
    label: cfg.label,
    contract: cfg.contract ?? null,
    rpc: cfg.rpcUrl,
    missingEnv: missingConfig(Number(id)),
  }))
  return {
    status: chains.some(c => c.missingEnv.length === 0) ? 'ok' : 'misconfigured',
    arbitrator: arbitratorAddress(),
    chains,
    processedThisInstance: processedDisputes.size,
    latestRulings: rulingLog.slice(-10),
  }
}
```

Change `processDispute` to take a chainId, key its dedupe state per chain, and use the per-chain address:

```ts
export async function processDispute(
  disputeId: `0x${string}`,
  chainId: number,
): Promise<ProcessResult> {
  const missing = missingConfig(chainId)
  if (missing.length > 0) {
    return { ok: false, error: `relayer not configured for ${RELAYER_CHAINS[chainId].label} — missing env: ${missing.join(', ')}` }
  }
  // REVIEW FOCUS 4: the same disputeId can exist on both networks and mean two
  // different disputes, so every piece of dedupe state is keyed by chain too.
  const key = `${chainId}:${disputeId}`
  if (processedDisputes.has(key)) return { ok: true, skipped: 'already processed' }
  const backoff = retryAfter.get(key) ?? 0
  if (backoff > Date.now()) {
    return { ok: false, error: 'backing off', retryAfterMs: backoff - Date.now() }
  }
  processedDisputes.add(key)

  const contract = RELAYER_CHAINS[chainId].contract!
  console.log(`[relayer] Processing dispute ${disputeId} on ${RELAYER_CHAINS[chainId].label}`)

  const { publicClient, walletClient } = clients(chainId)
  // ... body unchanged, except:
  //   every `address: CONTRACT_ADDRESS!`  ->  `address: contract`
  //   every retryAfter.set(disputeId, …)  ->  retryAfter.set(key, …)
  //   every processedDisputes.delete(disputeId) -> processedDisputes.delete(key)
  //   the rulingLog.push gains `chainId`
}
```

Add `chainId: number` to the `rulingLog` element type at line 151.

- [ ] **Step 6: Forward the chainId through both relayer entry points**

In `api/relayer/dispute.ts`, after the disputeId validation:

```ts
  let body: { disputeId?: string; chainId?: unknown } = {}
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as typeof body
  } catch {
    res.status(400).json({ error: 'bad request' })
    return
  }

  const disputeId = body.disputeId
  if (!disputeId || !/^0x[0-9a-fA-F]{64}$/.test(disputeId)) {
    res.status(400).json({ error: 'invalid disputeId' })
    return
  }

  const chain = resolveRelayerChain(body.chainId)
  if (!chain.ok) {
    res.status(400).json({ error: chain.error })
    return
  }

  const result = await processDispute(disputeId as `0x${string}`, chain.chainId)
  res.status(result.ok ? 200 : 502).json(result)
```

Add `import { resolveRelayerChain } from '../_lib/chains.js'`.

In `relayer/server.ts`, apply the same change to the `POST /dispute` branch (read `chainId` from the parsed body, resolve it, 400 on rejection, pass it to `processDispute`), and replace the startup banner's `CONTRACT_ADDRESS` / `RPC_URL` lines — those exports are gone — with a per-chain listing:

```ts
import { processDispute, health, arbitratorAddress } from '../api/_lib/arbitrate.js'
import { RELAYER_CHAINS } from '../api/_lib/chains.js'

// ... at the bottom:
console.log(`[relayer] Notch arbitrator relayer starting`)
console.log(`[relayer] Arbitrator: ${arbitratorAddress() ?? '(key not configured)'}`)
for (const cfg of Object.values(RELAYER_CHAINS)) {
  console.log(`[relayer] ${cfg.label}: ${cfg.contract ?? '(not configured)'} via ${cfg.rpcUrl}`)
}
console.log(`[relayer] Status:     http://localhost:${PORT}/health`)
```

- [ ] **Step 7: Send the chainId from the frontend**

In `src/notch-contract.ts`, make `pushDispute` chain-aware:

```ts
export async function pushDispute(
  disputeId: `0x${string}`,
  chainId: number,
): Promise<PushResult | null> {
  // Keyed by chain: the same disputeId on two networks is two different disputes.
  const key = `${chainId}:${disputeId}`
  if (pushedDisputes.has(key)) return null   // in flight or already done this load
  pushedDisputes.add(key)
  console.log('[notch] Pushing disputeId to relayer:', disputeId, 'chain', chainId)
  try {
    const res = await fetch('/relayer/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disputeId, chainId }),
    })
    const data = await res.json() as PushResult
    console.log('[notch] Relayer response:', data)
    if (!data.ok) pushedDisputes.delete(key)   // allow a later poll to retry
    return data
  } catch (e) {
    pushedDisputes.delete(key)                 // network failure — let a later poll retry
    console.warn('[notch] Relayer push failed:', e)
    return { ok: false, error: 'relayer unreachable' }
  }
}
```

Find every caller and pass `notch.chainId`:

```bash
grep -rn "pushDispute" src --include=*.tsx --include=*.ts
```

- [ ] **Step 8: Update the relayer env files**

Append to `relayer/env.example`:

```
# Notch contract address on Arc mainnet (chain 5042). Absent until deployed — the
# relayer then rejects mainnet disputes with a named config error rather than a 500.
NOTCH_CONTRACT_ADDRESS_ARC=

# Arc mainnet RPC. Optional: the viem defaults answer unauthenticated, unlike testnet.
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
```

In `relayer/.env`, correct the stale testnet address — it currently points
`VITE_NOTCH_CONTRACT_ADDRESS` at `0xeffe19557a9cac8bf25ef6d3f072481d46a0938a`, a
superseded deployment, while the frontend uses `0x53F0…`:

```
NOTCH_CONTRACT_ADDRESS=0x53F07375799558592Ea90344d14495D007C30f97
```

Remove the `VITE_NOTCH_CONTRACT_ADDRESS` line — a `VITE_`-prefixed secret-adjacent
var in the relayer's env is a footgun, and `chains.ts` reads the un-prefixed name.

- [ ] **Step 9: Run every check**

```bash
bun api/_lib/chains.test.ts
bun src/networks.test.ts
bun api/_lib/gemini.retry.test.ts
bun run check
```
Expected: all pass, exit 0.

- [ ] **Step 10: Verify the relayer reports both chains**

Run `cd relayer && bun run dev` (or `bun server.ts`), then `curl -s localhost:3001/health | head -40`.
Expected: a `chains` array with two entries. Arc Testnet has a contract and empty `missingEnv`; Arc has `contract: null` and `missingEnv: ["NOTCH_CONTRACT_ADDRESS_ARC"]`. Stop the server.

- [ ] **Step 11: Verify a mainnet push is rejected cleanly, not with a 500**

With the relayer still running:
```bash
curl -s -X POST localhost:3001/dispute -H 'content-type: application/json' \
  -d '{"disputeId":"0x0000000000000000000000000000000000000000000000000000000000000001","chainId":5042}'
```
Expected (REVIEW FOCUS 3): HTTP 502 with
`relayer not configured for Arc — missing env: NOTCH_CONTRACT_ADDRESS_ARC`. Not a
500, and no write attempted.

```bash
curl -s -X POST localhost:3001/dispute -H 'content-type: application/json' \
  -d '{"disputeId":"0x0000000000000000000000000000000000000000000000000000000000000001","chainId":1}'
```
Expected: HTTP 400 `unsupported chainId: 1`.

- [ ] **Step 12: Commit**

```bash
git add api/_lib/chains.ts api/_lib/chains.test.ts api/_lib/arbitrate.ts \
        api/relayer/dispute.ts relayer/server.ts relayer/env.example relayer/.env \
        src/notch-contract.ts src/components
git commit -m "Give the relayer per-chain config and route disputes by chainId"
```

---

### Task 6: Deploy to Arc mainnet and document it

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `VITE_NOTCH_ADDRESS_ARC` (Task 1), `NOTCH_CONTRACT_ADDRESS_ARC` (Task 5).
- Produces: a deployed mainnet contract address.

**Steps 1-4 are operator actions requiring real funds and cannot be completed by an
agent.** An agent executing this plan should stop at Step 1, report that the
remaining work is blocked on funding, and leave the code tasks complete — the app
ships and runs on testnet with the mainnet segment disabled until these are done.

- [ ] **Step 1: Fund two wallets with real USDC on Arc mainnet**

Arc's native gas currency is USDC at 18 decimals; the ERC-20 at
`0x3600000000000000000000000000000000000000` is 6 decimals. Fund:

- the **deployer** — enough for one contract creation;
- the **arbitrator** (the wallet behind `ARBITRATOR_PRIVATE_KEY`; the locally
  configured public address verified on 2026-10-14 is
  `0xE849DDC0fa5b31b7aAEB4a9186DB96A144Cf9Cf2`) — enough for ongoing `submitRuling`
  transactions. Easy to forget, and without it a mainnet dispute sits `Pending`
  with no visible error.

The deployer and arbitrator may be the same wallet. Choose `OWNER_ADDRESS` as a
wallet you can connect in the app; it needs USDC gas for bond updates. Recheck the
arbitrator address against the actual relayer key before deployment. The old
platform deployer in the testnet constructor is not the currently configured relayer.

Verify: `cast balance <addr> --rpc-url https://rpc.mainnet.arc.io`

- [ ] **Step 2: Deploy Notch to Arc mainnet**

```bash
forge create contracts/Notch.sol:Notch \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args \
    0x3600000000000000000000000000000000000000 \
    $ARBITRATOR_ADDRESS \
    $OWNER_ADDRESS \
    1000000 \
    3600
```

Set `ARBITRATOR_ADDRESS` to the public address of the relayer wallet and
`OWNER_ADDRESS` to the wallet that will manage bond settings. Args in order: USDC,
arbitrator, owner, initial bond amount (the example uses 1 USDC at 6 decimals),
dispute window in seconds. The owner can change the bond later in the app.

CREATE2 is deliberately not used: `contracts/script/DeployCreate2.s.sol` could give
one address on both chains, but only if testnet were also redeployed through the
factory, discarding the live demo state to save one map entry.

- [ ] **Step 3: Verify the deployment before pointing anything at it**

```bash
cast call <DEPLOYED> "arbitrator()(address)" --rpc-url https://rpc.mainnet.arc.io
cast call <DEPLOYED> "owner()(address)" --rpc-url https://rpc.mainnet.arc.io
cast call <DEPLOYED> "bondAmount()(uint256)" --rpc-url https://rpc.mainnet.arc.io
cast call <DEPLOYED> "usdc()(address)" --rpc-url https://rpc.mainnet.arc.io
```
Expected: the arbitrator wallet, the chosen owner wallet, `1000000` (or the selected
initial bond), and `0x3600…0000`. A wrong arbitrator
means the relayer can never submit a ruling.

- [ ] **Step 4: Set the environment variables**

In Vercel project settings:
- `VITE_NOTCH_ADDRESS_ARC` = the deployed address (build-time, frontend — triggers a rebuild)
- `NOTCH_CONTRACT_ADDRESS_ARC` = the same address (runtime, relayer function)

Optionally point `mainnet.notch.bond` at the same deployment to preselect mainnet.

- [ ] **Step 5: Document the deployment**

In `AGENTS.md`, add the mainnet row to the deployed-contracts table:

```
| Notch (Arc mainnet) | Arc | <DEPLOYED> | https://explorer.arc.io/address/<DEPLOYED> |
```

Add an "Arc mainnet constructor args" block mirroring the existing testnet one, and
update the Tech Stack line from `Chain: Arc Testnet (Chain ID: 5042002...)` to name
both networks and the switcher.

In `README.md`, update the subtitle — currently "**A USDC clearing layer for
agent-to-agent micropayments on Arc Testnet.**" — to cover both networks, and add a
short "Networks" section noting that the header switcher drives the wallet's chain,
testnet is the default, and mainnet moves real USDC.

- [ ] **Step 6: Verify the full mainnet path end to end**

1. Switch to Mainnet in the header; confirm the segment is enabled and marked.
2. Confirm the dashboard is empty — proves the tab store is namespaced.
3. Open a tab, record a small charge, close the cycle, accept, settle.
4. Open one dispute; confirm the Gemini ruling lands on the mainnet contract.
5. Confirm explorer links resolve to `explorer.arc.io`, not the testnet explorer.
6. Switch back to Testnet; confirm the original testnet tabs are still listed.
7. On mainnet, connect the contract owner and open Arbitrator → Mainnet dispute
   bond. Verify a non-owner cannot see the editor, zero and excess decimal places
   cannot be submitted, and a valid update confirms and refreshes the current bond.
8. Open disputes with bonds below and above 1 USDC; verify exact approvals and
   correct Gemini awards. Change the global bond while an older dispute is pending;
   verify that older dispute retains its original bond. Change the bond between
   approval and filing; verify the displayed amount is refreshed and requires review.

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md README.md
git commit -m "Document the Arc mainnet deployment"
```
