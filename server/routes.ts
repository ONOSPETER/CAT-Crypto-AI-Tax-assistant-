import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
    const walletId = Number(req.params.id);
    const wallet = await storage.getWallet(walletId);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Mock WDK sync
    const newTx = await storage.createTransaction({
      walletId,
      txHash: `0x${Math.random().toString(16).slice(2)}`,
      chain: wallet.chain,
      timestamp: new Date(),
      fromAddress: wallet.address,
      toAddress: `0x${Math.random().toString(16).slice(2)}`,
      token: "ETH",
      amount: "0.5",
      usdValue: "1500.00",
      gasFeeUsd: "5.50",
      eventType: "trade"
    });

    res.json({ success: true, count: 1 });
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

  app.post(api.reports.generate.path, async (req, res) => {
    try {
      const input = api.reports.generate.input.parse(req.body);

      // Create a pending report
      const report = await storage.createReport({
        country: input.country,
        taxYear: input.taxYear,
        period: input.period,
        status: "generating"
      });
      
      // We respond immediately to not block the UI
      res.status(201).json(report);

      // Start background process
      (async () => {
        try {
          const txs = await storage.getTransactions();
          const csvData = txs.map(t => `${t.timestamp},${t.token},${t.amount},${t.usdValue},${t.eventType}`).join("\\n");
          
          const prompt = `
Given these transactions in TX.csv and standard tax rules for ${input.country}:

1) Parse all transactions and classify them
2) Apply the tax treatment
3) Produce a complete tax report

TX.csv:
${csvData || "No transactions"}

Return ONLY valid structured output. Ensure you return JSON representing the report and a text representation.
`;

          const response = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
              { role: "system", content: "You are a crypto-tax report generator assistant. Your task is to return a complete, fully structured tax return in JSON format." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          });

          const content = response.choices[0]?.message?.content || "{}";
          
          await storage.updateReport(report.id, {
            status: "completed",
            reportJson: content,
            reportText: "Tax report generated successfully."
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
