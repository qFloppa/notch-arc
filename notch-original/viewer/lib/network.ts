export const NETWORK = {
  name: "Studio Next",
  chainId: 61997,
  rpcUrl: "https://studio-dev.genlayer.com/api",
  explorer: "https://explorer-studio-dev.genlayer.com",
} as const;

export const contractUrl = (address: string) => `${NETWORK.explorer}/address/${address}`;
export const transactionUrl = (hash: string) => `${NETWORK.explorer}/tx/${hash}`;
