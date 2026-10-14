/** Server rendering only; no browser or live wallet. Run: bun src/components/BondSettings.test.ts */
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { mock } from 'wagmi/connectors'
import { readContractQueryKey } from 'wagmi/query'
import { arc, arcTestnet } from 'viem/chains'
import artifact from '../../contracts/out/Notch.sol/Notch.json'
import { NOTCH_ADDRESSES } from '../networks'
import BondSettings from './BondSettings'

const OWNER = '0x1111111111111111111111111111111111111111' as const
const OTHER = '0x2222222222222222222222222222222222222222' as const
const CONTRACT = '0x3333333333333333333333333333333333333333' as const
const originalAddress = NOTCH_ADDRESSES[arc.id]
const originalWindow = globalThis.window
NOTCH_ADDRESSES[arc.id] = CONTRACT
;(globalThis as { window?: unknown }).window = { location: { hostname: 'mainnet.notch.bond' } }

function render(chainId: number, account: `0x${string}` | undefined, bond?: bigint, bondError = false) {
  const config = createConfig({
    chains: [arc, arcTestnet], connectors: [mock({ accounts: [OWNER] })], storage: null,
    ssr: true, multiInjectedProviderDiscovery: false,
    transports: { [arc.id]: http('http://127.0.0.1:1'), [arcTestnet.id]: http('http://127.0.0.1:1') },
  })
  const connector = config.connectors[0]
  const connections = new Map<string, { accounts: readonly [`0x${string}`]; chainId: number; connector: typeof connector }>()
  if (account) connections.set(connector.uid, { accounts: [account], chainId, connector })
  config.setState(state => ({
    ...state, chainId: chainId as typeof arc.id | typeof arcTestnet.id,
    status: account ? 'connected' : 'disconnected', current: account ? connector.uid : null,
    connections,
  }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const address = NOTCH_ADDRESSES[chainId]!
  const key = (functionName: string) => readContractQueryKey({ address, abi: artifact.abi, chainId, functionName })
  queryClient.setQueryData(key('owner'), OWNER)
  if (bond !== undefined) queryClient.setQueryData(key('bondAmount'), bond)
  if (bondError) queryClient.getQueryCache().find({ queryKey: key('bondAmount') })?.setState({ status: 'error', error: new Error('offline') })
  const html = renderToStaticMarkup(createElement(WagmiProvider, { config, reconnectOnMount: false },
    createElement(QueryClientProvider, { client: queryClient }, createElement(BondSettings))))
  queryClient.clear()
  return html
}

try {
  const ownerView = render(arc.id, OWNER, 2_500_001n)
  assert.match(ownerView, /Mainnet dispute bond/)
  assert.match(ownerView, /2\.500001 USDC/)
  assert.match(ownerView, /Update bond amount/)
  assert.match(ownerView, /Existing disputes keep their original bond/)
  assert.equal(render(arc.id, OTHER, 2_500_001n), '', 'a non-owner must never see the editor')
  assert.equal(render(arc.id, undefined, 2_500_001n), '', 'a disconnected wallet must never see the editor')
  assert.equal(render(arcTestnet.id, OWNER, 1_000_000n), '', 'the editor is mainnet-only')
  assert.match(render(arc.id, OWNER), /Loading/)
  assert.match(render(arc.id, OWNER, 2_500_001n, true), /Unavailable/)
} finally {
  NOTCH_ADDRESSES[arc.id] = originalAddress
  ;(globalThis as { window?: unknown }).window = originalWindow
}
console.log('bond settings rendering: all assertions passed')
