import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- TABLE DEFINITIONS ---

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  chain: text("chain").notNull(), // 'Ethereum', 'Polygon', 'Solana', 'Bitcoin', 'Trac'
  label: text("label"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sender: text("sender").notNull(), // 'user', 'ai'
  timestamp: timestamp("timestamp").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").references(() => wallets.id),
  txHash: text("tx_hash").notNull(),
  chain: text("chain").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  token: text("token").notNull(),
  amount: numeric("amount").notNull(),
  usdValue: numeric("usd_value").notNull(),
  gasFeeUsd: numeric("gas_fee_usd").notNull(),
  eventType: text("event_type").notNull(), // trade, transfer, staking, airdrop, etc
});

export const taxReports = pgTable("tax_reports", {
  id: serial("id").primaryKey(),
  country: text("country").notNull(),
  taxYear: integer("tax_year").notNull(),
  period: text("period").notNull(), // 'annual', 'q1', etc.
  reportJson: text("report_json"),
  reportText: text("report_text"),
  status: text("status").notNull(), // 'generating', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

// --- BASE SCHEMAS ---

export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export const insertTaxReportSchema = createInsertSchema(taxReports).omit({ id: true, createdAt: true, reportJson: true, reportText: true });

// --- EXPLICIT TYPES ---

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type TaxReport = typeof taxReports.$inferSelect;
export type InsertTaxReport = z.infer<typeof insertTaxReportSchema>;

// API CONTRACT TYPES
export type CreateWalletRequest = InsertWallet;
export type GenerateReportRequest = {
  country: string;
  taxYear: number;
  period: string;
};

export type ReportGenerationResponse = {
  reportId: number;
  status: string;
};
