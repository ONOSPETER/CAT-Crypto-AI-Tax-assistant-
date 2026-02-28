import { db } from "./server/db";
import { wallets, transactions } from "./shared/schema";

async function main() {
  const existingWallets = await db.select().from(wallets);
  if (existingWallets.length === 0) {
    const [wallet] = await db.insert(wallets).values({
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      chain: "Ethereum",
      label: "Main Vault",
    }).returning();

    await db.insert(transactions).values([
      {
        walletId: wallet.id,
        txHash: "0x123abc...",
        chain: "Ethereum",
        timestamp: new Date("2023-01-15T10:00:00Z"),
        fromAddress: "0x...",
        toAddress: wallet.address,
        token: "ETH",
        amount: "1.5",
        usdValue: "2500.00",
        gasFeeUsd: "15.00",
        eventType: "trade"
      },
      {
        walletId: wallet.id,
        txHash: "0x456def...",
        chain: "Ethereum",
        timestamp: new Date("2023-02-20T12:30:00Z"),
        fromAddress: wallet.address,
        toAddress: "0x...",
        token: "ETH",
        amount: "0.5",
        usdValue: "800.00",
        gasFeeUsd: "12.00",
        eventType: "transfer"
      }
    ]);
    console.log("Database seeded!");
  } else {
    console.log("Database already seeded.");
  }
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
