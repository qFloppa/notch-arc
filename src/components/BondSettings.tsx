import { useEffect, useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits } from 'viem'
import { toast } from 'sonner'
import { parseBondAmount } from '../bond'
import { formatUsdc } from '../notch-contract'
import { ARC_MAINNET_ID, useNotch } from '../networks'
import { buildTxExplorerUrl } from '@/onchain-facts'

/** Mainnet administration; the contract also enforces onlyOwner on every write. */
export default function BondSettings() {
  const { address } = useAccount()
  const notch = useNotch()
  const [amount, setAmount] = useState('')
  const isMainnet = notch.chainId === ARC_MAINNET_ID
  const { data: owner, isError: ownerError, isFetching: ownerFetching } = useReadContract({
    ...notch.contract,
    functionName: 'owner',
    query: { enabled: isMainnet && !!address, refetchInterval: 10_000 },
  })
  const isOwner = !!address && typeof owner === 'string' && address.toLowerCase() === owner.toLowerCase()
  const { data: bondRaw, isError: bondError, isFetching: bondFetching, refetch: refetchBond } = useReadContract({
    ...notch.contract,
    functionName: 'bondAmount',
    query: { enabled: isMainnet && isOwner, refetchInterval: 10_000 },
  })
  const bond = typeof bondRaw === 'bigint' && bondRaw > 0n ? bondRaw : undefined
  const newBond = parseBondAmount(amount)
  const { writeContract, data: tx, isPending, error } = useWriteContract()
  const { data: receipt, isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash: tx, chainId: notch.chainId })

  useEffect(() => {
    if (!isSuccess || !receipt || !tx) return
    if (receipt.status === 'reverted') {
      toast.error('Bond update reverted.')
      return
    }
    toast.success('Mainnet dispute bond updated', {
      action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(notch.chainId, tx), '_blank') },
    })
    void refetchBond()
  }, [isSuccess, receipt, tx, notch.chainId, refetchBond])

  if (!isMainnet || !isOwner) return null

  const busy = isPending || isConfirming
  const readsReady = !ownerError && !ownerFetching && bond !== undefined && !bondError && !bondFetching

  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <h4 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Mainnet dispute bond</h4>
      </div>
      <form className="p-5 space-y-4" onSubmit={event => {
        event.preventDefault()
        if (!notch.isWalletOnNetwork) { toast.error(`Switch to ${notch.name} first.`); return }
        if (!isOwner || !readsReady || newBond === null || newBond === bond || busy) return
        writeContract({ ...notch.contract, functionName: 'setBondAmount', args: [newBond] })
      }}>
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
          Current bond: <span className="font-semibold tabular" style={{ color: 'var(--ink)' }}>{bondError ? 'Unavailable' : bond === undefined ? 'Loading…' : `${formatUsdc(bond)} USDC`}</span>
        </p>
        <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: '1.6' }}>
          Changes apply to new disputes. Existing disputes keep their original bond. Only the contract owner can change this amount.
        </p>
        <div>
          <label htmlFor="mainnet-bond-amount" className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-2)' }}>New bond amount (USDC)</label>
          <input id="mainnet-bond-amount" type="text" inputMode="decimal" value={amount}
            onChange={event => setAmount(event.target.value)} disabled={busy}
            placeholder={bond === undefined ? 'e.g. 1.00' : formatUnits(bond, 6)}
            aria-describedby="mainnet-bond-help" aria-invalid={amount.trim() !== '' && newBond === null}
          />
          <p id="mainnet-bond-help" className="text-xs mt-1.5" style={{ color: amount.trim() !== '' && newBond === null ? 'var(--danger)' : 'var(--subtle)' }}>
            Enter a positive USDC amount with up to 6 decimal places.
          </p>
        </div>
        {(ownerError || bondError) && <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>Could not read the current bond settings. Retrying…</p>}
        {error && <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>{error.message.split('\n')[0]}</p>}
        {receiptError && <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>Could not confirm the transaction. Check its status on the explorer.</p>}
        <button type="submit" disabled={busy || !readsReady || !notch.isWalletOnNetwork || newBond === null || newBond === bond}
          className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-2)' }}>
          {isPending ? 'Confirm in wallet…' : isConfirming ? 'Updating bond…' : 'Update bond amount'}
        </button>
        {tx && <a href={buildTxExplorerUrl(notch.chainId, tx)} target="_blank" rel="noopener noreferrer" className="block text-xs font-semibold" style={{ color: 'var(--accent)' }}>View bond update on explorer</a>}
      </form>
    </section>
  )
}
