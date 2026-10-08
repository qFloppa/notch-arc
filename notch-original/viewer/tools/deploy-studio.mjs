import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createAccount, createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { succeeded, refusal } from "../lib/chain.ts";

try { process.loadEnvFile("../.env"); } catch { /* hosted environment */ }
if (!process.env.SELLER_KEY || !process.env.BUYER_KEY) throw new Error("Set SELLER_KEY and BUYER_KEY in the repository .env");
const seller = createAccount(process.env.SELLER_KEY);
const buyer = createAccount(process.env.BUYER_KEY);
const client = createClient({ chain: studioDevnet, account: seller });
const chainId = await client.getChainId();
if (chainId !== 61997) throw new Error(`Wrong chain: ${chainId}`);
const code = readFileSync("../contracts/notch.py");
console.log("Network", chainId, studioDevnet.rpcUrls.default.http[0]);
console.log("Source SHA-256", createHash("sha256").update(code).digest("hex"));
const resumeHash = process.argv.find((arg) => /^0x[0-9a-fA-F]{64}$/.test(arg));
let hash = resumeHash;
if (!hash) {
  if (!process.argv.includes("--deploy")) throw new Error("Use --deploy to deploy, or pass a deployment transaction hash to resume verification");
  for (const account of [seller, buyer]) {
    if (await client.getBalance({ address: account.address }) < 20n * 10n ** 18n) {
      await client.request({ method: "sim_fundAccount", params: [account.address, "0x56bc75e2d63100000"] });
    }
    console.log("Demo balance", account.address, String(await client.getBalance({ address: account.address })));
  }
  const fees = await client.estimateTransactionFees();
  console.log("Quoted deployment fee deposit (atto GEN)", String(fees.feeValue));
  hash = await client.deployContract({ code, args: [10n ** 18n, 3600n, 10n ** 19n], fees });
}
console.log("Deployment transaction", hash);
console.log(`https://explorer-studio-dev.genlayer.com/tx/${hash}`);
const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: "decided", interval: 5000, retries: 120 });
if (!succeeded(receipt)) throw new Error(refusal(receipt) || "Deployment failed");
const address = receipt.data?.contract_address ?? receipt.contractAddress ?? receipt.to_address ?? receipt.to;
if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) {
  console.log("Receipt fields", JSON.stringify(receipt, (_, v) => typeof v === "bigint" ? String(v) : v));
  throw new Error("No contract address in receipt");
}
for (const [functionName, expected] of [["get_bond_atto", 10n ** 18n], ["get_dispute_window_seconds", 3600n], ["get_base_credit_atto", 10n ** 19n]]) {
  const value = await client.readContract({ address, functionName, args: [] });
  if (BigInt(value) !== expected) throw new Error(`${functionName} readback mismatch`);
  console.log(functionName, String(value));
}
console.log(`STUDIO_NEXT_ADDRESS=${address}`);
console.log(`STUDIO_NEXT_DEPLOY_TX=${hash}`);
console.log(`https://explorer-studio-dev.genlayer.com/address/${address}`);
