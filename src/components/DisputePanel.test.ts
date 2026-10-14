/** Server rendering only; no browser or live wallet. Run: bun src/components/DisputePanel.test.ts */
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { mock } from 'wagmi/connectors'
import { getBlockQueryKey, readContractQueryKey } from 'wagmi/query'
import { arc, arcTestnet } from 'viem/chains'
import artifact from '../../contracts/out/Notch.sol/Notch.json'
import { NOTCH_ADDRESSES } from '../networks'
import DisputePanel from './DisputePanel'

const OWNER = '0x1111111111111111111111111111111111111111' as const
const CONTRACT = '0x3333333333333333333333333333333333333333' as const
const ID = `0x${'11'.repeat(32)}` as const
const originalAddress = NOTCH_ADDRESSES[arc.id]
const originalWindow = globalThis.window
NOTCH_ADDRESSES[arc.id] = CONTRACT
;(globalThis as { window?: unknown }).window = { location: { hostname: 'mainnet.notch.bond' } }

function render(chainId: number, timestamp?: bigint, seconds?: bigint, readError = false) {
  const config = createConfig({
    chains: [arc, arcTestnet], connectors: [mock({ accounts: [OWNER] })], storage: null,
    ssr: true, multiInjectedProviderDiscovery: false,
    transports: { [arc.id]: http('http://127.0.0.1:1'), [arcTestnet.id]: http('http://127.0.0.1:1') },
  })
  const connector = config.connectors[0]
  config.setState(state => ({ ...state, chainId: chainId as typeof arc.id | typeof arcTestnet.id,
    status: 'connected', current: connector.uid,
    connections: new Map([[connector.uid, { accounts: [OWNER], chainId, connector }]]),
  }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const key = readContractQueryKey({ address: NOTCH_ADDRESSES[chainId]!, abi: artifact.abi, chainId, functionName: 'disputeWindowSeconds' })
  if (seconds !== undefined) queryClient.setQueryData(key, seconds)
  if (readError) queryClient.getQueryCache().find({ queryKey: key })?.setState({ status: 'error', error: new Error('offline') })
  if (timestamp !== undefined) queryClient.setQueryData(getBlockQueryKey({ chainId }), { timestamp })
  const html = renderToStaticMarkup(createElement(WagmiProvider, { config, reconnectOnMount: false },
    createElement(QueryClientProvider, { client: queryClient },
      createElement(DisputePanel, { statementId: ID, closedAt: 1000n, itemIds: [ID], onDisputed() {} }))))
  queryClient.clear()
  return html
}

try {
  for (const chain of [arc, arcTestnet]) {
    const expired = render(chain.id, 4601n, 3600n)
    assert.match(expired, /Dispute window expired/, 'an expired statement explains why filing is unavailable')
    assert.match(expired, /Disputes closed/, 'the cutoff remains visible')
    assert.doesNotMatch(expired, /<button/, 'expired statements expose no approval or filing controls')
    const available = render(chain.id, 4599n, 3600n)
    assert.match(available, /Dispute deadline/)
    assert.match(available, /1s remaining/)
    assert.match(available, /File Dispute/)
    assert.doesNotMatch(available, /<button[^>]*\sdisabled=/, 'an open window enables the form')
    assert.match(render(chain.id, 4601n, 7200n), /File Dispute/, 'extended windows update the UI')
  }
  assert.match(render(arc.id), /Checking dispute deadline/)
  assert.match(render(arc.id), /<button[^>]*\sdisabled=/, 'loading cannot enable filing')
  assert.match(render(arc.id, undefined, 3600n), /<button[^>]*\sdisabled=/, 'unknown chain time cannot enable filing')
  assert.match(render(arc.id, 4601n), /<button[^>]*\sdisabled=/, 'unknown window cannot enable filing')
  assert.match(render(arc.id, 4601n, 3600n, true), /Could not verify the dispute deadline/)
} finally {
  NOTCH_ADDRESSES[arc.id] = originalAddress
  ;(globalThis as { window?: unknown }).window = originalWindow
}
console.log('dispute panel deadline rendering: all assertions passed')
