import { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { NOTCH_CONTRACT, ARC_TESTNET_CHAIN_ID } from './notch-contract'
import { getStoredTabIds } from './tab-store'
import Header from './components/Header'
import CycleDashboard from './components/CycleDashboard'
import TabView from './components/TabView'
import RulingAdmin from './components/RulingAdmin'
import ClaimCredit from './components/ClaimCredit'

type View = { page: 'dashboard' } | { page: 'tab'; tabId: `0x${string}` } | { page: 'admin' }

export interface TabSummary {
  tabId: `0x${string}`
  payer: string
  payee: string
  currentCycle: bigint
  active: boolean
}

export default function App() {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID })
  const [view, setView] = useState<View>({ page: 'dashboard' })
  const [tabs, setTabs] = useState<TabSummary[]>([])
  const [refreshToken, setRefreshToken] = useState(0)
  const triggerRefresh = () => setRefreshToken(t => t + 1)

  useEffect(() => {
    if (!address || !client) return
    let cancelled = false
    const run = async () => {
      try {
        const ids = getStoredTabIds(address)
        if (ids.length === 0) {
          if (!cancelled) setTabs([])
          return
        }
        const summaries = await Promise.all(
          ids.map(async (tabId) => {
            try {
              const tab = await client.readContract({
                ...NOTCH_CONTRACT,
                functionName: 'getTab',
                args: [tabId],
              }) as { payer: `0x${string}`; payee: `0x${string}`; currentCycle: bigint; active: boolean }
              return { tabId, payer: tab.payer, payee: tab.payee, currentCycle: tab.currentCycle, active: tab.active }
            } catch {
              return null
            }
          })
        )
        if (!cancelled) setTabs(summaries.filter(Boolean) as TabSummary[])
      } catch (err) {
        console.error('Error loading tabs:', err)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [address, client, refreshToken])

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg)' }}>
      <Header />

      {/* Nav */}
      <div
        className="sticky z-30"
        style={{
          top: '56px',
          background: 'rgba(13,17,23,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-0.5 py-1.5">
            {[
              { label: 'Dashboard', page: 'dashboard' as const },
              { label: 'Arbitrator', page: 'admin' as const },
            ].map(({ label, page }) => (
              <button
                key={page}
                onClick={() => setView({ page })}
                className="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors"
                style={{
                  background: view.page === page ? 'var(--surface-2)' : 'transparent',
                  color: view.page === page ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <ClaimCredit />

        {view.page === 'dashboard' && (
          <CycleDashboard
            tabs={tabs}
            onSelect={(tabId) => setView({ page: 'tab', tabId })}
            onRefresh={triggerRefresh}
          />
        )}

        {view.page === 'tab' && (
          <TabView
            tabId={(view).tabId}
            onBack={() => { setView({ page: 'dashboard' }); triggerRefresh() }}
          />
        )}

        {view.page === 'admin' && (
          <RulingAdmin tabIds={tabs.map(t => t.tabId)} />
        )}
      </main>
    </div>
  )
}
