import { useState } from "react";
import { useWallets, useCreateWallet, useSyncWallet } from "@/hooks/use-wallets";
import { useTransactions } from "@/hooks/use-transactions";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Wallet, 
  Plus, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity,
  Coins
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { data: wallets = [], isLoading: isLoadingWallets } = useWallets();
  const { data: transactions = [] } = useTransactions();
  const createWallet = useCreateWallet();
  const syncWallet = useSyncWallet();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [chain, setChain] = useState<string>("Ethereum");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");

  const handleConnect = () => {
    createWallet.mutate(
      { chain, address, label },
      { onSuccess: () => setIsDialogOpen(false) }
    );
  };

  const handleSync = (id: number) => {
    syncWallet.mutate(id);
  };

  // Mock data for chart - in a real app this would aggregate transactions
  const mockChartData = [
    { name: "Jan", income: 4000, expense: 2400 },
    { name: "Feb", income: 3000, expense: 1398 },
    { name: "Mar", income: 2000, expense: 9800 },
    { name: "Apr", income: 2780, expense: 3908 },
    { name: "May", income: 1890, expense: 4800 },
    { name: "Jun", income: 2390, expense: 3800 },
  ];

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gradient">Portfolio Overview</h1>
          <p className="text-muted-foreground mt-2">Manage your connected wallets and track taxable events.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--glow-primary)]">
              <Plus className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Connect Wallet</DialogTitle>
              <DialogDescription>
                Add a public address to track your multi-chain transactions.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="chain">Blockchain</Label>
                <Select value={chain} onValueChange={setChain}>
                  <SelectTrigger className="bg-background border-white/10">
                    <SelectValue placeholder="Select chain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ethereum">Ethereum</SelectItem>
                    <SelectItem value="Polygon">Polygon</SelectItem>
                    <SelectItem value="Solana">Solana</SelectItem>
                    <SelectItem value="Bitcoin">Bitcoin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Public Address</Label>
                <Input 
                  id="address" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..." 
                  className="bg-background border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label (Optional)</Label>
                <Input 
                  id="label" 
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Main Vault" 
                  className="bg-background border-white/10"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleConnect} 
                disabled={createWallet.isPending || !address}
                className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
              >
                {createWallet.isPending ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="glass-panel border-l-4 border-l-primary hover-elevate-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Assets value</p>
              <h3 className="text-3xl font-display font-bold text-white">$124,592.00</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-l-4 border-l-green-500 hover-elevate-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Realized Gains</p>
              <h3 className="text-3xl font-display font-bold text-white">+$12,450.50</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-l-4 border-l-accent hover-elevate-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Transactions</p>
              <h3 className="text-3xl font-display font-bold text-white">{transactions.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="col-span-1 lg:col-span-2 glass-panel flex flex-col">
          <CardHeader>
            <CardTitle className="font-display">Activity Overview</CardTitle>
            <CardDescription>Monthly volume of inflows and outflows</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.5)" axisLine={false} tickLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="col-span-1 flex flex-col gap-6">
          <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" /> Connected Wallets
          </h3>
          
          {isLoadingWallets ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : wallets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-white/10 bg-white/5">
              <Wallet className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No wallets connected yet.</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              {wallets.map((wallet) => (
                <Card key={wallet.id} className="glass-panel bg-white/[0.02] hover:bg-white/[0.04] transition-colors border-white/5 group">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-white">{wallet.label || `${wallet.chain} Wallet`}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <span className="w-2 h-2 rounded-full bg-primary inline-block shadow-[var(--glow-primary)]"></span>
                          {wallet.chain}
                        </p>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleSync(wallet.id)}
                        disabled={syncWallet.isPending && syncWallet.variables === wallet.id}
                        title="Sync Transactions"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncWallet.isPending && syncWallet.variables === wallet.id ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                      </Button>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground/80 truncate bg-black/40 p-2 rounded-md border border-white/5">
                      {wallet.address}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
