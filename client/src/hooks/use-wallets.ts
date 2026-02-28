import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Wallet, InsertWallet } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useWallets() {
  return useQuery<Wallet[]>({
    queryKey: [api.wallets.list.path],
    queryFn: async () => {
      const res = await fetch(api.wallets.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wallets");
      const data = await res.json();
      return api.wallets.list.responses[200].parse(data);
    },
  });
}

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
        description: "Successfully added the wallet to your portfolio.",
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

export function useSyncWallet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.wallets.sync.path, { id });
      const res = await fetch(url, { 
        method: api.wallets.sync.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to sync wallet");
      return api.wallets.sync.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      toast({
        title: "Sync complete",
        description: `Successfully synchronized ${data.count} transactions.`,
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
