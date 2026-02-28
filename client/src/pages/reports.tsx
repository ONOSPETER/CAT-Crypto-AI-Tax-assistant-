import { useState } from "react";
import { useReports, useGenerateReport } from "@/hooks/use-reports";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Link } from "wouter";
import { FileText, Plus, Calendar, Globe, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Reports() {
  const { data: reports = [], isLoading } = useReports();
  const generateReport = useGenerateReport();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [country, setCountry] = useState("United States");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [period, setPeriod] = useState("Annual");

  const handleGenerate = () => {
    generateReport.mutate(
      { 
        country, 
        taxYear: parseInt(taxYear, 10), 
        period 
      },
      { 
        onSuccess: () => setIsDialogOpen(false) 
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'generating': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-white/10 text-white border-white/20';
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gradient flex items-center gap-3">
            Tax Reports
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </h1>
          <p className="text-muted-foreground mt-2">Generate AI-powered tax documentation formatted for your jurisdiction.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--glow-primary)]">
              <Plus className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Generation
              </DialogTitle>
              <DialogDescription>
                The AI assistant will analyze your synced transactions and apply local tax rules to generate a complete report.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="country">Tax Jurisdiction</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="bg-background border-white/10">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="United States">United States (IRS)</SelectItem>
                    <SelectItem value="Japan">Japan (NTA)</SelectItem>
                    <SelectItem value="United Kingdom">United Kingdom (HMRC)</SelectItem>
                    <SelectItem value="Australia">Australia (ATO)</SelectItem>
                    <SelectItem value="Canada">Canada (CRA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Tax Year</Label>
                <Input 
                  id="year" 
                  type="number"
                  value={taxYear}
                  onChange={(e) => setTaxYear(e.target.value)}
                  className="bg-background border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Reporting Period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="bg-background border-white/10">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Annual">Annual</SelectItem>
                    <SelectItem value="Q1">Q1</SelectItem>
                    <SelectItem value="Q2">Q2</SelectItem>
                    <SelectItem value="Q3">Q3</SelectItem>
                    <SelectItem value="Q4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleGenerate} 
                disabled={generateReport.isPending}
                className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-[var(--glow-primary)] transition-all duration-300"
              >
                {generateReport.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Data...
                  </>
                ) : (
                  "Generate Tax Report"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass-panel border-white/5 min-h-[200px] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </Card>
          ))
        ) : reports.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/5">
            <FileText className="w-16 h-16 text-muted-foreground mb-6 opacity-40" />
            <h3 className="text-xl font-display font-semibold text-white mb-2">No Reports Generated</h3>
            <p className="text-muted-foreground max-w-md">
              You haven't generated any tax reports yet. Connect your wallets, sync your transactions, and run the AI assistant to get started.
            </p>
          </div>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="glass-panel hover-elevate-card border-white/10 flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge className={getStatusColor(report.status)}>
                    {report.status === 'generating' && <Loader2 className="w-3 h-3 mr-1 animate-spin inline-block" />}
                    {report.status.toUpperCase()}
                  </Badge>
                  <div className="text-xs text-muted-foreground font-mono">
                    ID: #{report.id}
                  </div>
                </div>
                <CardTitle className="font-display text-xl">{report.country} Report</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2 opacity-70" />
                    <span>Year: <strong className="text-white font-mono ml-1">{report.taxYear}</strong></span>
                    <span className="mx-2">•</span>
                    <span>{report.period}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Globe className="w-4 h-4 mr-2 opacity-70" />
                    <span>Format: Official Return</span>
                  </div>
                  {report.createdAt && (
                    <div className="text-xs text-muted-foreground/50 mt-4">
                      Created: {format(new Date(report.createdAt), "MMM dd, yyyy")}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-white/5">
                <Link href={`/reports/${report.id}`} className="w-full">
                  <Button variant="secondary" className="w-full bg-white/5 hover:bg-white/10 text-white" disabled={report.status === 'generating'}>
                    {report.status === 'generating' ? 'Processing...' : 'View Report'}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </Layout>
  );
}
