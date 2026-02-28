import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { Transaction } from "@shared/schema";

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: [api.transactions.list.path],
    queryFn: async () => {
      const res = await fetch(api.transactions.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      return api.transactions.list.responses[200].parse(data);
    },
  });
}
