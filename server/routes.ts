import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerTron from '@tetherto/wdk-wallet-tron';
import WalletManagerBtc from '@tetherto/wdk-wallet-btc';
import axios from 'axios';
import session from "express-session";
import connectPg from "connect-pg-simple";
import OpenAI from "openai";
import { stringify } from "csv-stringify/sync";
import { pool, db } from "./db";
import { wallets } from "@shared/schema";
import { eq } from "drizzle-orm";

const PostgresStore = connectPg(session);

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKCHAIN TRANSACTION FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

async function getEthereumTransactions(address: string) {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`;
    const res = await axios.get(url);
    const result = res.data.result;
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

async function getBitcoinTransactions(address: string) {
  try {
    const url = `https://blockstream.info/api/address/${address}/txs`;
    const res = await axios.get(url);
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

async function getTronTransactions(address: string) {
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions`;
    const res = await axios.get(url);
    const data = res.data.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKCHAIN BALANCE FETCHERS
// Queries the actual user address via public APIs.
// WDK's getAccount(n).getBalance() reads from the nth derived address of a
// randomly-generated seed — not from the user's real address — so we bypass
// it for balance lookups and go direct to public APIs.
// ─────────────────────────────────────────────────────────────────────────────

async function getEthereumBalance(address: string): Promise<string> {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`;
    const res = await axios.get(url);
    const wei = res.data.result || "0";
    return (parseFloat(wei) / 1e18).toString();
  } catch {
    return "0";
  }
}

async function getBitcoinBalance(address: string): Promise<string> {
  try {
    const url = `https://blockstream.info/api/address/${address}`;
    const res = await axios.get(url);
    const funded = res.data.chain_stats?.funded_txo_sum || 0;
    const spent = res.data.chain_stats?.spent_txo_sum || 0;
    return ((funded - spent) / 1e8).toString();
  } catch {
    return "0";
  }
}

