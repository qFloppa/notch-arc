import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi'
import { erc20Abi } from 'viem'
import { toast } from 'sonner'
import {
  NOTCH_CONTRACT,
  USDC_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
  CLAIM_KINDS,
  BOND_AMOUNT,
  formatUsdc,
} from '../notch-contract'
import { buildTxExplorerUrl } from '@/onchain-facts'

interface Props {
  statementId: `0x${string}`
  itemIds: `0x${string}`[]
  onDisputed: () => void
}

type ItemInfo = {
  itemId: `0x${string}`
  amount: bigint
  memo: string
  cycle: bigint
  evidenceUri: string
}

/** Human-readable charge label for the dropdown, falling back to the hash while loading. */
function itemLabel(it: ItemInfo | undefined, id: `0x${string}`): string {
  if (!it) return `${id.slice(0, 10)}…${id.slice(-6)}`
  const memo = it.memo.trim() || '(no memo)'
  return `${memo} · ${formatUsdc(it.amount)} USDC · cycle ${it.cycle.toString()}`
}

const CLAIM_LABELS: Record<string, string> = {
  not_delivered: 'Not delivered',
  off_spec: 'Off spec',
  overcharged: 'Overcharged',
  duplicate: 'Duplicate charge',
  sla_breach: 'SLA breach',
}

const CLAIM_DEFAULTS: Record<string, string> = {
  not_delivered: 'The service was billed but no output was returned. The evidence receipt confirms 0 content delivered (status: upstream timeout). Requesting full reversal of this charge.',
  off_spec:      'The delivered output does not meet the agreed specification. The receipt logs an error response rather than the contracted extraction result. Charge should be adjusted to reflect actual delivery.',
  overcharged:   'The billed amount exceeds the agreed per-call rate. The quantity in the receipt does not match the contracted unit price. Requesting adjustment to the correct amount.',
  duplicate:     'This charge appears more than once for the same service invocation. The memo and evidence URI match a previously recorded line item in this cycle. One of the two charges should be removed.',
  sla_breach:    'Response latency exceeded the contracted SLA threshold. The receipt records a 30-second timeout, breaching the agreed sub-5s response window. Partial credit should apply per the SLA terms.',
}


