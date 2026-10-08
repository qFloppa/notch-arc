# Notch

**By Rat3dRR + Claude.** [Live app](https://www.notch.bond) | [Specification](docs/spec.md)

Notch is a shared bill for AI agents. Many small service charges become one
verifiable statement. When a buyer disputes a delivery, GenLayer validators
compare the agreed terms with the receipt and record a binding contract outcome.
Neither the buyer, seller, nor the website decides the dispute alone.

## Required Studio Next Deployment

The live app calls **Studio Next / Studio-dev, chain ID 61997**, through
`https://studio-dev.genlayer.com/api` using the SDK's `studioDevnet` preset.

- Contract: [`0xbedf544340c72383d16C2eE6bcA180a6A6C25C29`](https://explorer-studio-dev.genlayer.com/address/0xbedf544340c72383d16C2eE6bcA180a6A6C25C29)
- Deployment: [`0x049ca081167554b36e28a0c570869c7cc99169c28ac0617e2a6956e74a235cec`](https://explorer-studio-dev.genlayer.com/tx/0x049ca081167554b36e28a0c570869c7cc99169c28ac0617e2a6956e74a235cec)
- Read-back configuration: 1 GEN dispute bond, 3,600-second dispute window,
  10 USDC base credit at atto scale.

Older StudioNet and Bradbury deployments are historical and do not satisfy the
Studio Next requirement. The Python `deploy/` and `agents/` scripts target those
older networks; the supported submission reproduction path is the viewer below.

## Review In A Few Minutes

Open [notch.bond](https://www.notch.bond). No wallet or model API key is needed.
Two server-held demo accounts sign real Studio Next transactions. These are
testnet billing records, not USDC transfers or production escrow.

1. Select **Open a demo tab**. It records two delivered calls and one off-spec call.
2. Close the cycle and recompute its statement hash. The browser independently
   rebuilds the bill's fingerprint and compares it with contract storage.
3. Select the receipt ending in `-n2`, keep the off-spec claim, and file a dispute.
4. Ask the validators for a ruling. Consensus can take several minutes. Inspect
   the outcome, rationale, evidence hash match, disputed amount, and bond credit.
5. Bill another off-spec call and repeat in the next cycle. Rulings become shared
   case history; later judgments can cite relevant cases.

The app displays its contract and deployment links, full transaction hashes,
execution status, and explorer links. Your transaction log persists in your
browser; the tab ID is in the URL. The **Verified example** also exposes a fixed
set of successful transaction links for reviewers on a fresh browser.

For immediate inspection, open the [completed demo](https://www.notch.bond/?tab=dmu4qe73g22di).
On September 16, 2026 (UTC), all six writes executed successfully. The statement
hash was independently verified, the evidence hash matched, and validators
**upheld** the off-spec claim with zero owed for the disputed call. The contract
stored the rationale, settled the bond credit, and indexed the precedent.
[Ruling transaction](https://explorer-studio-dev.genlayer.com/tx/0x2c11a1e821c52484027d2000d0fd39e4f83e93d4fe4ec9a72e30ca897a74ad2d).

## Why Decentralized Judgment Matters

A receipt can be authentic but still describe failed work. A hash establishes
that the evidence was not changed; it cannot decide whether an upstream timeout
met a promise to return extracted line items. The contract's leader evaluates
the evidence and terms, while validators independently evaluate the claim and
check agreement on the outcome, amount, integrity result, and allowed citations.

Use **Billed, but off spec** to exercise this model path. The swapped-evidence
example deliberately resolves through an integrity check without consulting a
model. An unreachable receipt can also bypass model judgment; inspect
`evidence_hash_matched`, not just the word `upheld`.

## What Is Implemented

- Persistent tabs, immutable charges, netted statements, and independently
  reproducible statement hashes.
- Disputes restricted to the payer, valid statement charges, the dispute window,
  and a sufficient native GEN bond; duplicate disputes and resolutions are refused.
- Evidence hashing, structured verdict validation, bounded adjusted amounts,
  validated precedent citations, and consensus comparison.
- Stored rulings, bond credits, shared precedent indexes, settlement records,
  and credit history. The hosted viewer exposes the billing/dispute flow;
  withdrawal and settlement are separate contract methods.
- A relayer with a closed operation set, fixed demo identities and amounts,
  receipt execution checks, read caching, and transaction tracking.

These are implemented in [contracts/notch.py](contracts/notch.py) and
[viewer/lib/ops.ts](viewer/lib/ops.ts), beyond a generated contract or UI scaffold.

## Reproduce Locally

Use Node.js **22.18+** (or 24+) and npm. TypeScript tools rely on Node's native
type stripping. From a fresh clone:

```bash
git clone https://github.com/Rat3dRR/notch.git
cd notch/viewer
npm ci
node tools/init-demo.mjs
npm test
npm run build
npm run dev
```

Open `http://localhost:3000`. The init tool creates the repository `.env` with
two fresh throwaway private keys and the public Studio Next address. It refuses
to overwrite an existing `.env`. Keys stay server-side and are gitignored.
The Studio faucet RPC funds the demo accounts as needed for fees and bonds.

To deploy your own copy, from `viewer/`:

```bash
node tools/deploy-studio.mjs --deploy
```

It checks chain ID, funds the demo accounts, estimates fees, submits the full
contract, checks execution success, and reads back constructor values. Put the
printed `STUDIO_NEXT_ADDRESS` and `STUDIO_NEXT_DEPLOY_TX` into the repository
`.env`, then restart the viewer. A printed transaction hash can be passed instead
of `--deploy` to resume verification without submitting another contract.

Run the same public API flow as the app, including a real model judgment:

```bash
# From viewer/. This writes testnet state and prints each explorer link.
node --dns-result-order=ipv4first tools/verify-live.mjs https://www.notch.bond
# Or target your locally running viewer:
node tools/verify-live.mjs http://localhost:3000
```

The script fails if execution fails, the statement hash differs, the evidence
does not match, the ruling is missing, or the precedent was not persisted.

## Contract Tests

Use Python 3.12 in a virtual environment and install `requirements.txt`.
From the repository root, with that environment activated:

```bash
pip install -r requirements.txt
genvm-lint check contracts/notch.py
python -m pytest tests/direct -q
```

On Windows, set `$env:PYTHONIOENCODING='utf-8'` first. The first run downloads
the GenVM runner bundle; it needs network access and disk space. Direct tests
mock model and web responses; the live verification above tests real consensus.

## Deploy The Viewer

In Vercel, set Root Directory to `viewer` and Framework Preset to Next.js.
Configure `SELLER_KEY`, `BUYER_KEY`, `STUDIO_NEXT_ADDRESS`, and
`STUDIO_NEXT_DEPLOY_TX`, then deploy. With the project linked locally, run
`vercel --prod` **from the repository root**, since Vercel applies `viewer` itself.
Do not upload `.env` or set a model API key or `BRADBURY_KEY` in Vercel.

## Demo Boundaries

One dispute is allowed per statement. Bond credit requires a separate withdrawal;
the viewer does not withdraw funds. Credit is derived from settlement history
and is not an enforced spending cap. Demo accounts are shared by public visitors,
and the hosted network can throttle requests or delay consensus.

Evidence URLs are pinned to a public Git commit. The `evidence-fixtures-v1` tag
keeps that original commit reachable when author identities are corrected. Do
not delete it or make the repository private: previously billed evidence URLs
are immutable on chain.
