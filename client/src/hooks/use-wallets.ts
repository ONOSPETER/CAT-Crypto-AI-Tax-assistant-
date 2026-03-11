import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Wallet, InsertWallet } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// useWallets
// Fetches the wallet list. Polls every 8 seconds so balance updates
// from a background sync appear in the UI automatically.
// ─────────────────────────────────────────────────────────────────────────────

export function useWallets() {
  return useQuery<Wallet[]>({
    queryKey: [api.wallets.list.path],
    queryFn: async () => {
      const res = await fetch(api.wallets.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wallets");
      const data = await res.json();
      return api.wallets.list.responses[200].parse(data);
    },
    refetchInterval: 8000, // Poll every 8 s to reflect background sync updates
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// usePageLoadSync
// Calls POST /api/wallets/sync-all exactly once per page load.
// Fires silently in the background — no loading spinner, no toast on success.
// After it completes it invalidates the wallets + transactions queries so the
// UI refreshes with the latest data.
// ─────────────────────────────────────────────────────────────────────────────

export function usePageLoadSync() {
  const queryClient = useQueryClient();
  const hasSynced = useRef(false); // Prevents double-fire from React StrictMode

  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    const run = async () => {
      try {
        const res = await fetch("/api/wallets/sync-all", {
          method: "POST",
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.total > 0) {
            console.log(`[page load] Synced ${data.synced}/${data.total} wallets`);
          }
          // Refresh the UI with fresh balances and transactions
          queryClient.invalidateQueries({ queryKey: [api.wallets.list.path] });
          queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
        }
      } catch (e) {
        // Fail silently — this is a background quality-of-life sync
        console.warn("[page load] sync-all failed:", e);
      }
    };

    run();
  }, []); // Empty dependency array = run once on mount only
}

// ─────────────────────────────────────────────────────────────────────────────
// useCreateWallet
// Connects a new wallet. The backend will auto-sync it in the background
// immediately after creation.
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateWallet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertWallet) => {
      const validated = api.wallets.create.input.parse(data);
      const res = await fetch(api.wallets.create.path, {
        method: api.wallets.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const err = await res.json();
          throw new Error(err.message || "Invalid wallet data");
        }
        throw new Error("Failed to create wallet");
      }
      return api.wallets.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.wallets.list.path] });
      toast({
        title: "Wallet connected",
        description: "Added successfully. Fetching 365 days of transaction history in the background…",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to connect wallet",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useSyncWallet
// Manual refresh for a single wallet (the ↺ button on a wallet card).
// Shows a spinner while in progress, then refreshes transactions on success.
// ─────────────────────────────────────────────────────────────────────────────

export function useSyncWallet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.wallets.sync.path, { id });
      const res = await fetch(url, {
        method: api.wallets.sync.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to sync wallet");
      return api.wallets.sync.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.wallets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      toast({
        title: "Sync complete",
        description: `Processed ${data.count} transaction${data.count !== 1 ? "s" : ""} from the last 365 days.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useDeleteWallet
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteWallet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.wallets.delete.path, { id });
      const res = await fetch(url, {
        method: api.wallets.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete wallet");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.wallets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      toast({
        title: "Wallet deleted",
        description: "The wallet and its transactions have been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useSyncAllWallets
// Syncs all wallets at once, showing progress and final totals.
// ─────────────────────────────────────────────────────────────────────────────

export function useSyncAllWallets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wallets/sync-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to sync all wallets");
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.wallets.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      toast({
        title: "Sync Complete",
        description: `Synced ${data.synced}/${data.total} wallets • ${data.transactionCount} transactions • Total: $${data.totalBalance}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
