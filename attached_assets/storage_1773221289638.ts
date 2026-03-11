import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  wallets,
  transactions,
  taxReports,
  type Wallet,
  type InsertWallet,
  type Transaction,
  type InsertTransaction,
  type TaxReport,
  type InsertTaxReport,
} from "@shared/schema";

export interface IStorage {
  // Wallets
  getWallets(userId: string): Promise<Wallet[]>;
  getWallet(id: number): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet & { userId: string }): Promise<Wallet>;
  deleteWallet(id: number): Promise<void>;
  updateWalletBalance(id: number, balance: string, balanceUsd: string): Promise<void>;

  // Transactions
  getTransactions(userId: string): Promise<Transaction[]>;
  getTransactionsByWallet(walletId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  // Upsert: inserts only if txHash+walletId combo doesn't already exist
  upsertTransaction(transaction: InsertTransaction): Promise<void>;

  // Reports
  getReports(userId: string): Promise<TaxReport[]>;
  getReport(id: number): Promise<TaxReport | undefined>;
  createReport(report: InsertTaxReport & { userId: string }): Promise<TaxReport>;
  updateReport(id: number, updates: Partial<InsertTaxReport>): Promise<TaxReport>;

  // Intercom
  getMessages(userId: string): Promise<any[]>;
  createMessage(content: string, sender: string, userId: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // ── Wallets ────────────────────────────────────────────────────────────────

  async getWallets(userId: string): Promise<Wallet[]> {
    return await db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async getWallet(id: number): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
    return wallet;
  }

  async createWallet(insertWallet: InsertWallet & { userId: string }): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values(insertWallet).returning();
    return wallet;
  }

  async deleteWallet(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.walletId, id));
    await db.delete(wallets).where(eq(wallets.id, id));
  }

  async updateWalletBalance(id: number, balance: string, balanceUsd: string): Promise<void> {
    await db.update(wallets)
      .set({ balance, balanceUsd })
      .where(eq(wallets.id, id));
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  async getTransactions(userId: string): Promise<Transaction[]> {
    return await db.select({
      id: transactions.id,
      walletId: transactions.walletId,
      txHash: transactions.txHash,
      chain: transactions.chain,
      timestamp: transactions.timestamp,
      fromAddress: transactions.fromAddress,
      toAddress: transactions.toAddress,
      token: transactions.token,
      amount: transactions.amount,
      usdValue: transactions.usdValue,
      gasFeeUsd: transactions.gasFeeUsd,
      eventType: transactions.eventType,
    })
      .from(transactions)
      .innerJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(eq(wallets.userId, userId));
  }

  async getTransactionsByWallet(walletId: number): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.walletId, walletId));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  /**
   * Inserts a transaction only if a record with the same walletId + txHash
   * does not already exist. This prevents duplicate rows accumulating every
   * time a wallet is synced.
   */
  async upsertTransaction(insertTransaction: InsertTransaction): Promise<void> {
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.walletId, insertTransaction.walletId!),
          eq(transactions.txHash, insertTransaction.txHash)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(transactions).values(insertTransaction);
    }
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async getReports(userId: string): Promise<TaxReport[]> {
    return await db.select().from(taxReports).where(eq(taxReports.userId, userId));
  }

  async getReport(id: number): Promise<TaxReport | undefined> {
    const [report] = await db.select().from(taxReports).where(eq(taxReports.id, id));
    return report;
  }

  async createReport(insertReport: InsertTaxReport & { userId: string }): Promise<TaxReport> {
    const [report] = await db.insert(taxReports).values(insertReport).returning();
    return report;
  }

  async updateReport(id: number, updates: Partial<InsertTaxReport>): Promise<TaxReport> {
    const [report] = await db
      .update(taxReports)
      .set(updates)
      .where(eq(taxReports.id, id))
      .returning();
    return report;
  }

  // ── Intercom ───────────────────────────────────────────────────────────────

  async getMessages(userId: string): Promise<any[]> {
    const { messages } = await import("@shared/schema");
    return await db
      .select()
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(messages.timestamp);
  }

  async createMessage(content: string, sender: string, userId: string): Promise<any> {
    const { messages } = await import("@shared/schema");
    const [message] = await db
      .insert(messages)
      .values({ content, sender, userId })
      .returning();
    return message;
  }
}

export const storage = new DatabaseStorage();
