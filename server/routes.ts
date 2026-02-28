import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { Coinbase, Wallet as CBWallet } from "@coinbase/coinbase-sdk";
import { stringify } from "csv-stringify/sync";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Initialize Coinbase SDK if credentials exist
if (process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY) {
  Coinbase.configure({
    apiKeyName: process.env.CDP_API_KEY_NAME,
    privateKey: process.env.CDP_API_KEY_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.wallets.list.path, async (req, res) => {
    const wallets = await storage.getWallets();
    res.json(wallets);
  });

  app.post(api.wallets.create.path, async (req, res) => {
    try {
      const input = api.wallets.create.input.parse(req.body);
      const wallet = await storage.createWallet(input);
      res.status(201).json(wallet);
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

  app.post(api.wallets.sync.path, async (req, res) => {
    try {
      const walletId = Number(req.params.id);
      const wallet = await storage.getWallet(walletId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      let count = 0;
      // If we have Coinbase credentials, try to fetch real data
      if (process.env.CDP_API_KEY_NAME && wallet.address.startsWith('0x')) {
        try {
          // Note: WDK/CDP SDK usage for existing wallets usually requires importing them or tracking them
          // For this MVP, we simulate the enumeration but use the SDK structure if possible
          // In a real app, you'd use CDP data endpoints
          const ethWallet = await CBWallet.create({ networkId: Coinbase.networks.EthereumMainnet });
          // This is a placeholder for real enumeration which usually requires an API key with specific permissions
          console.log("Coinbase SDK initialized for sync");
        } catch (e) {
          console.warn("CDP Sync failed, falling back to mock", e);
        }
      }

      // Mock WDK sync for now if real sync isn't fully configured
      const newTx = await storage.createTransaction({
        walletId,
        txHash: `0x${Math.random().toString(16).slice(2)}`,
        chain: wallet.chain,
        timestamp: new Date(),
        fromAddress: wallet.address,
        toAddress: `0x${Math.random().toString(16).slice(2)}`,
        token: "ETH",
        amount: (Math.random() * 2).toFixed(4),
        usdValue: (Math.random() * 3000).toFixed(2),
        gasFeeUsd: (Math.random() * 10).toFixed(2),
        eventType: Math.random() > 0.5 ? "trade" : "transfer"
      });
      count = 1;

      res.json({ success: true, count });
    } catch (err) {
      console.error("Sync error:", err);
      res.status(500).json({ message: "Failed to sync wallet" });
    }
  });

  app.get(api.transactions.list.path, async (req, res) => {
    const txs = await storage.getTransactions();
    res.json(txs);
  });

  app.get(api.reports.list.path, async (req, res) => {
    const reports = await storage.getReports();
    res.json(reports);
  });

  app.get(api.reports.get.path, async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  });

  // Endpoint to download CSV/Report
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

  app.post(api.reports.generate.path, async (req, res) => {
    try {
      const input = api.reports.generate.input.parse(req.body);

      const report = await storage.createReport({
        country: input.country,
        taxYear: input.taxYear,
        period: input.period,
        status: "generating"
      });
      
      res.status(201).json(report);

      (async () => {
        try {
          const txs = await storage.getTransactions();
          const csvData = stringify(txs.map(t => ({
            date: t.timestamp,
            token: t.token,
            amount: t.amount,
            value: t.usdValue,
            type: t.eventType,
            hash: t.txHash
          })));
          
          const prompt = `
Generate a crypto tax report for ${input.country} (${input.taxYear}, ${input.period}).
Use these transactions:
${csvData}

Return a JSON object with:
1. "summary": Total gains, losses, and estimated tax.
2. "transactions": List of classified transactions with tax impact.
3. "report_text": A printable summary.

Return ONLY JSON.
`;

          const response = await openai.chat.completions.create({
            model: "gpt-4o", // Use a robust model for tax logic
            messages: [
              { role: "system", content: "You are a crypto tax expert. Generate accurate tax reports in JSON." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          });

          const content = response.choices[0]?.message?.content || "{}";
          const parsed = JSON.parse(content);
          
          await storage.updateReport(report.id, {
            status: "completed",
            reportJson: content,
            reportText: parsed.report_text || "Tax report generated successfully."
          });
        } catch (e) {
          console.error("AI Generation failed", e);
          await storage.updateReport(report.id, {
            status: "failed"
          });
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
