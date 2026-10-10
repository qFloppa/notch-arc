import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import OpenTabForm from './OpenTabForm'
import { formatAddress } from '../notch-contract'
import { addStoredTabId } from '../tab-store'
import NotchLogo from './NotchLogo'

interface TabSummary {
  tabId: `0x${string}`
  payer: string
  payee: string
  currentCycle: bigint
  active: boolean
}

interface Props {
  tabs: TabSummary[]
  onSelect: (tabId: `0x${string}`) => void
  onRefresh: () => void
}

/**
 * TallyMark — renders N notch marks as SVG tally groups (5 strokes per group).
 * Mirrors the visual language of the Notch logo: vertical sticks scored by horizontals.
 */
function TallyMark({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs" style={{ color: 'var(--subtle)' }}>—</span>
  const groups: number[] = []
  let rem = count
  while (rem > 0) { groups.push(Math.min(rem, 5)); rem -= 5 }

  return (
    <div className="flex items-center gap-1.5">
      {groups.map((g, gi) => (
        <svg key={gi} width={g <= 4 ? g * 5 + 2 : 22} height="14" viewBox={`0 0 ${g <= 4 ? g * 5 + 2 : 22} 14`} fill="none">
          {Array.from({ length: Math.min(g, 4) }).map((_, i) => (
            <line key={i} x1={i * 5 + 2} y1="1" x2={i * 5 + 2} y2="13" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          ))}
          {g === 5 && (
            <line x1="0" y1="10" x2="22" y2="4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          )}
        </svg>
      ))}
      <span className="mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>{count}</span>
    </div>
  )
}

export default function CycleDashboard({ tabs, onSelect, onRefresh }: Props) {
  const { address } = useAccount()
  const [lookupId, setLookupId] = useState('')

  return (
    <div className="space-y-8">
      {/* Hero — logo featured large on the right */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #0d1a2e 60%, #0a1020 100%)',
          border: '1px solid var(--border-2)',
          minHeight: 200,
        }}
      >
        {/* Grid dot pattern */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(88,166,255,0.12) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Glow behind logo */}
        <div
          className="absolute"
          style={{
            right: -20,
            top: -30,
            width: 220,
            height: 300,
            background: 'radial-gradient(ellipse at center, rgba(58,130,246,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Content */}
        <div className="relative flex items-center justify-between gap-6 px-8 py-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="pill" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                USDC clearing layer
              </span>
            </div>
            <h1
              className="display text-3xl font-bold mb-3"
              style={{ color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: '1.1' }}
            >
              Agent Payment<br />Clearing
            </h1>
            <p className="text-sm max-w-sm" style={{ color: 'var(--ink-2)', lineHeight: '1.7' }}>
              Accumulate micro-charges on a shared tab, net them into a cycle statement, and resolve disputes via the Gemini arbitrator.
            </p>
          </div>

          {/* Logo — large, tilted render with drop shadow glow */}
          <div className="shrink-0 hidden sm:block" style={{ marginRight: 8 }}>
            <NotchLogo width={64} height={132} rotate={8} style={{ transform: 'rotate(8deg) translateY(-8px)' }} />
          </div>
        </div>
      </div>

      {/* Connect gate */}
      {!address ? (
        <div
          className="rounded-2xl py-16 flex flex-col items-center gap-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Big logo for empty state */}
          <NotchLogo width={40} height={82} glow={false} grayscale opacity={0.5} />
          <div className="text-center">
            <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>Connect your wallet</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>to open or view clearing tabs</p>
          </div>
          <ConnectKitButton />
        </div>
      ) : (
        <div className="space-y-6">
          <OpenTabForm onCreated={onRefresh} />

          {/* Load tab by ID — for tabs opened in a previous session or on another device */}
          <form
            onSubmit={e => {
              e.preventDefault()
              const id = lookupId.trim() as `0x${string}`
              if (!id.startsWith('0x') || id.length !== 66) return
              if (address) addStoredTabId(address, id)
              setLookupId('')
              onRefresh()
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={lookupId}
              onChange={e => setLookupId(e.target.value)}
              placeholder="Paste a tab ID (0x…) to load it"
              className="mono text-xs flex-1"
              style={{ minWidth: 0 }}
            />
            <button
              type="submit"
              disabled={!lookupId.trim().startsWith('0x') || lookupId.trim().length !== 66}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 shrink-0"
              style={{ background: 'var(--surface-3)', color: 'var(--ink-2)', border: '1px solid var(--border-2)' }}
            >
              Load
            </button>
          </form>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="display font-semibold" style={{ color: 'var(--ink)' }}>Your Tabs</h2>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{tabs.length} tab{tabs.length !== 1 ? 's' : ''}</span>
            </div>

            {tabs.length === 0 ? (
              <div
                className="rounded-2xl py-12 flex flex-col items-center gap-3"
                style={{ background: 'var(--surface)', border: '1px dashed var(--border-2)' }}
              >
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No tabs yet.</p>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>Open a tab above to start clearing charges between agents.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tabs.map(tab => {
                  const isPayer = address.toLowerCase() === tab.payer.toLowerCase()
                  const isPayee = address.toLowerCase() === tab.payee.toLowerCase()
                  const cycleNum = Number(tab.currentCycle)

                  return (
                    <button
                      key={tab.tabId}
                      onClick={() => onSelect(tab.tabId)}
                      className="w-full rounded-xl p-4 text-left transition-all"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => {
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'
                        ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
                      }}
                      onMouseLeave={e => {
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLElement).style.background = 'var(--surface)'
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>
                              {tab.tabId.slice(0, 10)}…{tab.tabId.slice(-6)}
                            </p>
                            <span
                              className="pill"
                              style={{
                                background: tab.active ? 'var(--success-dim)' : 'var(--surface-3)',
                                color: tab.active ? 'var(--success)' : 'var(--muted)',
                              }}
                            >
                              {tab.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-sm">
                            <span>
                              <span style={{ color: 'var(--subtle)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>payer </span>
                              <span className="mono font-medium" style={{ color: isPayer ? 'var(--accent)' : 'var(--ink)' }}>
                                {formatAddress(tab.payer)}{isPayer ? ' (you)' : ''}
                              </span>
                            </span>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--border-2)', flexShrink: 0 }}>
                              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>
                              <span style={{ color: 'var(--subtle)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>payee </span>
                              <span className="mono font-medium" style={{ color: isPayee ? 'var(--accent)' : 'var(--ink)' }}>
                                {formatAddress(tab.payee)}{isPayee ? ' (you)' : ''}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Right: tally marks for cycle count + chevron */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--subtle)', fontSize: '0.6rem' }}>cycles</span>
                            <TallyMark count={cycleNum} />
                          </div>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--border-2)' }}>
                            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
