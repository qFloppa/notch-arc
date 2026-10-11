/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Must be VITE_-prefixed to reach the browser bundle; baked in at build time.
const ARC_RPC_URL =
  import.meta.env.VITE_ARC_TESTNET_RPC_URL || arcTestnet.rpcUrls.default.http[0]

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, ARC_RPC_URL)

export const config = createConfig({
  chains: [arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(ARC_RPC_URL),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
