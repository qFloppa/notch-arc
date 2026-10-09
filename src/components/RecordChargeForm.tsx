import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'
import { keccak256, toBytes } from 'viem'
import { NOTCH_CONTRACT, ARC_TESTNET_CHAIN_ID } from '../notch-contract'
import { buildTxExplorerUrl } from '@/onchain-facts'

interface Props {
  tabId: `0x${string}`
  onRecorded: () => void
}

const RAW_BASE = 'https://raw.githubusercontent.com/qFloppa/notch-arc/main/notch-original/fixtures'

const PRESETS = [
  {
    label: 'Good receipt',
    memo: 'API call: GET /v1/extract — service delivered',
    amount: '0.005',
    evidenceUri: `${RAW_BASE}/receipt-good.json`,
    description: 'Substantiated charge — receipt confirms delivery',
  },
  {
    label: 'Off-spec receipt',
    memo: 'API call: GET /v1/extract — upstream timeout',
    amount: '0.005',
    evidenceUri: `${RAW_BASE}/receipt-off-spec.json`,
    description: 'Hashes correctly but reports 0 content returned — good to dispute',
  },
] as const

export default function RecordChargeForm({ tabId, onRecorded }: Props) {
  const { address, chainId } = useAccount()
  const [preset, setPreset] = useState(0)
  const [amount, setAmount] = useState<string>(PRESETS[0].amount)
  const [memo, setMemo] = useState<string>(PRESETS[0].memo)
  const [evidenceUri, setEvidenceUri] = useState<string>(PRESETS[0].evidenceUri)
  const [open, setOpen] = useState(false)

  function applyPreset(idx: number) {
    setPreset(idx)
    setAmount(PRESETS[idx].amount)
    setMemo(PRESETS[idx].memo)
    setEvidenceUri(PRESETS[idx].evidenceUri)
  }

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Charge recorded', {
        action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, hash), '_blank') },
      })
      reset()
      setOpen(false)
      onRecorded()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
    const amountRaw = BigInt(Math.round(parseFloat(amount) * 1_000_000))
    const evidenceHash = keccak256(toBytes(evidenceUri || 'no-evidence'))
    writeContract({
      ...NOTCH_CONTRACT,
      functionName: 'recordCharge',
      args: [tabId, amountRaw, memo, evidenceUri, evidenceHash],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(88,166,255,0.2)' }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        Record Charge
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl p-4 space-y-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>New Charge</span>
        <button type="button" onClick={() => setOpen(false)} style={{ color: 'var(--muted)', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Preset selector */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Receipt type</p>
          <div className="flex gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyPreset(i)}
                className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-left transition-colors"
                style={{
                  background: preset === i ? 'var(--accent-dim)' : 'var(--surface-3)',
                  color: preset === i ? 'var(--accent)' : 'var(--muted)',
                  border: `1px solid ${preset === i ? 'rgba(88,166,255,0.3)' : 'var(--border)'}`,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>{PRESETS[preset].description}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0.000001"
              step="0.000001"
              required
              className="tabular text-sm pr-14"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none" style={{ color: 'var(--muted)' }}>USDC</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Memo</label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Evidence URI <span style={{ color: 'var(--subtle)', textTransform: 'none', letterSpacing: 0 }}>optional</span></label>
          <input
            type="text"
            value={evidenceUri}
            onChange={e => setEvidenceUri(e.target.value)}
            className="mono text-xs"
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
            The URI is hashed with keccak256 as on-chain evidence commitment
          </p>
        </div>

        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-2 rounded-lg font-semibold text-sm"
            style={{ background: 'var(--surface-3)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || isConfirming || !address}
            className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0d1117' }}
          >
            {isPending ? 'Confirm…' : isConfirming ? 'Confirming…' : 'Record'}
          </button>
        </div>
      </form>
    </div>
  )
}
