import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi'
import { erc20Abi } from 'viem'
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import {
  NOTCH_CONTRACT,
  USDC_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
  STATUS_LABELS,
  formatUsdc,
  formatAddress,
  formatTimestamp,
  pushDispute,
} from '../notch-contract'
import { buildTxExplorerUrl } from '@/onchain-facts'
import RecordChargeForm from './RecordChargeForm'
import DisputePanel from './DisputePanel'

interface Props {
  tabId: `0x${string}`
  onBack: () => void
}

type TabData = {
  tabId: `0x${string}`; creator: `0x${string}`; payer: `0x${string}`; payee: `0x${string}`
  cycleSeconds: bigint; currentCycle: bigint; openedAt: bigint; active: boolean
  memberList: `0x${string}`[]
}

type LineItemData = {
  itemId: `0x${string}`; tabId: `0x${string}`; payer: `0x${string}`; payee: `0x${string}`
  amount: bigint; memo: string; evidenceUri: string; evidenceHash: `0x${string}`
  cycle: bigint; createdAt: bigint
}

type StatementData = {
  statementId: `0x${string}`; tabId: `0x${string}`; cycle: bigint; closedAt: bigint
  closedBy: `0x${string}`; statementHash: `0x${string}`; status: number; netAmount: bigint
  itemIds: `0x${string}`[]; acceptedBy: `0x${string}`; acceptedAt: bigint
}

type DisputeData = {
  disputeId: `0x${string}`; statementId: `0x${string}`; itemId: `0x${string}`
  claimant: `0x${string}`; claimKind: string; claim: string; bondAmount: bigint
  status: number; outcome: string; revisedItemAmount: bigint; claimantBondAward: bigint
  rationale: string; evidenceHashMatched: boolean; openedAt: bigint; resolvedAt: bigint
  bondCredited: boolean
}

function StatusBadge({ status }: { status: number }) {
  const label = STATUS_LABELS[status] ?? 'Unknown'
  const styles: Record<string, { bg: string; color: string }> = {
    Open:     { bg: 'var(--accent-dim)',    color: 'var(--accent)' },
    Accepted: { bg: 'var(--success-dim)',   color: 'var(--success)' },
    Disputed: { bg: 'var(--danger-dim)',    color: 'var(--danger)' },
    Resolved: { bg: 'var(--blue-dim)',      color: 'var(--blue)' },
    Settled:  { bg: 'var(--success-dim)',   color: 'var(--success)' },
  }
  const s = styles[label] ?? { bg: 'var(--surface-3)', color: 'var(--muted)' }
  return (
    <span className="pill" style={s}>{label}</span>
  )
}

function computeStatementHash(items: { itemId: `0x${string}`; amount: bigint }[]): `0x${string}` {
  const sorted = [...items].sort((a, b) => (a.itemId < b.itemId ? -1 : 1))
  if (sorted.length === 0) return '0x0000000000000000000000000000000000000000000000000000000000000000'
  const types = sorted.flatMap(() => ['bytes32', 'uint256'] as const) as `${string}`[]
  const values = sorted.flatMap(x => [x.itemId, x.amount]) as unknown[]
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(types.join(', ')),
      values as Parameters<typeof encodeAbiParameters>[1]
    )
  )
}

