# Notch Hackathon Demo Recording Guide

This guide follows the current hosted viewer and contract. Record the actual app
at https://www.notch.bond. The complete sequence covers every exposed control and
the meaningful user paths; contract-only features have a separate test segment.

## Recording Plan

Record the main flow first, then the additional paths as separate clips. Aim for
about 4-6 minutes for the main submission if the hackathon permits it. A complete
feature walkthrough will be longer. Follow the organizer's actual duration limit.
Allow at least 30-60 minutes for capture because network consensus can take minutes
per operation. Keep the submission and the result of each transaction visible;
trim the waiting and label the edit "Waiting for GenLayer consensus; time cut."

The essential story is: agents accumulate charges, a statement can be independently
verified, authentic evidence still needs interpretation, GenLayer judges the claim,
and the contract stores a ruling that later disputes can use.

## Before Recording

1. Open a fresh browser window at https://www.notch.bond with no `?tab=` parameter.
   A fresh browser profile also gives you an empty local transaction record.
2. Set browser zoom so the table, buttons, and ruling are readable. Record at
   1920x1080 if available. Keep the address bar visible in the contract proof shot.
3. Wait for **Connected to Studio Next**. The network is chain **61997**, and the
   expected contract is `0xbedf544340c72383d16C2eE6bcA180a6A6C25C29`.
4. Open the contract link in a second tab. Keep the repository README in another.
5. Keep this completed example ready in a separate tab:
   https://www.notch.bond/?tab=dmu4qe73g22di. It is an earlier recorded run, not a
   substitute to silently present as your current transaction.
6. Use fresh statements for recording. The dispute window is **3,600 seconds from
   closing the statement**. Finish filing within that hour.
7. Do not show `.env`, private keys, or account configuration on camera. The
   public app needs no viewer wallet and no personal model API key.
8. Run the build and test commands near the end of this guide before submission.

**Transaction record** is collapsed near the bottom of the app, below **What the
relayer did**. Expand it whenever this guide asks you to show transaction hashes
or the verified example. **Refresh chain state** is beside the tab details in
**Start**.

Say once: "These are testnet billing records denominated in USDC. The demo does
not transfer USDC. Two server-held demo agent accounts sign real GenLayer
transactions, and disputes post a native testnet GEN bond."

## Main Recording: Actual Validator Judgment

### Shot 1: Explain the Problem and Show the Deployment

1. Show the **Notch** heading and **Connected to Studio Next**.
2. Expand **Why does this need GenLayer?** briefly.
3. Open **Contract: 0xbedf...** and show the explorer address. Return to the app.
4. Point out the separate **Deployment transaction** link.

Say: "Notch is a shared bill for AI agents. Many small service charges become one
verifiable statement. When the buyer disputes the work, neither party nor this
website decides alone. GenLayer validators compare the receipt with the agreed
terms and the contract records the decision."

### Shot 2: Open a Tab and Accrue Charges

1. Click **Open a demo tab** once.
2. Let all four writes finish: opening the tab and billing three calls. Avoid
   clicking another action between automatically submitted calls.
3. Show **Transaction record** with full hash links and **execution succeeded**.
4. Show **Start**: tab ID, seller, buyer, and cycle `0`.
5. Show **The tab accrues**. There should be three rows ending in `-n0`, `-n1`,
   and `-n2`, each for **0.005**. The first two use successful evidence; `-n2`
   uses the off-spec receipt.
6. Point at the terms: `returns extracted line items, qty > 0, non-zero TOTAL`.
7. Hover over an evidence hash to expose its full digest if useful.
8. Bookmark or note the current `?tab=...` URL. It identifies this recording's state.

Say: "The seller has recorded three immutable service charges. Each includes the
price, delivery terms, and a commitment to its evidence. The buyer and seller
are distinct signers. These rows appear after the network accepts the writes."

### Shot 3: Close and Independently Verify the Statement

1. Click **Close cycle 0** and wait for execution success.
2. Show **One statement, one hash** and statement `<your-tab>:0`.
3. Verify **Notches netted: 3** and **Net owed: 0.015 USDC**.
4. Click **Recompute this hash** on that statement.
5. Hold the matching on-chain and browser-computed hashes on screen.
6. Expand **the exact bytes that were hashed (...)** to show the preimage.
7. Briefly point out that the active cycle is now `1`; the three original rows
   belong to closed cycle `0`. Closing the empty new cycle is disabled.

