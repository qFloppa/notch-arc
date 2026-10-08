import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseAbiItem, decodeEventLog } from 'viem'
import { toast } from 'sonner'
import { NOTCH_CONTRACT, ARC_TESTNET_CHAIN_ID } from '../notch-contract'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { addStoredTabId } from '../tab-store'

interface Props {
  onCreated: () => void
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>{hint}</p>}
    </div>
  )
}

const TAB_OPENED_ABI = parseAbiItem(
  'event TabOpened(bytes32 indexed tabId, address indexed creator, address indexed payer, address payee, uint256 cycleSeconds)'
)

export default function OpenTabForm({ onCreated }: Props) {
  const { address, chainId } = useAccount()
  const [payer, setPayer] = useState(address ?? '')
  const [payee, setPayee] = useState('')
  const [cycleDays, setCycleDays] = useState('1')
  const [open, setOpen] = useState(false)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Parse tabId from receipt logs and store it — runs after confirmation
  useEffect(() => {
    if (!isSuccess || !receipt || !address) return
    try {
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: [TAB_OPENED_ABI], data: log.data, topics: log.topics })
          if (decoded.eventName === 'TabOpened' && decoded.args.tabId) {
            addStoredTabId(address, decoded.args.tabId)
          }
        } catch {
          // not a TabOpened log — skip
        }
      }
    } catch {
      // receipt parsing failed — tab will still be on-chain, just not auto-listed
    }
    toast.success('Tab opened', {
      description: 'New clearing tab is live on Arc Testnet.',
      action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, hash!), '_blank') },
    })
    reset()
    setOpen(false)
    onCreated()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
    const cycleSeconds = BigInt(Math.round(parseFloat(cycleDays) * 86400))
    writeContract({
      ...NOTCH_CONTRACT,
      functionName: 'openTab',
      args: [payer as `0x${string}`, payee as `0x${string}`, cycleSeconds],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => { setPayer(address ?? ''); setOpen(true) }}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
        style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(88,166,255,0.2)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Open a Tab
      </button>
    )
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="display font-semibold text-base" style={{ color: 'var(--ink)' }}>Open a Tab</h3>
        <button
          onClick={() => setOpen(false)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
          style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Payer address" hint="The agent paying for services">
          <input
            type="text"
            value={payer}
            onChange={e => setPayer(e.target.value)}
            placeholder="0x…"
            required
            className="mono text-sm"
          />
        </Field>

        <Field label="Payee address" hint="The agent receiving payment">
          <input
            type="text"
            value={payee}
            onChange={e => setPayee(e.target.value)}
            placeholder="0x…"
            required
          />
        </Field>

        <Field label="Cycle length" hint="Use 0.001 days (~86 s) for quick testnet demos">
          <div className="relative">
            <input
              type="number"
              value={cycleDays}
              onChange={e => setCycleDays(e.target.value)}
              min="0.001"
              step="0.001"
              required
              className="tabular text-sm pr-12"
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none"
              style={{ color: 'var(--muted)' }}
            >
              days
            </span>
          </div>
        </Field>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: 'var(--surface-3)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || isConfirming || !address}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0d1117' }}
          >
            {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Open Tab'}
          </button>
        </div>
      </form>
    </div>
  )
}
