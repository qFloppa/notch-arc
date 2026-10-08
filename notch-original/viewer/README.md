# viewer

The hosted app at [notch.bond](https://www.notch.bond). A visitor with no wallet and no tokens drives the whole loop:
open a tab, accrue notches, close a statement, **recompute its hash in the
browser**, file a dispute, read the verdict and the case law it cited.

The production viewer uses Studio Next / Studio-dev (chain ID 61997). Writes go
through a server-side relayer that signs as the two demo agents. The visitor
connects nothing. The app displays the deployed contract, deployment transaction,
and every transaction hash as direct Studio Next explorer links.

## Run it

```bash
npm ci
node tools/init-demo.mjs # fresh checkout only; refuses to overwrite ../.env
npm test          # the preimage rebuild, pinned to a Python-generated fixture
npm run typecheck
npm run build
npm run dev       # http://localhost:3000
```

Keys come from the repo's `.env` (one level up) when running locally, and from
the project environment on Vercel. Four are needed — `STUDIO_NEXT_ADDRESS`,
`STUDIO_NEXT_DEPLOY_TX`, `SELLER_KEY`, and `BUYER_KEY` — and `BRADBURY_KEY` is deliberately **not** one of
them: it holds real faucet GEN and never leaves `.env`.

## Shape

| path | what it is |
|---|---|
| `app/page.tsx` | all five screens, one page, revealed in sequence |
| `app/api/act` | the relayer. Submits and returns a hash; never blocks |
| `app/api/tx` | one poll of a transaction: pending / ok / refused / stalled |
| `app/api/state` | every view the page needs, in one cached round trip |
| `lib/ops.ts` | the closed operation set and the trust boundary |
| `lib/chain.ts` | signers, cached reads, receipt reading, the bond top-up |
| `lib/preimage.ts` | the statement-hash rebuild. Runs in the browser |

## Deploying

Vercel, with **Root Directory set to `viewer`** in the project settings — the repo
root is a Python contract project with no `package.json`, so Vercel detects no
framework there and falls back to static hosting, whose default output directory
is `public`. That produces `No Output Directory named "public" found`, which reads
like a missing folder and is really "the Next build never ran". Root Directory
cannot be set from `vercel.json`; it is project-settings-only.

`vercel.json` pins `"framework": "nextjs"` so the same error cannot come back via
a Framework Preset left on "Other". It takes precedence over the dashboard preset,
but only once the root directory is right.

Four environment variables are used: `STUDIO_NEXT_ADDRESS`,
`STUDIO_NEXT_DEPLOY_TX`, `SELLER_KEY`, and `BUYER_KEY`. **`BRADBURY_KEY` must never be set here** — it holds real faucet GEN
on a live testnet and the app has no use for it. No `OPENAI_API_KEY` either;
`exec_prompt` runs on GenLayer's own validators. Vercel does not apply new
variables to an existing deployment, so redeploy after adding them.

To check a deploy before clicking anything, fetch `/api/state`: it should return
`policy.bond_atto` of `1000000000000000000`. A `503` names the missing variable, a
`502` is the chain being slow and worth a retry, and a Vercel-branded `404` means
the root directory is still wrong.

## Live Verification

Not part of `npm test`: this writes real Studio Next state and may take minutes.

```bash
node --dns-result-order=ipv4first tools/verify-live.mjs https://www.notch.bond
```

The script verifies chain 61997, execution success, the statement hash, a matching
evidence hash, a stored model judgment, and a persisted precedent. It prints every
transaction hash and explorer link. See the [root README](../README.md) for the
complete reviewer walkthrough, deployed contract, and verified example.

## The one line that matters

`docs/spec.md` §2 leaves this app "rendering, indexing, non-authoritative
previews" and forbids it computing a verdict. It submits transactions and renders
contract state. The single thing it calculates is the SHA-256 on screen 3 — and
that **verifies** a number the contract published rather than deciding anything,
which is why the screen labels the on-chain hash authoritative and its own
recomputed-locally.