Say: "Three charges are committed as one statement. The browser reconstructs
SHA-256 from the contract's published statement fields and gets the same hash.
That verifies the published bill. It does not decide whether the service met
the agreed terms."

### Shot 4: Compare the Receipts and File a Bonded Claim

1. Scroll to **Dispute the statement**. Before choosing a row, briefly show that
   **File the dispute on ...** is disabled.
2. Open the **evidence** link for `-n0`. Show the successful receipt's `qty: 4200`
   and `TOTAL 42.00`. Return to the app. This is receipt content, not the 0.005
   charge that Notch is adjudicating.
3. Open **evidence** for `-n2`. Show `qty: 0`, `TOTAL 0.00`, and
   `error: upstream timeout after 30s`. Return to the app.
4. Select the radio button for **`-n2`**, not one of the successful calls.
5. Open **Claim kind** briefly to show the five categories:
   `not_delivered`, `off_spec`, `overcharged`, `duplicate`, and `sla_breach`.
6. Leave the selected kind as **`off_spec`**.
7. Set **The claim** to exactly:

   > The receipt shows qty 0 and TOTAL 0.00 with an upstream timeout, so the terms were not met.

8. Click **File the dispute on <your-tab>:0** once and wait for execution success.
9. Show **The ruling** in its pending state: dispute `<your-tab>:0#d`, kind
   `off_spec`, **Bond posted: 1 GEN**, and the selected notch.

Say: "The buyer disputes only the failed call and posts a one-GEN bond. The
receipt can be authentic and still prove failed work. The contract checks the
claimant, statement membership, dispute window, and bond before opening a case."

### Shot 5: Let GenLayer Judge and Show the Stored Result

1. Click **Ask the validators for a ruling** once.
2. Record a few seconds of **Waiting for validators...** and the elapsed timer.
3. Trim the wait if needed, preserving the same tab ID and transaction hash.
4. When complete, show the ruling, remaining disputed amount, bond, citations,
   and stored rationale together where possible.
5. The intended result for this fixture is **upheld**, **Disputed amount that
   stands: 0 USDC**, and **settled - credited to the winner**. Read the actual
   result; model outcomes are not a hardcoded UI response.
6. Crucially, show **Evidence matched its committed hash, so the claim went to
   the model.** Without this, an upheld claim alone does not prove AI judgment.
7. Read or summarize the rationale comparing the promised output with the timeout.
8. Scroll to **Transaction record** and open the **ask for a ruling** hash. Show
   its explorer record and available execution/consensus details. An accepted
   transaction must also have successful contract execution.
9. Return to **Case law** and locate `<your-tab>:0#d` under `off_spec`.
10. If the row is not visible immediately, wait a few seconds and click
    **Refresh chain state** once.

Say: "The evidence fingerprint matched, so this reached the model judgment
path. Validators independently evaluate the evidence and compare the outcome,
evidence result, and amount. The contract stores the ruling and rationale,
credits the bond, and indexes this case for later disputes."

Important: zero is the amount owed for the **disputed call**, not the entire
three-call statement. The two uncontested charges total **0.010 USDC**. The
original statement remains **0.015 USDC**, with its original hash; the ruling
records the disputed adjustment separately. Do not describe a refund, USDC
payment, or automatic rewrite of the statement.

### Shot 6: Show Reuse of Case History

Complete the first dispute before starting this sequence. Follow these IDs only
if you have not added extra charges.

1. In **The tab accrues**, choose **Billed, but off spec**.
2. Click **Bill 1 more** once. Wait for the new `-n3` row in cycle `1`.
3. Click **Close cycle 1**. The new statement `<your-tab>:1` contains one notch
   and **0.005 USDC**.
4. Click **Recompute this hash** on the new statement and show the match.
5. Show **Case law** before the next ruling. The previous off-spec case should
   be among the five most recent cases of that kind, unless public traffic has
   already displaced it.
6. In the new dispute form, explicitly select `-n3`. Keep `off_spec` and the
   same claim text from Shot 4.
7. File the dispute, wait for acceptance, then ask for a ruling.
8. Show the new rationale and **Cited** field. If a prior case is cited, point
   to its exact ID. If nothing is cited, state that accurately.
9. Show the second resolved case in **Case law**.

Say: "Later disputes receive a deterministic window of the five most recent
cases of the same kind. This history is shared across tabs. A model may cite
one of those cases, but an explicit citation is not guaranteed."

