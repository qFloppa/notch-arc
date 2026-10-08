import { readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey } from "viem/accounts";

const template = readFileSync("../.env.example", "utf8");
const env = template
  .replace("SELLER_KEY=0x...", `SELLER_KEY=${generatePrivateKey()}`)
  .replace("BUYER_KEY=0x...", `BUYER_KEY=${generatePrivateKey()}`);
writeFileSync("../.env", env, { flag: "wx", mode: 0o600 });
console.log("Created repository .env with two throwaway demo accounts. Existing files are never overwritten.");
