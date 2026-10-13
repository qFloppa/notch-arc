/**
 * tab-store.ts — localStorage-backed tab ID registry.
 * Neither Arc network's public RPC supports eth_getLogs, so we store tabIds
 * locally after each openTab transaction.
 *
 * Keyed by chainId as well as wallet: a tabId exists only on the chain whose
 * contract minted it, so sharing one registry across networks would render
 * testnet tabs in the mainnet view as zeroed phantom tabs.
 */

const KEY_PREFIX = 'notch:tabs:'

function storageKey(chainId: number, address: string): string {
  return `${KEY_PREFIX}${chainId}:${address.toLowerCase()}`
}

export function getStoredTabIds(chainId: number, address: string): `0x${string}`[] {
  try {
    const raw = localStorage.getItem(storageKey(chainId, address))
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return parsed.filter((id): id is `0x${string}` => typeof id === 'string' && id.startsWith('0x'))
  } catch {
    return []
  }
}

export function addStoredTabId(chainId: number, address: string, tabId: `0x${string}`): void {
  try {
    const existing = getStoredTabIds(chainId, address)
    if (!existing.includes(tabId)) {
      localStorage.setItem(storageKey(chainId, address), JSON.stringify([...existing, tabId]))
    }
  } catch {
    // localStorage unavailable — no-op
  }
}