Do not call this model training or claim that every later decision is identical.
The contract provides structured past results as context. Rationale text is
stored for people to inspect and is excluded from subsequent precedent prompts.

### Shot 7: Prove Persistence and Finish

1. Reload the same `?tab=...` URL after all pending writes have finished.
2. Show the charges, statements, and latest stored ruling returning.
3. Click **Recompute this hash** again if desired. This local check is not saved
   across reloads; the on-chain statement is.
4. Open the same URL in a fresh browser profile to show that the contract state
   does not depend on the original browser's memory. The local transaction log
   will be empty in that profile; it is not a global chain transaction index.
5. Show the README's **Reproduce Locally** commands and the passing build/test
   output captured separately.

Closing narration: "The repository includes the contract, a working frontend
relayer, receipt checks, reproducible statement hashing, bonded disputes, and
shared case history. Reviewers can open this exact tab or run a fresh flow from
the README."

## Additional Path A: A Valid Delivery Wins Against a Bad Claim

Record this after the two main cycles. It demonstrates that filing a claim does
not automatically make the buyer win.

1. Choose **Delivered as billed** and click **Bill 1 more**.
2. With the sequence above, this creates `-n4` in cycle `2`.
3. Click **Close cycle 2**, then recompute its hash. The statement is **0.005 USDC**.
4. Open the new row's **evidence** and show positive quantity and non-zero total.
5. Select `-n4`, choose **off_spec**, and enter this deliberately unsupported claim:

   > The service returned no extracted line items, quantity was zero, and TOTAL was zero, so the delivery terms were not met.

6. File the dispute, show the 1 GEN bond, and ask for a ruling.
7. The expected result is **rejected**, matching evidence, and **0.005 USDC**
   remaining. If the actual judgment differs, report what happened; do not
   describe an expected result as observed.
8. Show the stored rationale. Explain that rejection credits the buyer's bond
   to the seller. The UI says "credited to the winner" without naming a balance.

Say: "This claim contradicts the successful receipt. Validators can reject a
buyer's unsupported complaint, leaving the charge intact and forfeiting the
bond to the seller."

## Additional Path B: Evidence Integrity Failure

1. Choose **Evidence swapped after billing** and click **Bill 1 more**.
2. With the sequence above, this creates `-n5` in cycle `3`.
3. Click **Close cycle 3**, then recompute its hash. The statement is **0.005 USDC**.
4. Select `-n5`, choose **off_spec**, and enter:

   > The evidence served for this charge does not match the evidence hash committed when it was billed. The seller cannot substantiate this charge with the committed receipt.

5. File the dispute and ask for a ruling.
6. Show **upheld**, **0 USDC**, bond credit, and especially **No model was consulted.**
7. Show **Case law** with **evidence matched: no** for this case.

Say: "This preset commits the digest of a different document from the URL it
serves. It simulates swapped evidence. The integrity check can resolve this
without a model; it is separate from the decentralized interpretation shown
in the first case."

Do not claim that you edited an on-chain receipt or actually changed the remote
file during the recording. The preset creates the mismatch at billing time.

## Additional Path C: Batch Billing and an Undisputed Statement

This covers the remaining **Bill 5 more** control and a clean bill.

1. Choose **Delivered as billed**.
2. Click **Bill 5 more** once and wait for all five rows to appear. It submits
   five separate transactions, not one atomic batch.
3. Click **Bill 1 more** once and wait.
4. With all previous sequences completed, these are `-n6` through `-n11` in
   cycle `4`. There are six charges in this cycle, twelve on the tab overall.
5. Click **Close cycle 4** and recompute its hash.
6. Show **Notches netted: 6** and **Net owed: 0.030 USDC**.
7. Leave it undisputed. Explain that an uncontested statement becomes final
   after the dispute window at the contract level. The viewer has no Accept or
   Settle button and does not automatically change the visible badge to settled.

Say: "The same tab can accumulate repeated calls over multiple cycles. Six
charges produce one verifiable statement. A buyer can leave a correct bill
undisputed."

## Optional Error-Handling Clip

Capture the empty-claim check before filing a real dispute in an unfinished cycle.

1. Select a receipt so the filing button is enabled.
2. Clear **The claim**, click **File the dispute on ...**, and scroll to
   **What the relayer did**.
3. Show `empty claim`. This is relayer input validation and creates no contract
   transaction. Do not present it as an on-chain rejection.
4. Restore the correct claim and continue normally.

