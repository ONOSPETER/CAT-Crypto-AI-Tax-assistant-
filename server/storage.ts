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

  // Transactions
  getTransactions(): Promise<Transaction[]>;
  getTransactionsByWallet(walletId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  // Reports
  getReports(): Promise<TaxReport[]>;
  getReport(id: number): Promise<TaxReport | undefined>;
  createReport(report: InsertTaxReport): Promise<TaxReport>;
  updateReport(id: number, updates: Partial<InsertTaxReport>): Promise<TaxReport>;
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
}

export const storage = new DatabaseStorage();
