/**
 * tab-store.ts — localStorage-backed tab ID registry.
 * Arc Testnet's public RPC does not support eth_getLogs,
 * so we store tabIds locally after each openTab transaction.
 */

const KEY_PREFIX = 'notch:tabs:'

function storageKey(address: string): string {
  return KEY_PREFIX + address.toLowerCase()
}

export function getStoredTabIds(address: string): `0x${string}`[] {
  try {
    const raw = localStorage.getItem(storageKey(address))
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return parsed.filter((id): id is `0x${string}` => typeof id === 'string' && id.startsWith('0x'))
  } catch {
    return []
  }
}

export function addStoredTabId(address: string, tabId: `0x${string}`): void {
  try {
    const existing = getStoredTabIds(address)
    if (!existing.includes(tabId)) {
      localStorage.setItem(storageKey(address), JSON.stringify([...existing, tabId]))
    }
  } catch {
    // localStorage unavailable — no-op
  }
}