async function getTronBalance(address: string): Promise<string> {
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}`;
    const res = await axios.get(url);
    const sunBalance = res.data.data?.[0]?.balance || 0;
    return (sunBalance / 1e6).toString();
  } catch {
    return "0";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function filterLastYear(txs: any[]) {
  const now = Date.now();
  return txs.filter(tx => {
    // TronGrid raw_data.timestamp is already in ms; all others are in seconds
    const raw = tx.timeStamp || tx.block_timestamp || tx.raw_data?.timestamp || tx.status?.block_time || 0;
    const ts = tx.raw_data?.timestamp ? raw : raw * 1000;
    return now - ts <= ONE_YEAR;
  });
}

// Approximate USD conversion rates — swap for a live price API if desired
const COIN_PRICES: Record<string, number> = {
  ETH: 2500,
  BTC: 65000,
  TRX: 0.12,
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE SYNC FUNCTION
// Fetches real balance + 365 days of transactions for one wallet.
// Returns normalised { balance, history } ready to be written to the DB.
// ─────────────────────────────────────────────────────────────────────────────

async function syncWalletData(walletAddress: string, walletChain: string) {
  // WDK is initialised here so it stays available for future on-chain calls
  const seedPhrase = WDK.getRandomSeedPhrase();
  const wdk = new WDK(seedPhrase)
    .registerWallet('ethereum', WalletManagerEvm, { provider: 'https://eth.drpc.org' })
    .registerWallet('tron', WalletManagerTron, { provider: 'https://api.trongrid.io' })
    .registerWallet('bitcoin', WalletManagerBtc, {
      network: 'mainnet',
      host: 'electrum.blockstream.info',
      port: 50001,
    });

  let balance = "0";
  let history: any[] = [];

  if (walletAddress.startsWith("0x")) {
    // ── Ethereum / EVM ───────────────────────────────────────────────────────
    balance = await getEthereumBalance(walletAddress);
    const txs = await getEthereumTransactions(walletAddress);
    history = filterLastYear(txs).map((tx: any) => ({
      hash: tx.hash,
      timestamp: parseInt(tx.timeStamp) * 1000,
      from: tx.from,
      to: tx.to,
      asset: "ETH",
      amount: (parseFloat(tx.value || "0") / 1e18).toString(), // Wei → ETH
      usdValue: "0",
      fee: tx.gasUsed || "0",
      type: tx.from?.toLowerCase() === walletAddress.toLowerCase() ? "send" : "receive",
    }));

  } else if (walletAddress.startsWith("T") && walletAddress.length === 34) {
    // ── Tron (base58, 34 chars, always starts with T) ────────────────────────
    balance = await getTronBalance(walletAddress);
    const txs = await getTronTransactions(walletAddress);
    history = filterLastYear(txs).map((tx: any) => {
      const contract = tx.raw_data?.contract?.[0]?.parameter?.value || {};
      return {
        hash: tx.txID,
        timestamp: tx.raw_data?.timestamp || 0, // Already in ms from TronGrid
        from: contract.owner_address || "unknown",
        to: contract.to_address || "unknown",
        asset: "TRX",
        amount: ((contract.amount || 0) / 1e6).toString(), // SUN → TRX
        usdValue: "0",
        fee: ((tx.ret?.[0]?.fee || 0) / 1e6).toString(), // SUN → TRX
        type: "transfer",
      };
    });

  } else {
    // ── Bitcoin ──────────────────────────────────────────────────────────────
    balance = await getBitcoinBalance(walletAddress);
    const txs = await getBitcoinTransactions(walletAddress);
    history = filterLastYear(txs).map((tx: any) => {
      const received = (tx.vout || [])
        .filter((v: any) => v.scriptpubkey_address === walletAddress)
        .reduce((acc: number, v: any) => acc + (v.value || 0), 0);
      return {
        hash: tx.txid,
        timestamp: (tx.status?.block_time || 0) * 1000,
        from: "unknown",
        to: walletAddress,
        asset: "BTC",
        amount: (received / 1e8).toString(), // satoshis → BTC
        usdValue: "0",
        fee: ((tx.fee || 0) / 1e8).toString(), // satoshis → BTC
        type: "transfer",
      };
    });
  }

  return { balance, history };
}

/**
 * Persists a completed syncWalletData result to the database.
 * Uses upsertTransaction so re-syncing never creates duplicate rows.
 */
async function persistSyncResult(
  walletId: number,
  walletChain: string,
  balance: string,
  history: any[]
) {
  const assetKey = walletChain === "Tron" ? "TRX" : walletChain === "Bitcoin" ? "BTC" : "ETH";
  const balanceUsd = (parseFloat(balance) * (COIN_PRICES[assetKey] || 1)).toString();

  await storage.updateWalletBalance(walletId, balance, balanceUsd);

  for (const tx of history) {
    await storage.upsertTransaction({
      walletId,
      txHash: tx.hash,
      chain: walletChain,
      timestamp: new Date(tx.timestamp),
      fromAddress: tx.from,
      toAddress: tx.to,
      token: tx.asset,
      amount: tx.amount.toString(),
      usdValue: tx.usdValue.toString(),
      gasFeeUsd: tx.fee.toString(),
      eventType: tx.type,
    });
  }

  return history.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new PostgresStore({ pool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "cat-assistant-secret",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 },
    })
  );

  const getUserId = (req: any) => req.sessionID;

  // ── GET /api/wallets ───────────────────────────────────────────────────────
  app.get(api.wallets.list.path, async (req, res) => {
    const walletList = await storage.getWallets(getUserId(req));
    res.json(walletList);
  });

  // ── POST /api/wallets ──────────────────────────────────────────────────────
  // Triggered when a new wallet is connected.
  // Responds immediately, then syncs 365 days of real tx history in background.
  app.post(api.wallets.create.path, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.wallets.create.input.parse(req.body);
      const wallet = await storage.createWallet({ ...input, userId });

      res.status(201).json(wallet);

      // Fire-and-forget background sync — does not block the HTTP response
      (async () => {
        try {
          const { balance, history } = await syncWalletData(wallet.address, wallet.chain);
          const count = await persistSyncResult(wallet.id, wallet.chain, balance, history);
          console.log(`[sync] New wallet ${wallet.address}: ${count} txs stored`);
        } catch (e) {
          console.error("[sync] Auto-sync failed for new wallet:", e);
        }
      })();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ── POST /api/wallets/sync-all ─────────────────────────────────────────────
  // Syncs all wallets for a user. Can be triggered on page load or manually.
  // Returns transaction counts and total balance across all wallets.
  app.post("/api/wallets/sync-all", async (req, res) => {
    const userId = getUserId(req);
    const walletList = await storage.getWallets(userId);

    // Perform all syncs in parallel and collect results
    const results = await Promise.allSettled(
      walletList.map(async (wallet) => {
        const { balance, history } = await syncWalletData(wallet.address, wallet.chain);
        const count = await persistSyncResult(wallet.id, wallet.chain, balance, history);
        const assetKey = wallet.chain === "Tron" ? "TRX" : wallet.chain === "Bitcoin" ? "BTC" : "ETH";
        const balanceUsd = (parseFloat(balance) * (COIN_PRICES[assetKey] || 1)).toString();
        return { walletId: wallet.id, count, balance, balanceUsd };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const totalTxCount = successful.reduce((sum, r) => sum + (r.value?.count || 0), 0);
    const totalBalance = successful.reduce((sum, r) => sum + parseFloat(r.value?.balanceUsd || "0"), 0);

    res.json({
      synced: successful.length,
      total: walletList.length,
      transactionCount: totalTxCount,
      totalBalance: totalBalance.toFixed(2),
    });
  });

  // ── POST /api/wallets/:id/sync ─────────────────────────────────────────────
  // Triggered when the user presses the refresh button on a wallet card.
  // Syncs one wallet and returns the count of transactions found.
  app.post(api.wallets.sync.path, async (req, res) => {
    try {
      const walletId = Number(req.params.id);
      const wallet = await storage.getWallet(walletId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      try {
        const { balance, history } = await syncWalletData(wallet.address, wallet.chain);
        const count = await persistSyncResult(wallet.id, wallet.chain, balance, history);
        res.json({ success: true, count });
      } catch (e) {
        console.warn("[sync] WDK/API Sync failed:", e);
        res.status(500).json({ message: "Sync failed — check server logs for details." });
      }
    } catch (err) {
      console.error("[sync] Route error:", err);
      res.status(500).json({ message: "Failed to sync wallet" });
    }
  });

  // ── DELETE /api/wallets/:id ────────────────────────────────────────────────
  app.delete(api.wallets.delete.path, async (req, res) => {
    const walletId = Number(req.params.id);
    await storage.deleteWallet(walletId);
    res.json({ success: true });
  });

  // ── GET /api/intercom ──────────────────────────────────────────────────────
  app.get(api.intercom.list.path, async (req, res) => {
    const msgs = await storage.getMessages(getUserId(req));
    res.json(msgs);
  });

  // ── POST /api/intercom ─────────────────────────────────────────────────────
  app.post(api.intercom.send.path, async (req, res) => {
    const { content } = req.body;
    const userId = getUserId(req);
    await storage.createMessage(content, 'user', userId);

    // Fetch the user's transactions so the AI has context about their portfolio
    const userTxs = await storage.getTransactions(userId);
    const txSummary = userTxs.length > 0
      ? `The user has ${userTxs.length} transactions on record. Recent tokens: ${[...new Set(userTxs.map(t => t.token))].slice(0, 5).join(", ")}.`
      : "The user has no transactions synced yet.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are CAT, an AI-powered crypto tax assistant communicating via Trac Network Intercom. 
Be concise, professional, and helpful. You have access to the user's transaction context below.
${txSummary}`,
        },
        { role: "user", content },
      ],
    });

    const reply = response.choices[0]?.message?.content || "I'm here to help!";
    await storage.createMessage(reply, 'ai', userId);
    res.json({ reply });
  });

  // ── GET /api/transactions ──────────────────────────────────────────────────
  app.get(api.transactions.list.path, async (req, res) => {
    const txs = await storage.getTransactions(getUserId(req));
    res.json(txs);
  });

  // ── GET /api/reports ───────────────────────────────────────────────────────
  app.get(api.reports.list.path, async (req, res) => {
    const reports = await storage.getReports(getUserId(req));
    res.json(reports);
  });

  // ── GET /api/reports/:id ───────────────────────────────────────────────────
  app.get(api.reports.get.path, async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  });

  // ── GET /api/reports/:id/download ──────────────────────────────────────────
  app.get("/api/reports/:id/download", async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report || !report.reportJson) {
      return res.status(404).json({ message: "Report not ready" });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tax-report-${report.id}.csv`);

    try {
      const data = JSON.parse(report.reportJson);
      // Simplify for CSV
      const csv = stringify(Array.isArray(data.transactions) ? data.transactions : [data]);
      res.send(csv);
    } catch (e) {
      res.send(report.reportText || "Report error");
    }
  });

  // ── POST /api/reports/generate ─────────────────────────────────────────────
  app.post(api.reports.generate.path, async (req, res) => {
    try {
      const input = api.reports.generate.input.parse(req.body);
      const userId = getUserId(req);

      const report = await storage.createReport({
        country: input.country,
        taxYear: input.taxYear,
        period: input.period,
        status: "generating",
        userId,
      });

      res.status(201).json(report);

      (async () => {
        try {
          const txs = await storage.getTransactions(userId);
          const csvData = stringify(txs.map(t => ({
            date: t.timestamp,
            token: t.token,
            amount: t.amount,
            value: t.usdValue,
            type: t.eventType,
            hash: t.txHash,
          })));

          const prompt = `
Generate an official crypto tax report for ${input.country} (${input.taxYear}, ${input.period}).
Use these transactions:
${csvData}

IMPORTANT: The output must strictly follow the official tax filing standards of ${input.country}.
For example, if it's USA, use Form 8949 format. If Nigeria, follow FIRS guidelines for Capital Gains Tax (10% rate).

Return a JSON object with:
1. "summary": Total gains, losses, and estimated tax.
2. "transactions": List of classified transactions with tax impact.
3. "report_text": A printable, formal, official-looking document text that matches the country's tax form requirements exactly.

Return ONLY JSON.
`;

          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: "You are a crypto tax expert. Generate accurate tax reports in JSON." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content || "{}";
          const parsed = JSON.parse(content);

          await storage.updateReport(report.id, {
            status: "completed",
            reportJson: content,
            reportText: parsed.report_text || "Tax report generated successfully.",
          });
        } catch (e) {
          console.error("[report] AI generation failed:", e);
          await storage.updateReport(report.id, { status: "failed" });
        }
      })();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  return httpServer;
}
