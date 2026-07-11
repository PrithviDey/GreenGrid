import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  ArrowUpDown, 
  TrendingUp, 
  Coins, 
  Zap, 
  User, 
  Award, 
  ShieldCheck, 
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { ethers } from "ethers";

// Web3 Helpers & Models
import { buyEnergyListing, Listing } from "../../lib/web3";

interface MarketplaceViewProps {
  listings: Listing[];
  loading: boolean;
  signer: ethers.Signer | null;
  account: string | null;
  onSuccess: () => void;
  walletMismatch?: boolean;
}

export function MarketplaceView({
  listings,
  loading,
  signer,
  account,
  onSuccess,
  walletMismatch
}: MarketplaceViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [maxPrice, setMaxPrice] = useState<number>(2.0); // maximum price cap
  const [sortBy, setSortBy] = useState<"price-asc" | "price-desc" | "amount-desc">("price-asc");
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Filter listings: active, not matched, matching search and price range
  const activeSellListings = useMemo(() => {
    return listings.filter(l => {
      const isAvailable = l.isActive && !l.isMatched && !l.isSettled;
      const matchesSearch = l.seller.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPrice = parseFloat(l.pricePerToken) <= maxPrice;
      return isAvailable && matchesSearch && matchesPrice;
    });
  }, [listings, searchTerm, maxPrice]);

  // Highlight metrics from all active on-chain listings
  const metrics = useMemo(() => {
    const rawActive = listings.filter(l => l.isActive && !l.isMatched && !l.isSettled);
    if (rawActive.length === 0) {
      return { cheapest: null, largest: null, totalEnergy: 0 };
    }

    let cheapest = rawActive[0];
    let largest = rawActive[0];
    let totalEnergy = 0;

    rawActive.forEach(l => {
      const price = parseFloat(l.pricePerToken);
      const amount = parseFloat(l.amount);
      totalEnergy += amount;

      if (price < parseFloat(cheapest.pricePerToken)) {
        cheapest = l;
      }
      if (amount > parseFloat(largest.amount)) {
        largest = l;
      }
    });

    return { cheapest, largest, totalEnergy };
  }, [listings]);

  // Sort filtered listings
  const sortedListings = useMemo(() => {
    const list = [...activeSellListings];
    list.sort((a, b) => {
      const priceA = parseFloat(a.pricePerToken);
      const priceB = parseFloat(b.pricePerToken);
      const amountA = parseFloat(a.amount);
      const amountB = parseFloat(b.amount);

      if (sortBy === "price-asc") return priceA - priceB;
      if (sortBy === "price-desc") return priceB - priceA;
      if (sortBy === "amount-desc") return amountB - amountA;
      return 0;
    });
    return list;
  }, [activeSellListings, sortBy]);

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const handleBuy = async (listingId: number, totalCostMatic: string) => {
    if (walletMismatch) return;
    if (!signer) {
      toast.error("Please connect your wallet first!");
      return;
    }

    setProcessingId(listingId);
    try {
      toast.info("Sending payment deposit to escrow contract via MetaMask...");
      await buyEnergyListing(signer, listingId, totalCostMatic);
      toast.success("✔ Matched listing & payment successfully escrowed! Awaiting physical delivery...");
      onSuccess();
    } catch (err: any) {
      toast.error(err.reason || err.message || "Failed to purchase energy");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div>
        <h2 className="font-[Space_Grotesk] text-2xl font-bold tracking-tight text-foreground">
          P2P Solar Energy <span className="text-glow-green">Marketplace</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Compare active electricity offers from local solar exporters and purchase clean energy directly.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1: Best Deal */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-[2px] h-full bg-[var(--neon-green)] opacity-40 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Best Price Rate</p>
              {metrics.cheapest ? (
                <>
                  <p className="mt-2 text-2xl font-[Space_Grotesk] font-bold text-glow-green">
                    {parseFloat(metrics.cheapest.pricePerToken).toFixed(4)} <span className="text-sm font-normal text-muted-foreground">POL/kWh</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1.5 font-mono flex items-center gap-1">
                    <User className="h-3 w-3 text-glow-green" /> Seller: {truncateAddress(metrics.cheapest.seller)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No offers active</p>
              )}
            </div>
            <div className="bg-[var(--neon-green)]/10 text-[var(--neon-green)] p-2 rounded-xl border border-[var(--neon-green)]/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
              <Award className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Metric 2: Largest Pool */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-[2px] h-full bg-[var(--neon-cyan)] opacity-40 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Largest Power Bundle</p>
              {metrics.largest ? (
                <>
                  <p className="mt-2 text-2xl font-[Space_Grotesk] font-bold text-glow-cyan">
                    {parseFloat(metrics.largest.amount).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kWh</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1.5 font-mono flex items-center gap-1">
                    <User className="h-3 w-3 text-glow-cyan" /> Exporter: {truncateAddress(metrics.largest.seller)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No offers active</p>
              )}
            </div>
            <div className="bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] p-2 rounded-xl border border-[var(--neon-cyan)]/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
              <Zap className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Metric 3: Active Capacity */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-[2px] h-full bg-purple-500 opacity-40 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Grid Supply</p>
              <p className="mt-2 text-2xl font-[Space_Grotesk] font-bold text-purple-400">
                {metrics.totalEnergy.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kWh</span>
              </p>
              <p className="text-[10px] text-muted-foreground/85 mt-1.5">
                Across all active smart meters
              </p>
            </div>
            <div className="bg-purple-500/10 text-purple-400 p-2 rounded-xl border border-purple-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Sort Panel */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Seller Address (0x...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/[0.02] border-white/5 focus:border-[var(--neon-green)]/35 text-foreground h-10 rounded-xl text-xs"
          />
        </div>

        {/* Price Slider Filter */}
        <div className="flex items-center gap-3 glass-panel px-3 py-1.5 border-white/5">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <div className="text-xs">
            <span className="text-muted-foreground">Max Price:</span>{" "}
            <span className="font-mono text-glow-green font-semibold">{maxPrice.toFixed(2)} POL</span>
          </div>
          <input
            type="range"
            min="0.0001"
            max="2.0"
            step="0.05"
            value={maxPrice}
            onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
            className="w-24 accent-[var(--neon-green)] h-1 rounded-lg cursor-pointer bg-white/10"
          />
        </div>

        {/* Sort drop down */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpDown className="h-3.5 w-3.5" /> Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:border-[var(--neon-green)]/35 cursor-pointer h-10 min-w-[140px]"
          >
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="amount-desc">Energy: High to Low</option>
          </select>
        </div>
      </div>

      {/* Comparison Grid */}
      {loading && sortedListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm glass-panel">
          <RefreshCw className="h-8 w-8 animate-spin mb-3 text-glow-green" />
          Querying contract active offers...
        </div>
      ) : sortedListings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm glass-panel border border-dashed border-white/5">
          <Zap className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
          <p className="font-semibold text-foreground/80">No active solar energy offers found</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-[300px] mx-auto">
            Try adjusting your max price slider or search filter to find more sellers on the grid.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedListings.map((l) => {
            const totalCost = (parseFloat(l.amount) * parseFloat(l.pricePerToken)).toFixed(4);
            const isSeller = account && account.toLowerCase() === l.seller.toLowerCase();
            
            // Custom card badges
            const isCheapest = metrics.cheapest && l.id === metrics.cheapest.id;
            const isWholesale = parseFloat(l.amount) >= 5.0;

            return (
              <div 
                key={l.id} 
                className="glass-panel p-5 relative flex flex-col justify-between hover:border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.02)] transition group"
              >
                {/* Visual Highlights */}
                {isCheapest && (
                  <span className="absolute top-3 right-3 text-[9px] uppercase tracking-wider font-bold bg-[var(--neon-green)]/15 text-glow-green border border-[var(--neon-green)]/35 px-2 py-0.5 rounded-full">
                    Cheapest Rate
                  </span>
                )}
                {!isCheapest && isWholesale && (
                  <span className="absolute top-3 right-3 text-[9px] uppercase tracking-wider font-bold bg-[var(--neon-cyan)]/15 text-glow-cyan border border-[var(--neon-cyan)]/35 px-2 py-0.5 rounded-full">
                    Bulk Offer
                  </span>
                )}

                <div>
                  {/* Seller details */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-muted-foreground">
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Exporter</span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {truncateAddress(l.seller)}
                        {isSeller && <span className="text-[8px] bg-[var(--neon-green)]/20 text-glow-green px-1 rounded ml-1 border border-[var(--neon-green)]/30 uppercase">You</span>}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Table */}
                  <div className="space-y-2 border-t border-white/5 pt-3 mb-5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Offered Power:</span>
                      <span className="font-mono text-foreground font-bold">{parseFloat(l.amount).toFixed(1)} kWh</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Energy Rate:</span>
                      <span className="font-mono text-glow-green font-bold">{parseFloat(l.pricePerToken).toFixed(4)} POL/kWh</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-dashed border-white/5 pt-2 mt-2">
                      <span className="text-xs font-semibold text-foreground/80">Total Cost:</span>
                      <span className="font-mono text-lg font-bold text-glow-cyan">{totalCost} POL</span>
                    </div>
                  </div>
                </div>

                {/* Purchase Button */}
                <Button
                  disabled={processingId === l.id || isSeller || !!walletMismatch}
                  onClick={() => handleBuy(l.id, totalCost)}
                  className="w-full h-10 border border-[var(--neon-cyan)]/35 bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] rounded-xl text-xs font-bold uppercase tracking-wider transition duration-150"
                >
                  {processingId === l.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : isSeller ? (
                    "Your Solar Offer"
                  ) : walletMismatch ? (
                    "Wallet Mismatch"
                  ) : (
                    "Match & Buy Offer"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sub-components for Contract details & Simple Analytics tabs
export function ContractsView() {
  return (
    <div className="glass-panel p-6 space-y-4">
      <div>
        <h3 className="font-[Space_Grotesk] text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-glow-green" /> Smart Contract Architecture
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Underlying Polygon EVM ledger structure deployments</p>
      </div>
      <div className="divide-y divide-white/5 text-xs font-mono space-y-3">
        <div className="pt-3 flex justify-between">
          <span className="text-muted-foreground">GreenCoin (GRN) ERC-20:</span>
          <span className="text-foreground">0x375C36b36ed9916804CA2Dc4813ED58CcCd67861</span>
        </div>
        <div className="pt-3 flex justify-between">
          <span className="text-muted-foreground">EnergyTrading Escrow:</span>
          <span className="text-foreground">0x485a537f51411734d4Ae9b1ce75c250b06FCcC77</span>
        </div>
        <div className="pt-3 flex justify-between">
          <span className="text-muted-foreground">Authorized System Oracle:</span>
          <span className="text-foreground">0x2D00199a2d5cFFd5702457F50aac823a28BE05dC</span>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsView() {
  return (
    <div className="glass-panel p-6 space-y-4">
      <div>
        <h3 className="font-[Space_Grotesk] text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-glow-green" /> Grid Analytics Panel
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Historical solar generation metrics and load analysis</p>
      </div>
      <div className="py-8 text-center text-muted-foreground text-xs">
        System telemetry logging is active. Select the <strong>Grid</strong> tab to view real-time smart meter sparklines and net energy exports.
      </div>
    </div>
  );
}
