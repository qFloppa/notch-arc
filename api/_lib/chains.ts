/** Per-network relayer configuration, separate from clients so routing is testable. */
import { arc, arcTestnet } from 'viem/chains'
import type { Chain } from 'viem'

export const ARC_TESTNET_ID = arcTestnet.id
export const ARC_MAINNET_ID = arc.id

// Older browser bundles omit chainId. They must never spend mainnet gas.
export const DEFAULT_RELAYER_CHAIN_ID = ARC_TESTNET_ID

function testnetRpc(): string {
  if (process.env.ARC_TESTNET_RPC_URL) return process.env.ARC_TESTNET_RPC_URL
  const proxyBase = process.env.RPC_PROXY_BASE_URL
  const proxyToken = process.env.RPC_PROXY_TOKEN
  const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',')
  if (proxyBase && proxyToken && proxyChains.includes('Arc_Testnet')) {
    return `${proxyBase}/api/rpc/Arc_Testnet?_rpc_token=${proxyToken}`
  }
  return arcTestnet.rpcUrls.default.http[0]
}

export interface RelayerChain {
  chain: Chain
  rpcUrl: string
  contract?: `0x${string}`
  label: string
  contractEnvVar: string
  arbitratorKeyEnvVar: 'ARBITRATOR_PRIVATE_KEY' | 'ARBITRATOR_PRIVATE_KEY_ARC'
}

export const RELAYER_CHAINS: Record<number, RelayerChain> = {
  [ARC_TESTNET_ID]: {
    chain: arcTestnet,
    rpcUrl: testnetRpc(),
    // Keep legacy deployments working; the current, unprefixed name takes priority.
    contract: (process.env.NOTCH_CONTRACT_ADDRESS || process.env.VITE_NOTCH_CONTRACT_ADDRESS) as `0x${string}` | undefined,
    label: 'Arc Testnet',
    contractEnvVar: 'NOTCH_CONTRACT_ADDRESS',
    arbitratorKeyEnvVar: 'ARBITRATOR_PRIVATE_KEY',
  },
  [ARC_MAINNET_ID]: {
    chain: arc,
    rpcUrl: process.env.ARC_MAINNET_RPC_URL || arc.rpcUrls.default.http[0],
    contract: (process.env.NOTCH_CONTRACT_ADDRESS_ARC || undefined) as `0x${string}` | undefined,
    label: 'Arc',
    contractEnvVar: 'NOTCH_CONTRACT_ADDRESS_ARC',
    arbitratorKeyEnvVar: 'ARBITRATOR_PRIVATE_KEY_ARC',
  },
}

export type ChainResolution =
  | { ok: true; chainId: number }
  | { ok: false; error: string }

/** Accept a known Arc chain number or numeric string; default only if omitted. */
export function resolveRelayerChain(chainId: unknown): ChainResolution {
  if (chainId === undefined || chainId === null) {
    return { ok: true, chainId: DEFAULT_RELAYER_CHAIN_ID }
  }
  const n = typeof chainId === 'number' ? chainId
    : typeof chainId === 'string' && /^\d+$/.test(chainId) ? Number(chainId)
    : Number.NaN
  if (!Number.isInteger(n) || !RELAYER_CHAINS[n]) {
    return { ok: false, error: `unsupported chainId: ${String(chainId)}` }
  }
  return { ok: true, chainId: n }
}
