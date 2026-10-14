import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { useNotch, MAINNET_AVAILABLE, ARC_TESTNET_ID, ARC_MAINNET_ID } from '../networks'
import NotchLogo from './NotchLogo'

/**
 * The switcher drives the WALLET's chain, not a separate app-level selection —
 * see networks.ts. So the active segment always reflects what will actually sign.
 */
export default function Header() {
  const notch = useNotch()
  const { isConnected } = useAccount()
  const { switchChain, isPending } = useSwitchChain()

  const segments = [
    { id: ARC_TESTNET_ID, label: 'Testnet', available: true },
    { id: ARC_MAINNET_ID, label: 'Mainnet', available: MAINNET_AVAILABLE },
  ]

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: 'rgba(13,17,23,0.85)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="max-w-5xl mx-auto px-2 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo — the notch tally-stick render at 28px, slightly rotated for character */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-11 flex items-center justify-center shrink-0">
            <NotchLogo width={22} height={44} rotate={-6} />
          </div>
          <span className="hidden sm:inline display font-semibold text-base" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Notch
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Arc network"
            className="flex items-center gap-0.5 p-0.5 rounded-lg"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            {segments.map(({ id, label, available }) => {
              const active = notch.chainId === id
              const isMainnet = id === ARC_MAINNET_ID
              return (
                <button
                  key={id}
                  onClick={() => switchChain({ chainId: id }, {
                    onError: () => toast.error('Network switch was cancelled or failed.'),
                  })}
                  disabled={!isConnected || isPending || active || !available}
                  aria-pressed={active}
                  title={!available ? 'Not deployed to Arc mainnet yet' : !isConnected ? 'Connect your wallet to switch networks' : undefined}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md disabled:cursor-default"
                  style={{
                    background: active
                      ? isMainnet ? 'var(--danger-dim)' : 'var(--accent-dim)'
                      : 'transparent',
                    color: active
                      ? isMainnet ? 'var(--danger)' : 'var(--accent)'
                      : available ? 'var(--muted)' : 'var(--subtle)',
                    opacity: available ? 1 : 0.4,
                  }}
                >
                  {isPending && !active ? '…' : label}
                </button>
              )
            })}
          </div>

          {isConnected && !notch.isWalletOnNetwork && (
            <button
              onClick={() => switchChain({ chainId: notch.chainId }, {
                onError: () => toast.error('Network switch was cancelled or failed.'),
              })}
              disabled={isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(248,81,73,0.25)' }}
            >
              <span className="sm:hidden">{isPending ? '…' : 'Switch'}</span>
              <span className="hidden sm:inline">{isPending ? 'Switching…' : `Switch to ${notch.name}`}</span>
            </button>
          )}
          <ConnectKitButton />
        </div>
      </div>
    </header>
  )
}