export default function TabView({ tabId, onBack }: Props) {
  const { address, chainId } = useAccount()
  const client = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID })

  const { data: tabRaw, refetch: refetchTab } = useReadContract({
    ...NOTCH_CONTRACT, functionName: 'getTab', args: [tabId], chainId: ARC_TESTNET_CHAIN_ID,
  })
  const tab = tabRaw as TabData | undefined

  const { data: cycleItemIds, refetch: refetchCycleItems } = useReadContract({
    ...NOTCH_CONTRACT,
    functionName: 'getTabCycleItemIds',
    args: [tabId, tab?.currentCycle ?? 1n],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!tab },
  })

  const { data: statementIds, refetch: refetchStatements } = useReadContract({
    ...NOTCH_CONTRACT, functionName: 'getTabStatementIds', args: [tabId], chainId: ARC_TESTNET_CHAIN_ID,
  })

  const [cycleItems, setCycleItems] = useState<LineItemData[]>([])
  const cycleItemIdsKey = JSON.stringify(cycleItemIds)
  useEffect(() => {
    const ids = cycleItemIds as `0x${string}`[] | undefined
    if (!client || !ids || ids.length === 0) return
    let cancelled = false
    void Promise.all(
      ids.map(id => client.readContract({ ...NOTCH_CONTRACT, functionName: 'getItem', args: [id] }))
    ).then(results => { if (!cancelled) setCycleItems(results as LineItemData[]) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, cycleItemIdsKey])

  const [stmtList, setStmtList] = useState<StatementData[]>([])
  const statementIdsKey = JSON.stringify(statementIds)
  useEffect(() => {
    const ids = statementIds as `0x${string}`[] | undefined
    if (!client || !ids || ids.length === 0) return
    let cancelled = false
    void Promise.all(
      ids.map(id => client.readContract({ ...NOTCH_CONTRACT, functionName: 'getStatement', args: [id] }))
    ).then(results => { if (!cancelled) setStmtList(results as StatementData[]) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, statementIdsKey])

  // Fetch disputes for any disputed/resolved statements
  const [disputeMap, setDisputeMap] = useState<Record<string, DisputeData>>({})
  const stmtListKey = JSON.stringify(stmtList.map(s => ({ id: s.statementId, status: s.status, items: s.itemIds })))
  useEffect(() => {
    if (!client || stmtList.length === 0) return
    const disputedStmts = stmtList.filter(s => s.status === 2 || s.status === 3) // Disputed or Resolved
    if (disputedStmts.length === 0) return
    let cancelled = false
    const fetchDisputes = async () => {
      const entries: Record<string, DisputeData> = {}
      await Promise.all(
        disputedStmts.flatMap(stmt =>
          stmt.itemIds.map(async itemId => {
            try {
              const disputeId = await client.readContract({
                ...NOTCH_CONTRACT, functionName: 'disputeByStatementAndItem',
                args: [stmt.statementId, itemId],
              }) as `0x${string}`
              if (disputeId === '0x0000000000000000000000000000000000000000000000000000000000000000') return
              const dispute = await client.readContract({
                ...NOTCH_CONTRACT, functionName: 'getDispute', args: [disputeId],
              }) as DisputeData
              entries[stmt.statementId] = dispute
              // The relayer holds no state between requests, so this is what guarantees a
              // dispute gets arbitrated even if the push at filing time never landed.
              if (dispute.status === 0) pushDispute(disputeId)
            } catch { /* no dispute for this item */ }
          })
        )
      )
      if (!cancelled) setDisputeMap(entries)
    }
    void fetchDisputes()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, stmtListKey])

  const { writeContract: closeCycle, data: closeTx, isPending: isClosing } = useWriteContract()
  const { isLoading: isCloseConfirming, isSuccess: closeSuccess } = useWaitForTransactionReceipt({ hash: closeTx })

  const { writeContract: acceptStatement, data: acceptTx, isPending: isAccepting } = useWriteContract()
  const { isLoading: isAcceptConfirming, isSuccess: acceptSuccess } = useWaitForTransactionReceipt({ hash: acceptTx })

  const { writeContract: settleStatement, data: settleTx, isPending: isSettling } = useWriteContract()
  const { isLoading: isSettleConfirming, isSuccess: settleSuccess } = useWaitForTransactionReceipt({ hash: settleTx })

  const { writeContract: approveUsdc, data: approveTx, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx })

  const refetchAll = () => { void refetchTab(); void refetchCycleItems(); void refetchStatements(); setDisputeMap({}) }

  useEffect(() => {
    if (closeSuccess && closeTx) {
      toast.success('Cycle closed', { action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, closeTx), '_blank') } })
      refetchAll()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSuccess, closeTx])

  useEffect(() => {
    if (acceptSuccess && acceptTx) {
      toast.success('Statement accepted', { action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, acceptTx), '_blank') } })
      void refetchStatements()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptSuccess, acceptTx])

  useEffect(() => {
    if (settleSuccess && settleTx) {
      toast.success('Statement settled — USDC transferred', { action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, settleTx), '_blank') } })
      void refetchStatements()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleSuccess, settleTx])

  useEffect(() => {
    if (approveSuccess) toast.success('USDC approved — you can now settle')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveSuccess])

  if (!tab) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  const isPayer = address?.toLowerCase() === tab.payer.toLowerCase()
  const isPayee = address?.toLowerCase() === tab.payee.toLowerCase()
  const cycleTotalUsdc = cycleItems.reduce((s, i) => s + i.amount, 0n)

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L4 7l5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        All Tabs
      </button>

      {/* Two-column layout on md+ */}
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        {/* Left: Tab metadata card */}
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {/* Faded logo watermark in the background */}
            <img
              src="/notch-logo.svg"
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -12,
                bottom: -8,
                width: 72,
                height: 108,
                opacity: 0.06,
                transform: 'rotate(12deg)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />

            {/* ID + status */}
            <div className="flex items-start justify-between gap-2 relative">
              <p className="mono text-xs leading-5" style={{ color: 'var(--subtle)' }}>
                {tabId.slice(0, 10)}…{tabId.slice(-6)}
              </p>
              <span
                className="pill"
                style={{
                  background: tab.active ? 'var(--success-dim)' : 'var(--surface-3)',
                  color: tab.active ? 'var(--success)' : 'var(--muted)',
                }}
              >
                {tab.active ? 'Active' : 'Closed'}
              </span>
            </div>

            <div className="relative">
              <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--subtle)' }}>Cycle</p>
              <p className="display text-2xl font-bold tabular" style={{ color: 'var(--ink)' }}>
                #{tab.currentCycle.toString()}
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <Pair label="Payer" value={formatAddress(tab.payer)} mono badge={isPayer ? 'you' : undefined} />
              <Pair label="Payee" value={formatAddress(tab.payee)} mono badge={isPayee ? 'you' : undefined} />
              <Pair label="Cycle length" value={`${(Number(tab.cycleSeconds) / 86400).toFixed(3)} days`} />
              <Pair label="Opened" value={formatTimestamp(tab.openedAt)} />
            </div>
          </div>

          {/* Cycle total */}
          {cycleItems.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--subtle)' }}>Cycle total</p>
              <p className="display text-xl font-bold tabular" style={{ color: 'var(--ink)' }}>
                {formatUsdc(cycleTotalUsdc)} <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>USDC</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{cycleItems.length} charge{cycleItems.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>

        {/* Right: charges + statements */}
        <div className="space-y-6">
          {/* Current cycle charges */}
          <section>
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="display font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Current Cycle Charges
              </h3>
              {isPayer && tab.active && (
                <RecordChargeForm tabId={tabId} onRecorded={() => { void refetchCycleItems(); void refetchTab() }} />
              )}
            </div>

            {cycleItems.length === 0 ? (
              <div
                className="rounded-xl py-8 flex flex-col items-center gap-2"
                style={{ background: 'var(--surface)', border: '1px dashed var(--border-2)' }}
              >
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No charges yet</p>
                {isPayer && tab.active && (
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>Record a charge to start accumulating</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {cycleItems.map(item => (
                  <div
                    key={item.itemId}
                    className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {item.memo || '(no memo)'}
                      </p>
                      {item.evidenceUri && (
                        <a
                          href={item.evidenceUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono text-xs truncate block mt-0.5"
                          style={{ color: 'var(--accent)', maxWidth: '240px' }}
                        >
                          {item.evidenceUri.length > 40 ? item.evidenceUri.slice(0, 40) + '…' : item.evidenceUri}
                        </a>
                      )}
                    </div>
                    <span className="tabular font-semibold text-sm whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                      {formatUsdc(item.amount)} USDC
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isPayer && tab.active && cycleItems.length > 0 && (
              <button
                onClick={() => {
                  if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
                  closeCycle({ ...NOTCH_CONTRACT, functionName: 'closeCycle', args: [tabId], chainId: ARC_TESTNET_CHAIN_ID })
                }}
                disabled={isClosing || isCloseConfirming}
                className="mt-3 w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40"
                style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border-2)' }}
              >
                {isClosing ? 'Confirm in wallet…' : isCloseConfirming ? 'Closing cycle…' : 'Close Cycle and Create Statement'}
              </button>
            )}
          </section>

          {/* Statements */}
          <section>
            <h3 className="display font-semibold text-sm uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
              Statements
            </h3>
            {stmtList.length === 0 ? (
              <div
                className="rounded-xl py-8 flex items-center justify-center"
                style={{ background: 'var(--surface)', border: '1px dashed var(--border-2)' }}
              >
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No statements yet — close a cycle to create one</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stmtList.map(stmt => {
                  const stmtItemsInCurrentCycle = cycleItems.filter(i => stmt.itemIds.includes(i.itemId))
                  const computedHash = stmtItemsInCurrentCycle.length === stmt.itemIds.length && stmt.itemIds.length > 0
                    ? computeStatementHash(stmtItemsInCurrentCycle)
                    : null
                  const hashMatch = computedHash !== null && computedHash === stmt.statementHash

                  return (
                    <div
                      key={stmt.statementId}
                      className="rounded-2xl p-4 space-y-4"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      {/* Statement header */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="mono text-xs mb-1" style={{ color: 'var(--subtle)' }}>
                            {stmt.statementId.slice(0, 10)}…{stmt.statementId.slice(-6)}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                            Cycle {stmt.cycle.toString()} · {formatTimestamp(stmt.closedAt)}
                          </p>
                        </div>
                        <StatusBadge status={stmt.status} />
                      </div>

                      {/* Net amount + hash verify */}
                      <div className="flex items-end justify-between gap-2 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                        <div>
                          <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--subtle)' }}>Net Amount</p>
                          <p className="display font-bold text-xl tabular" style={{ color: 'var(--ink)' }}>
                            {formatUsdc(stmt.netAmount)} <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>USDC</span>
                          </p>
                        </div>
                        {computedHash !== null && (
                          <span
                            className="pill"
                            style={{
                              background: hashMatch ? 'var(--success-dim)' : 'var(--danger-dim)',
                              color: hashMatch ? 'var(--success)' : 'var(--danger)',
                            }}
                          >
                            {hashMatch ? 'Hash verified' : 'Hash mismatch'}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {isPayee && stmt.status === 0 && (
                          <button
                            onClick={() => {
                              if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
                              acceptStatement({ ...NOTCH_CONTRACT, functionName: 'acceptStatement', args: [stmt.statementId], chainId: ARC_TESTNET_CHAIN_ID })
                            }}
                            disabled={isAccepting || isAcceptConfirming}
                            className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                            style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid rgba(63,185,80,0.3)' }}
                          >
                            {isAccepting ? 'Confirm…' : 'Accept Statement'}
                          </button>
                        )}

                        {isPayer && (stmt.status === 1 || stmt.status === 3) && (
                          <>
                            <button
                              onClick={() => {
                                if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
                                approveUsdc({
                                  address: USDC_ADDRESS,
                                  abi: erc20Abi,
                                  functionName: 'approve',
                                  args: [NOTCH_CONTRACT.address, stmt.netAmount],
                                  chainId: ARC_TESTNET_CHAIN_ID,
                                })
                              }}
                              disabled={isApproving || isApproveConfirming}
                              className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                              style={{ background: 'var(--surface-3)', color: 'var(--ink)', border: '1px solid var(--border-2)' }}
                            >
                              {isApproving ? 'Confirm…' : 'Approve USDC'}
                            </button>
                            <button
                              onClick={() => {
                                if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error('Switch to Arc Testnet first.'); return }
                                settleStatement({ ...NOTCH_CONTRACT, functionName: 'settleStatement', args: [stmt.statementId], chainId: ARC_TESTNET_CHAIN_ID })
                              }}
                              disabled={isSettling || isSettleConfirming}
                              className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                              style={{ background: 'var(--accent)', color: '#0d1117' }}
                            >
                              {isSettling ? 'Confirm…' : 'Settle'}
                            </button>
                          </>
                        )}

                        {isPayer && stmt.status === 0 && (
                          <DisputePanel statementId={stmt.statementId} itemIds={stmt.itemIds} onDisputed={() => { void refetchStatements(); setDisputeMap({}) }} />
                        )}
                      </div>

                      {/* Dispute ruling — shown for Disputed (2) and Resolved (3) */}
                      {(stmt.status === 2 || stmt.status === 3) && disputeMap[stmt.statementId] && (
                        <DisputeCard dispute={disputeMap[stmt.statementId]} />
                      )}
                      {(stmt.status === 2 || stmt.status === 3) && !disputeMap[stmt.statementId] && (
                        <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
                          <div className="w-3 h-3 rounded-full border border-current animate-spin" style={{ borderTopColor: 'transparent' }} />
                          Loading dispute details…
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const OUTCOME_STYLE: Record<string, { bg: string; color: string }> = {
  upheld:   { bg: 'var(--success-dim)', color: 'var(--success)' },
  adjusted: { bg: 'var(--warning-dim)', color: 'var(--warning)' },
  rejected: { bg: 'var(--danger-dim)',  color: 'var(--danger)' },
}

function DisputeCard({ dispute }: { dispute: DisputeData }) {
  const isPending = dispute.status === 0
  const outcomeStyle = OUTCOME_STYLE[dispute.outcome] ?? { bg: 'var(--surface-3)', color: 'var(--muted)' }

  return (
    <div className="rounded-xl p-4 space-y-3 mt-2" style={{ background: 'rgba(121,192,255,0.04)', border: '1px solid rgba(121,192,255,0.15)' }}>
      {/* Dispute header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--blue)" strokeWidth="1.4"/>
            <path d="M6.5 3.5v3.5M6.5 9h.01" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--blue)' }}>
            {isPending ? 'Dispute Filed — Awaiting Ruling' : 'Ruling'}
          </span>
        </div>
        {!isPending && dispute.outcome && (
          <span className="pill text-xs font-bold uppercase tracking-wide" style={outcomeStyle}>
            {dispute.outcome}
          </span>
        )}
      </div>

      {/* Filed claim */}
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--subtle)' }}>
          Claim · <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--blue)' }}>{dispute.claimKind.replace(/_/g, ' ')}</span>
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>{dispute.claim}</p>
      </div>

      {/* Bond */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--subtle)' }}>Bond posted</p>
          <p className="tabular text-sm font-semibold" style={{ color: 'var(--ink)' }}>{formatUsdc(dispute.bondAmount)} USDC</p>
        </div>
        {!isPending && (
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--subtle)' }}>Bond settled</p>
            <p className="text-sm font-semibold" style={{ color: dispute.bondCredited ? 'var(--success)' : 'var(--muted)' }}>
              {dispute.bondCredited ? 'Credited to winner' : 'Pending'}
            </p>
          </div>
        )}
        {!isPending && dispute.outcome === 'adjusted' && (
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--subtle)' }}>Revised amount</p>
            <p className="tabular text-sm font-semibold" style={{ color: 'var(--warning)' }}>{formatUsdc(dispute.revisedItemAmount)} USDC</p>
          </div>
        )}
      </div>

      {/* Evidence hash check */}
      {!isPending && (
        <div className="flex items-center gap-2">
          <span
            className="pill"
            style={dispute.evidenceHashMatched
              ? { background: 'var(--success-dim)', color: 'var(--success)' }
              : { background: 'var(--danger-dim)', color: 'var(--danger)' }}
          >
            Evidence hash {dispute.evidenceHashMatched ? 'matched' : 'did not match'}
          </span>
          {!dispute.evidenceHashMatched && (
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>No model consulted — hash mismatch decided the ruling</span>
          )}
        </div>
      )}

      {/* Rationale */}
      {!isPending && dispute.rationale && (
        <blockquote
          className="text-sm leading-relaxed rounded-lg px-4 py-3 italic"
          style={{ background: 'var(--surface-2)', borderLeft: '3px solid var(--blue)', color: 'var(--ink-2)' }}
        >
          {dispute.rationale}
          <footer className="mt-2 text-xs not-italic" style={{ color: 'var(--subtle)' }}>
            Gemini arbitrator rationale · stored on-chain · not used in subsequent rulings
          </footer>
        </blockquote>
      )}

      {isPending && (
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          The Gemini relayer will poll this dispute and submit a ruling automatically.
        </p>
      )}
    </div>
  )
}

function Pair({ label, value, mono, badge }: { label: string; value: string; mono?: boolean; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs uppercase tracking-widest font-semibold shrink-0" style={{ color: 'var(--subtle)' }}>{label}</p>
      <div className="flex items-center gap-1.5 min-w-0">
        <p className={`text-xs truncate font-medium${mono ? ' mono' : ''}`} style={{ color: 'var(--ink-2)' }}>{value}</p>
        {badge && (
          <span className="pill" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{badge}</span>
        )}
      </div>
    </div>
  )
}