export default function DisputePanel({ statementId, itemIds, onDisputed }: Props) {
  const { address, chainId } = useAccount()
  const [open, setOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<`0x${string}`>(itemIds[0] ?? '0x')
  const [claimKind, setClaimKind] = useState<string>(CLAIM_KINDS[0])
  const [claim, setClaim] = useState<string>(CLAIM_DEFAULTS[CLAIM_KINDS[0]] ?? '')
  const [step, setStep] = useState<'form' | 'dispute'>('form')

  const { writeContract: approveUsdc, data: approveTx, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx })

  const { writeContract: openDispute, data: disputeTx, isPending: isDisputing } = useWriteContract()
  const { isLoading: isDisputeConfirming, isSuccess: disputeSuccess, data: disputeReceipt } = useWaitForTransactionReceipt({ hash: disputeTx })

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address ?? '0x0000000000000000000000000000000000000000', NOTCH_CONTRACT.address],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  // Pull each disputable charge's details so the picker shows what it is (memo, amount,
  // cycle) instead of a bare hash. The statement's items are usually from a past cycle, so
  // the parent can't hand them down — we read them from chain when the panel opens.
  const client = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID })
  const [items, setItems] = useState<ItemInfo[]>([])
  const itemIdsKey = itemIds.join(',')
  useEffect(() => {
    if (!open || !client || itemIds.length === 0) return
    let cancelled = false
    void Promise.all(
      itemIds.map(id => client.readContract({ ...NOTCH_CONTRACT, functionName: 'getItem', args: [id] }))
    ).then(res => { if (!cancelled) setItems(res as unknown as ItemInfo[]) }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client, itemIdsKey])

  const itemsById = new Map(items.map(i => [i.itemId, i]))
  const selectedInfo = itemsById.get(selectedItem)

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Bond approved — submit the dispute now')
      setStep('dispute')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveSuccess])

  useEffect(() => {
    if (!disputeSuccess || !disputeTx || !disputeReceipt) return
    toast.success('Dispute filed — the Gemini arbitrator will review', {
      action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, disputeTx), '_blank') },
    })
    setOpen(false)
    setStep('form')
    setClaim('')
    // TabView reads the new Disputed statement from chain and pushes it to the relayer;
    // this just tells it to refresh now so the dispute card appears without a reload.
    onDisputed()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeSuccess, disputeTx, disputeReceipt])

  const hasEnoughAllowance = (allowance ?? 0n) >= BOND_AMOUNT

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
        style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(248,81,73,0.25)' }}
      >
        File Dispute
      </button>
    )
  }

  return (
    <div className="w-full mt-3 rounded-xl p-4 space-y-4" style={{ background: 'rgba(248,81,73,0.04)', border: '1px solid rgba(248,81,73,0.2)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v5M7 10h.01" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="7" cy="7" r="6" stroke="var(--danger)" strokeWidth="1.5"/>
          </svg>
          <h4 className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>File a Dispute</h4>
        </div>
        <button onClick={() => setOpen(false)} style={{ color: 'var(--muted)', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
      </div>

      {/* Bond notice */}
      <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(248,81,73,0.07)', color: 'var(--ink-2)', lineHeight: '1.5' }}>
        Disputes require a <span className="font-semibold" style={{ color: 'var(--danger)' }}>{formatUsdc(BOND_AMOUNT)} USDC bond</span>.
        Upheld → you keep the bond. Rejected → bond goes to the payee. Adjusted → bond split per ruling.
      </div>

      {/* Item selector + what's being disputed */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>
          Disputed charge
        </label>
        {itemIds.length > 1 && (
          <select
            value={selectedItem}
            onChange={e => setSelectedItem(e.target.value as `0x${string}`)}
          >
            {itemIds.map(id => (
              <option key={id} value={id}>{itemLabel(itemsById.get(id), id)}</option>
            ))}
          </select>
        )}

        {/* Detail of the selected charge — so you know exactly what you're disputing */}
        <div className="mt-2 rounded-lg px-3 py-2.5 text-xs" style={{ background: 'rgba(248,81,73,0.07)', lineHeight: '1.5' }}>
          {selectedInfo ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{selectedInfo.memo.trim() || '(no memo)'}</span>
                <span className="tabular font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{formatUsdc(selectedInfo.amount)} USDC</span>
              </div>
              <div style={{ color: 'var(--subtle)' }}>Cycle {selectedInfo.cycle.toString()}</div>
              {selectedInfo.evidenceUri && (
                <a
                  href={selectedInfo.evidenceUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono block mt-0.5"
                  style={{ color: 'var(--accent)', wordBreak: 'break-all' }}
                >
                  {selectedInfo.evidenceUri.length > 48 ? selectedInfo.evidenceUri.slice(0, 48) + '…' : selectedInfo.evidenceUri}
                </a>
              )}
              <div className="mono mt-1" style={{ color: 'var(--subtle)', fontSize: '0.65rem' }}>
                {selectedItem.slice(0, 10)}…{selectedItem.slice(-6)}
              </div>
            </>
          ) : (
            <span style={{ color: 'var(--subtle)' }}>Loading charge details…</span>
          )}
        </div>
      </div>

      {/* Claim kind */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Claim type</label>
        <select
          value={claimKind}
          onChange={e => {
            setClaimKind(e.target.value)
            setClaim(CLAIM_DEFAULTS[e.target.value] ?? '')
          }}
        >
          {CLAIM_KINDS.map(k => (
            <option key={k} value={k}>{CLAIM_LABELS[k] ?? k}</option>
          ))}
        </select>
      </div>

      {/* Claim text */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Claim description</label>
        <textarea
          value={claim}
          onChange={e => setClaim(e.target.value)}
          rows={4}
          required
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {!hasEnoughAllowance && step !== 'dispute' && (
          <button
            onClick={() => {
              if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
              approveUsdc({
                address: USDC_ADDRESS,
                abi: erc20Abi,
                functionName: 'approve',
                args: [NOTCH_CONTRACT.address, BOND_AMOUNT],
                chainId: ARC_TESTNET_CHAIN_ID,
              })
            }}
            disabled={isApproving || isApproveConfirming}
            className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40"
            style={{ background: 'var(--surface-3)', color: 'var(--ink)', border: '1px solid var(--border-2)' }}
          >
            {isApproving ? 'Confirm in wallet…' : isApproveConfirming ? 'Approving…' : `Step 1 — Approve ${formatUsdc(BOND_AMOUNT)} USDC Bond`}
          </button>
        )}

        {(hasEnoughAllowance || step === 'dispute') && (
          <button
            onClick={() => {
              if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
              if (!claim.trim()) { toast.error('Describe your claim first.'); return }
              openDispute({
                ...NOTCH_CONTRACT,
                functionName: 'openDispute',
                args: [statementId, selectedItem, claimKind, claim],
                chainId: ARC_TESTNET_CHAIN_ID,
              })
            }}
            disabled={isDisputing || isDisputeConfirming || !claim.trim()}
            className="w-full py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-40"
            style={{ background: 'var(--danger)' }}
          >
            {isDisputing ? 'Confirm in wallet…' : isDisputeConfirming ? 'Filing…' : 'File Dispute'}
          </button>
        )}
      </div>
    </div>
  )
}
