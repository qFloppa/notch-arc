/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Must be VITE_-prefixed to reach the browser bundle; baked in at build time.
// Cast because import.meta.env is `any` without an ImportMetaEnv declaration, and
// an unchecked `any` here would flow into http() — same idiom as networks.ts.
const ARC_TESTNET_RPC_URL =
  (import.meta.env.VITE_ARC_TESTNET_RPC_URL as string | undefined) ||
  arcTestnet.rpcUrls.default.http[0]
// Arc mainnet's default hosts answer unauthenticated, unlike testnet's — the
// override exists for parity and for swapping in a dedicated provider.
const ARC_MAINNET_RPC_URL =
  (import.meta.env.VITE_ARC_MAINNET_RPC_URL as string | undefined) ||
  arc.rpcUrls.default.http[0]

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, ARC_TESTNET_RPC_URL)
registerChain(arc.id, ARC_MAINNET_RPC_URL)

export const config = createConfig({
  // arcTestnet first: wagmi's own default chain, and Notch's default network.
  // `mainnet` here is ETHEREUM, for ENS resolution only — Arc mainnet is `arc`.
  chains: [arcTestnet, arc, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(ARC_TESTNET_RPC_URL),
    [arc.id]: http(ARC_MAINNET_RPC_URL),
    [mainnet.id]: http(), // ENS resolution uses Ethereum mainnet
  },
})
