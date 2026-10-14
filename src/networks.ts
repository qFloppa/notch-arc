/**
 * networks.ts — which Arc network is active, and where Notch lives on it.
 *
 * The connected wallet's chain IS the selection. A separate "selected network"
 * value could disagree with what the wallet actually signs, and on mainnet that
 * disagreement spends real USDC, so there is deliberately no such state.
 *
 * resolveNetwork() is pure and takes the address map, so it is checkable without a
 * DOM, a wallet, or Vite's env — see networks.test.ts.
 */

import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { arc, arcTestnet } from 'viem/chains'
import { requireChain } from '@/onchain-facts'
import artifact from '../contracts/out/Notch.sol/Notch.json'

export const ARC_TESTNET_ID = arcTestnet.id
export const ARC_MAINNET_ID = arc.id

export type NotchAddresses = Partial<Record<number, `0x${string}`>>

/**
 * Deployed Notch per chain. Testnet has a literal fallback because it is long
 * deployed; mainnet is env-only and absent until the operator deploys it.
 * Must be VITE_-prefixed to reach the browser bundle; baked in at build time.
 */
export const NOTCH_ADDRESSES: NotchAddresses = {
  [ARC_TESTNET_ID]:
    (import.meta.env.VITE_NOTCH_ADDRESS_ARC_TESTNET as `0x${string}` | undefined) ??
    '0x53F07375799558592Ea90344d14495D007C30f97',
  [ARC_MAINNET_ID]: import.meta.env.VITE_NOTCH_ADDRESS_ARC as `0x${string}` | undefined,
}

/** Gates the switcher's mainnet segment — false until Notch is deployed to Arc mainnet. */
export const MAINNET_AVAILABLE = !!NOTCH_ADDRESSES[ARC_MAINNET_ID]

/**
 * The chainId whose Notch deployment the UI should read and write.
 *
 * Only ever returns a chain that HAS an address, so callers never handle
 * `undefined`. A wallet on Arc mainnet before the mainnet deploy therefore lands on
 * testnet, where `isWalletOnNetwork` is false and writes are blocked.
 */
export function resolveNetwork(
  walletChainId: number | undefined,
  hostname: string,
  addresses: NotchAddresses = NOTCH_ADDRESSES,
): number {
  if (walletChainId !== undefined && addresses[walletChainId]) return walletChainId
  if (hostname.startsWith('mainnet.') && addresses[ARC_MAINNET_ID]) return ARC_MAINNET_ID
  return ARC_TESTNET_ID
}

export function useNotch() {
  const { chainId: walletChainId } = useAccount()
  const chainId = resolveNetwork(walletChainId, window.location.hostname)
  // Non-null is sound: resolveNetwork only returns chains present in the map.
  const address = NOTCH_ADDRESSES[chainId]!
  // Memoised so consumers can list `notch.contract` in a useEffect dependency array
  // honestly. A fresh object each render would re-run those effects every render.
  const contract = useMemo(() => ({ address, abi: artifact.abi, chainId }), [address, chainId])
  return {
    chainId,
    name: requireChain(chainId).name,
    isTestnet: chainId === ARC_TESTNET_ID,
    isWalletOnNetwork: walletChainId === chainId,
    /** Spread into any wagmi contract hook — address, abi and chainId travel together. */
    contract,
  }
}
