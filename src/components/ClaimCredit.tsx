import { useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'
import { formatUsdc } from '../notch-contract'
import { useNotch } from '../networks'
import { buildTxExplorerUrl } from '@/onchain-facts'

const ZERO = '0x0000000000000000000000000000000000000000' as const

/**
 * Global claimable-balance banner. Credits (won dispute bonds) are per-wallet, not
 * per-tab, so this lives above every view — the payee can claim without first finding
 * a tab they can see. Renders nothing when there's nothing to claim.
 */
export default function ClaimCredit() {
  const { address } = useAccount()
  const notch = useNotch()

  const { data: creditRaw, refetch } = useReadContract({
    ...notch.contract,
    functionName: 'getCredit',
    args: [address ?? ZERO],
    // ponytail: poll so a ruling that lands while the payee waits here shows up on its own.
    query: { enabled: !!address, refetchInterval: 10_000 },
  })
  const credit = (creditRaw as bigint | undefined) ?? 0n

  const { writeContract, data: tx, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: tx, chainId: notch.chainId })

  useEffect(() => {
    if (isSuccess && tx) {
      toast.success('Claimed to your wallet', {
        action: { label: 'Explorer', onClick: () => window.open(buildTxExplorerUrl(notch.chainId, tx), '_blank') },
      })
      void refetch()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, tx])

  if (!address || credit === 0n) return null

  return (
    <div
      className="mb-6 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ background: 'var(--surface)', border: '1px solid rgba(63,185,80,0.3)' }}
    >
      <div>
        <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--subtle)' }}>Claimable balance</p>
        <p className="display text-xl font-bold tabular" style={{ color: 'var(--success)' }}>
          {formatUsdc(credit)} <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>USDC</span>
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
          Won dispute bonds, held in the Notch contract. Claim to move them to your wallet.
        </p>
      </div>
      <button
        onClick={() => {
          if (!notch.isWalletOnNetwork) { toast.error(`Switch to ${notch.name} first.`); return }
          writeContract({ ...notch.contract, functionName: 'withdraw', args: [credit] })
        }}
        disabled={isPending || isConfirming}
        className="py-2.5 px-5 rounded-xl font-semibold text-sm disabled:opacity-40 shrink-0"
        style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid rgba(63,185,80,0.3)' }}
      >
        {isPending ? 'Confirm in wallet…' : isConfirming ? 'Claiming…' : `Claim ${formatUsdc(credit)} USDC`}
      </button>
    </div>
  )
}
