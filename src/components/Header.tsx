import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { ARC_TESTNET_CHAIN_ID } from '../notch-contract'

export default function Header() {
  const { chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const wrongChain = chainId !== undefined && chainId !== ARC_TESTNET_CHAIN_ID

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
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo — the notch tally-stick at 28px, slightly rotated for character */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-11 flex items-center justify-center shrink-0">
            <img
              src="/notch-logo.svg"
              alt="Notch logo"
              style={{
                width: 28,
                height: 42,
                transform: 'rotate(-6deg)',
                filter: 'drop-shadow(0 2px 6px rgba(58,130,246,0.4))',
              }}
            />
          </div>
          <span className="display font-semibold text-base" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Notch
          </span>
          <span
            className="pill hidden sm:inline-flex"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            Arc Testnet
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {wrongChain && (
            <button
              onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
              disabled={isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(248,81,73,0.25)' }}
            >
              {isPending ? 'Switching…' : 'Switch to Arc'}
            </button>
          )}
          <ConnectKitButton />
        </div>
      </div>
    </header>
  )
}