Also show **What the relayer did** after successful operations. It reports
submission, waiting, accepted execution, and any error. It is session-local.

Duplicate disputes, a wrong payer, an insufficient bond, and an expired window
are contract guards. The normal UI deliberately prevents or fixes several of
these situations, so demonstrate them through the direct tests below instead
of pretending there is a UI control for each invalid transaction.

## Features Without a Frontend Button

| Contract capability | How to demonstrate it accurately |
| --- | --- |
| Explicit acceptance and settlement reference | Run `tests/direct/test_settle.py`; show the contract methods `accept` and `file_settlement`. Settlement records a reference; it is not a USDC transfer. |
| Bond withdrawal | Run `tests/direct/test_bond.py`; show `get_bond_credit` and `withdraw`. The viewer credits the bond but has no withdrawal action. |
| Credit history and credit limit | Run `tests/direct/test_credit.py`; show `get_credit_history` and `credit_limit`. This is a computed signal, not an enforced spending cap. |
| Partial adjustment | Run the adjustment tests in `test_resolve.py` and tolerance tests in `test_consensus.py`. There is no purpose-built partial-delivery fixture in the UI, so no reliable click sequence guarantees `adjusted`. |
| Multiple disputed notches | Covered by `test_dispute.py`. The contract accepts a valid list; the viewer's radio selection submits one notch. |
| Bilateral netting, exact offset, other members | Covered by `test_close.py` and `test_agent_hash.py`. The hosted demo fixes two identities and one-way 0.005 charges. |
| Invalid parties, bond, duplicate IDs, time windows | Covered by `test_tab.py`, `test_dispute.py`, and `test_resolve.py`. |
| Missing evidence, transient fetch failures, invalid model output | Covered by `test_resolve.py` and `test_consensus.py`. These are not extra selectable billing presets. |
| Precedent selection and exclusion of rationale from later prompts | Covered by `test_precedent.py`. |

The five claim kinds use the same workflow. Selecting a different kind changes
the claim category and corresponding precedent window; it does not generate
new evidence. The supplied receipts specifically support the off-spec example.
Do not claim dedicated overcharge, duplicate, or SLA scenarios from merely
selecting their names in the menu.

Direct tests use mocked model/web responses. Label that clip "Contract tests"
and retain the live matched-evidence ruling as proof of real network judgment.
Some tests explicitly exercise the comparison helper, but direct mode is not a
full distributed consensus run.

## Technical Proof Shot: Why This Is Beyond Boilerplate

Keep this brief in the main video; use an appendix if reviewers want details.

1. Show `viewer/app/page.tsx`: user actions POST to `/api/act` and poll `/api/tx`.
2. Show `viewer/lib/ops.ts`: the closed operations map to `open_tab`, `add_notch`,
   `close`, `open_dispute`, and `resolve`, with seller/buyer signing roles.
3. Show `viewer/lib/chain.ts`: `studioDevnet` clients call `writeContract`, and
   successful execution is checked in addition to accepted/finalized status.
4. Show `contracts/notch.py`, method `resolve`: `gl.vm.run_nondet` invokes the
   leader and validator functions before storing dispute state and indexing it.
5. Show `_parse_verdict` and `_agree`: allowed outcomes, bounded honest-model
   amounts, and comparison of independently obtained decisions. Non-adjusted
   amounts must match exactly; adjusted amounts have a 1% comparison tolerance.
6. Show the writes to dispute status, outcome, amount, evidence result, rationale,
   precedent index, and bond credit.

Use narrow claims. Rationale wording and citation lists are metadata and are
not compared for equality. The current code caps citation count and ID length;
do not claim it verifies every cited ID against the supplied precedent window.

## Reviewer Reproduction

### No Installation

1. Open https://www.notch.bond.
2. Follow Shots 2-5: open the demo tab, close cycle 0, recompute, select `-n2`,
   file `off_spec`, and ask for a ruling.
3. Check execution success, evidence match, stored rationale, and the new case.
4. For an already completed run, open:
   https://www.notch.bond/?tab=dmu4qe73g22di.
5. Expand **Verified example: off-spec claim upheld** to access its fixed
   transaction links. That example was created by the verification script with
   **two** calls, a **0.010 USDC** original statement, and disputed receipt **`-n1`**.
   The normal **Open a demo tab** button creates three calls and uses **`-n2`**.

Contract:
https://explorer-studio-dev.genlayer.com/address/0xbedf544340c72383d16C2eE6bcA180a6A6C25C29

