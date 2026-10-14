import { parseAbi, type Address, type PublicClient } from 'viem'

export type DisputeWindow = { deadline: bigint; remaining: bigint; expired: boolean }

/** Mirrors Notch's inclusive deadline, using chain time rather than the local clock. */
export function getDisputeWindow(closedAt: bigint, seconds: bigint | undefined, timestamp: bigint | undefined): DisputeWindow | undefined {
  if (closedAt <= 0n || seconds === undefined || seconds <= 0n || timestamp === undefined) return undefined
  const deadline = closedAt + seconds
  return { deadline, remaining: timestamp < deadline ? deadline - timestamp : 0n, expired: timestamp > deadline }
}

const windowAbi = parseAbi(['function disputeWindowSeconds() view returns (uint256)'])

/** Re-read before either wallet action; pin the owner setting to the timestamp's block. */
export async function readDisputeWindow(client: Pick<PublicClient, 'getBlock' | 'readContract'>, address: Address, closedAt: bigint) {
  const block = await client.getBlock()
  if (block.number === null) throw new Error('Could not read the latest chain time.')
  const windowSeconds = await client.readContract({ address, abi: windowAbi, functionName: 'disputeWindowSeconds', blockNumber: block.number })
  const window = getDisputeWindow(closedAt, windowSeconds, block.timestamp)
  if (!window) throw new Error('Could not verify the dispute deadline.')
  return { ...window, windowSeconds, block }
}
