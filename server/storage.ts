import { db } from "./db";
import { eq } from "drizzle-orm";
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
  getWallets(): Promise<Wallet[]>;
  getWallet(id: number): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  deleteWallet(id: number): Promise<void>;

  // Transactions
  getTransactions(): Promise<Transaction[]>;
  getTransactionsByWallet(walletId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  // Reports
  getReports(): Promise<TaxReport[]>;
  getReport(id: number): Promise<TaxReport | undefined>;
  createReport(report: InsertTaxReport): Promise<TaxReport>;
  updateReport(id: number, updates: Partial<InsertTaxReport>): Promise<TaxReport>;

  // Intercom
  getMessages(): Promise<any[]>;
  createMessage(content: string, sender: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // Wallets
  async getWallets(): Promise<Wallet[]> {
    return await db.select().from(wallets);
  }

  async getWallet(id: number): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
    return wallet;
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values(insertWallet).returning();
    return wallet;
  }

  async deleteWallet(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.walletId, id));
    await db.delete(wallets).where(eq(wallets.id, id));
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions);
  }

  async getTransactionsByWallet(walletId: number): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.walletId, walletId));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  // Reports
  async getReports(): Promise<TaxReport[]> {
    return await db.select().from(taxReports);
  }

  async getReport(id: number): Promise<TaxReport | undefined> {
    const [report] = await db.select().from(taxReports).where(eq(taxReports.id, id));
    return report;
  }

  async createReport(insertReport: InsertTaxReport): Promise<TaxReport> {
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

  // Intercom
  async getMessages(): Promise<any[]> {
    const { messages } = await import("@shared/schema");
    return await db.select().from(messages).orderBy(messages.timestamp);
  }

  async createMessage(content: string, sender: string): Promise<any> {
    const { messages } = await import("@shared/schema");
    const [message] = await db.insert(messages).values({ content, sender }).returning();
    return message;
  }
}

export const storage = new DatabaseStorage();