Recorded example ruling:
https://explorer-studio-dev.genlayer.com/tx/0x2c11a1e821c52484027d2000d0fd39e4f83e93d4fe4ec9a72e30ca897a74ad2d

### Fresh Local Checkout

Use Node.js **22.18+** or **24+** and npm. Run each line in order:

```bash
git clone https://github.com/Rat3dRR/notch.git
cd notch/viewer
npm ci
node tools/init-demo.mjs
npm test
npm run build
npm run dev
```

Open http://localhost:3000. If that port is occupied, use
`npm run dev -- --port 3001` and open http://localhost:3001.

`init-demo.mjs` creates fresh demo keys in the repository `.env` and refuses to
overwrite an existing file. In an already configured checkout, skip that step.
The app funds the demo accounts through the Studio faucet as needed. Do not
use the older Python deployment or agent scripts as the Studio Next reproduction
path; they target historical networks.

### Repeatable Live Verification

From `viewer/`, run:

```bash
node --dns-result-order=ipv4first tools/verify-live.mjs https://www.notch.bond
```

Or target a running local viewer:

```bash
node tools/verify-live.mjs http://localhost:3000
```

This creates new testnet state and prints the tab URL and transaction links.
It checks chain 61997, successful executions, matching statement hash, matching
evidence, a resolved verdict with rationale, and a stored precedent. It accepts
any valid model outcome; its PASS message does not guarantee the claim was upheld.
Keep the terminal's final PASS and hashes for the submission evidence.

### Contract Tests

Use Python 3.12 and an activated virtual environment from the repository root:

```bash
pip install -r requirements.txt
genvm-lint check contracts/notch.py
python -m pytest tests/direct -q
```

On Windows PowerShell, set this first:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
```

For a verbose recording of contract-only paths:

```bash
python -m pytest tests/direct/test_settle.py tests/direct/test_bond.py tests/direct/test_credit.py -v
python -m pytest tests/direct/test_dispute.py tests/direct/test_resolve.py tests/direct/test_consensus.py tests/direct/test_precedent.py -v
```

The first run may download the pinned GenVM runner bundle. A direct-test startup
log can mention the historical network from `gltest.config.yaml`; these tests
run locally with mocks. The live viewer proof must show Studio Next, chain 61997.

## Recovery During Recording

| Situation | Action |
| --- | --- |
| Still awaiting consensus | Wait. Preserve the transaction hash and show a labeled time cut. |
| Confirmation unknown or connection interrupted | Inspect the existing hash in the explorer or `/api/tx?hash=<hash>` before retrying. A bill retry can create another charge. |
| Transaction executed but screen looks old | Wait a few seconds, then click **Refresh chain state**. |
| Open-tab seeding stopped partway | Count actual rows. Restore the intended good/good/off-spec sequence with **Bill 1 more**, or start a fresh recording tab. Do not assume `-n2` exists. |
| Evidence did not match in the off-spec case | This is not proof of model judgment. Inspect the public evidence URL; it must return the committed bytes. Use a fresh matched-evidence run once availability is restored. |
| No citation on the second case | Show the available case-history window and report that no explicit citation was made. |
| Dispute window closed | Start a fresh tab. Reloading cannot reopen the old contract deadline. |
| Too many requests | Stop repetitive actions and refreshes; honor the retry delay before continuing. |
| Network stalled or validators timed out | Keep the transaction link, inspect its status, and use the completed example only with an explicit label that it is an earlier run. |
| Need a new tab | Navigate to https://www.notch.bond without `?tab=...`. There is no reset button; old on-chain records remain. |
| More than one undisputed statement | The form targets the first statement whose stored status is `open`. Finish cycles in order; use a fresh tab if an expired open statement obstructs the intended demo. |

## Submission Evidence Checklist

- Video shows a user-triggered write and its successful transaction receipt.
- The address and network are Studio Next / chain 61997.
- At least one ruling has matching evidence, demonstrating the model judgment path.
- Statement hash match, stored rationale, bond credit, and case history are visible.
- The recording distinguishes the original statement from the disputed amount.
- Any additional path shows its actual result, with consensus waits honestly edited.
- Build/test output is from the submitted revision; direct tests are identified as mocked.
- Submission includes the repository, live app, your recorded tab URL, contract,
  key transaction links, and reproduction commands.
- No claims of USDC transfers, UI withdrawal/settlement, enforced credit limits,
  guaranteed partial outcomes, guaranteed citations, or model training.
