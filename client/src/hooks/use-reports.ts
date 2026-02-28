import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { TaxReport } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useReports() {
  return useQuery<TaxReport[]>({
    queryKey: [api.reports.list.path],
    queryFn: async () => {
      const res = await fetch(api.reports.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      return api.reports.list.responses[200].parse(data);
    },
  });
}

export function useReport(id: number) {
  return useQuery<TaxReport | null>({
    queryKey: [api.reports.get.path, id],
    queryFn: async () => {
      if (!id || isNaN(id)) return null;
      const url = buildUrl(api.reports.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      return api.reports.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { country: string; taxYear: number; period: string }) => {
      const validated = api.reports.generate.input.parse(data);
      const res = await fetch(api.reports.generate.path, {
        method: api.reports.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const err = await res.json();
          throw new Error(err.message || "Invalid request parameters");
        }
        throw new Error("Failed to generate report");
      }
      return api.reports.generate.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
      toast({
        title: "Report Generation Started",
        description: "Your tax report is being processed by the AI assistant.",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
