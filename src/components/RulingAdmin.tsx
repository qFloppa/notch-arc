/**
 * RulingAdmin — read-only arbitrator panel.
 * Disputes are resolved automatically by the Gemini relayer (relayer/server.ts).
 */
import { useReadContract } from 'wagmi'
import { NOTCH_CONTRACT, ARC_TESTNET_CHAIN_ID, formatUsdc, formatAddress, formatTimestamp } from '../notch-contract'

interface Props {
  tabIds: `0x${string}`[]
}

function DisputeCard({ disputeId }: { disputeId: `0x${string}` }) {
  const { data: dispute } = useReadContract({
    ...NOTCH_CONTRACT,
    functionName: 'getDispute',
    args: [disputeId],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  if (!dispute) return null

  const d = dispute as {
    disputeId: `0x${string}`; statementId: `0x${string}`; itemId: `0x${string}`
    claimant: `0x${string}`; claimKind: string; claim: string
    bondAmount: bigint; status: number; outcome: string
    revisedItemAmount: bigint; claimantBondAward: bigint
    rationale: string; evidenceHashMatched: boolean
    openedAt: bigint; resolvedAt: bigint
  }

  const isPending = d.status === 0
  const outcomeStyle: Record<string, { bg: string; color: string }> = {
    upheld:   { bg: 'var(--success-dim)',  color: 'var(--success)' },
    adjusted: { bg: 'var(--blue-dim)',     color: 'var(--blue)' },
    rejected: { bg: 'var(--danger-dim)',   color: 'var(--danger)' },
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>{disputeId.slice(0, 10)}…{disputeId.slice(-6)}</p>
        <span
          className="pill"
          style={{
            background: isPending ? 'var(--warning-dim)' : 'var(--success-dim)',
            color: isPending ? 'var(--warning)' : 'var(--success)',
          }}
        >
          {isPending ? 'Pending' : 'Resolved'}
        </span>
      </div>

      <p className="text-sm" style={{ color: 'var(--ink-2)', lineHeight: '1.5' }}>
        <span className="font-semibold" style={{ color: 'var(--muted)' }}>{d.claimKind.replace(/_/g, ' ')}</span>
        {' — '}{d.claim}
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p style={{ color: 'var(--subtle)' }}>Claimant</p>
          <p className="mono font-medium mt-0.5" style={{ color: 'var(--ink)' }}>{formatAddress(d.claimant)}</p>
        </div>
        <div>
          <p style={{ color: 'var(--subtle)' }}>Bond</p>
          <p className="tabular font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{formatUsdc(d.bondAmount)} USDC</p>
        </div>
        <div>
          <p style={{ color: 'var(--subtle)' }}>Opened</p>
          <p className="mt-0.5" style={{ color: 'var(--ink-2)' }}>{formatTimestamp(d.openedAt)}</p>
        </div>
        {!isPending && (
          <div>
            <p style={{ color: 'var(--subtle)' }}>Resolved</p>
            <p className="mt-0.5" style={{ color: 'var(--ink-2)' }}>{formatTimestamp(d.resolvedAt)}</p>
          </div>
        )}
      </div>

      {!isPending && (
        <div className="rounded-lg p-3" style={{ background: 'var(--surface-3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="pill"
              style={outcomeStyle[d.outcome] ?? { bg: 'var(--surface-3)', color: 'var(--muted)' }}
            >
              {d.outcome || 'Unknown'}
            </span>
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              · evidence hash {d.evidenceHashMatched ? 'matched' : 'mismatch'}
            </span>
          </div>
          {d.outcome === 'adjusted' && (
            <p className="text-xs mb-1" style={{ color: 'var(--ink-2)' }}>
              Revised: <span className="font-semibold tabular">{formatUsdc(d.revisedItemAmount)} USDC</span>
            </p>
          )}
          {d.rationale && (
            <p className="text-xs" style={{ color: 'var(--ink-2)', lineHeight: '1.5' }}>{d.rationale}</p>
          )}
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2">
          <div
            className="w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0"
            style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--warning)' }}
          />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Awaiting Gemini arbitrator ruling…</span>
        </div>
      )}
    </div>
  )
}

export default function RulingAdmin({ tabIds: _ }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--warning-dim)' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7.5" stroke="var(--warning)" strokeWidth="1.5"/>
              <path d="M9 5.5v4M9 12h.01" stroke="var(--warning)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h3 className="display font-semibold" style={{ color: 'var(--ink)' }}>Gemini Arbitrator</h3>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Off-chain AI judge for bonded disputes</p>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--ink-2)', lineHeight: '1.6' }}>
          When a dispute is filed, the relayer automatically fetches the evidence URI, sends it to Gemini for evaluation, and submits a binding ruling on-chain within minutes. The outcome — upheld, adjusted, or rejected — determines bond distribution.
        </p>
      </div>

      {/* Setup instructions */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Relayer setup</p>
        </div>
        <div className="p-5 space-y-4">
          {[
            { step: '1', label: 'Copy env', code: 'cd relayer && cp env.example .env' },
            { step: '2', label: 'Fill secrets', code: 'GEMINI_API_KEY=… ARBITRATOR_PRIVATE_KEY=…' },
            { step: '3', label: 'Install & run', code: 'bun install && bun run dev' },
          ].map(({ step, label, code }) => (
            <div key={step} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                {step}
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--ink-2)' }}>{label}</p>
                <code className="mono text-xs block px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-3)', color: 'var(--ink)', wordBreak: 'break-all' }}>
                  {code}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract info */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Deployed contract</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Address</p>
            <p className="mono text-sm break-all mt-1" style={{ color: 'var(--ink)' }}>
              {NOTCH_CONTRACT.address}
            </p>
          </div>
          <a
            href={`https://explorer.testnet.arc.io/address/${NOTCH_CONTRACT.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            View on Arc Testnet Explorer
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 9L9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <p className="text-xs" style={{ color: 'var(--subtle)', lineHeight: '1.6' }}>
            Arbitrator is set to the relayer wallet. Disputes filed on this contract are processed automatically by the Gemini relayer.
          </p>
        </div>
      </div>
    </div>
  )
}

export { DisputeCard }
