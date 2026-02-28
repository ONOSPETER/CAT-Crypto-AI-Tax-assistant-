import { useTransactions } from "@/hooks/use-transactions";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, RefreshCcw, Activity } from "lucide-react";

export default function Transactions() {
  const { data: transactions = [], isLoading } = useTransactions();

  const getEventBadge = (type: string) => {
    switch(type.toLowerCase()) {
      case 'trade':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Trade</Badge>;
      case 'transfer':
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">Transfer</Badge>;
      case 'airdrop':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Airdrop</Badge>;
      case 'staking':
        return <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">Staking</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-gradient mb-2">Transactions</h1>
        <p className="text-muted-foreground">All synced taxable events across connected chains.</p>
      </div>

      <Card className="glass-panel overflow-hidden border-white/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/20">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium py-4">Date</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Chain</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Type</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Asset</TableHead>
                <TableHead className="text-right text-muted-foreground font-medium py-4">Amount</TableHead>
                <TableHead className="text-right text-muted-foreground font-medium py-4">USD Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-white/5">
                    <TableCell colSpan={6} className="py-6">
                      <div className="h-4 bg-white/5 animate-pulse rounded max-w-full"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow className="border-none hover:bg-transparent">
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Activity className="w-12 h-12 mb-4 opacity-20" />
                      <p>No transactions found.</p>
                      <p className="text-sm">Connect a wallet and sync to see data.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                    <TableCell className="py-4 font-mono text-sm whitespace-nowrap">
                      {format(new Date(tx.timestamp), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${tx.chain === 'Ethereum' ? 'bg-indigo-500' : tx.chain === 'Solana' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                        {tx.chain}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {getEventBadge(tx.eventType)}
                    </TableCell>
                    <TableCell className="py-4 font-medium text-white">
                      {tx.token}
                    </TableCell>
                    <TableCell className="py-4 text-right font-mono text-sm">
                      {Number(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </TableCell>
                    <TableCell className="py-4 text-right font-mono text-sm text-muted-foreground">
                      ${Number(tx.usdValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </Layout>
  );
}
