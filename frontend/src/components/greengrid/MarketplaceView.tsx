import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  ArrowUpDown,
  TrendingUp,
  Zap,
  User,
  Award,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  MapPin,
  Star,
  Sun,
  Leaf,
  BarChart3,
  CheckCircle,
  X,
  Scale,
  ChevronRight,
  Flame,
  Package
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
  onSuccess: (details?: { amount: string; price: string; seller: string; total: string }) => void;
  walletMismatch?: boolean;
}

// --- Static Profile Data for Known Sellers ---
export const SELLER_PROFILES: Record<string, {
  alias: string;
  location: string;
  panelKw: number;
  greenScore: number;
  verified: boolean;
  joinedYear: number;
  totalSold: number;
}> = {
  "0x89f3119561e8d303c0d0ab1e57cffd570245c7c2": {
    alias: "SolarMax Alpha", location: "Bangalore, KA", panelKw: 5.2,
    greenScore: 96, verified: true, joinedYear: 2023, totalSold: 1.4
  },
  "0x41a23e8f810ac09d3031789a4096a5f69ef27f51": {
    alias: "EcoWatt Pro", location: "Pune, MH", panelKw: 8.0,
    greenScore: 88, verified: true, joinedYear: 2023, totalSold: 3.1
  },
  "0xb0d31789a4096a5f69ef27f5170dcbe43df2fa67": {
    alias: "GridZen Home", location: "Chennai, TN", panelKw: 3.5,
    greenScore: 79, verified: false, joinedYear: 2024, totalSold: 0.7
  },
  "0x77ec104ca2dc4813ed58cccd678619e87c2d450b": {
    alias: "Helios Farm", location: "Jaipur, RJ", panelKw: 12.0,
    greenScore: 92, verified: true, joinedYear: 2022, totalSold: 5.8
  },
  "0x9e87c2d450b06fccc77ec104ca2dc4813ed58ccc": {
    alias: "SunCore Grid", location: "Hyderabad, TS", panelKw: 6.5,
    greenScore: 85, verified: true, joinedYear: 2023, totalSold: 2.3
  },
  "0xc3a22f9c89d3031789b81ad83c0d0ab1e57cffd5": {
    alias: "AuroraSolar", location: "Ahmedabad, GJ", panelKw: 10.0,
    greenScore: 98, verified: true, joinedYear: 2022, totalSold: 7.2
  },
  "0xd14f67b2e3f89b0d3189a5031b7accd678219e88": {
    alias: "MegaWatt Co.", location: "Delhi, DL", panelKw: 18.0,
    greenScore: 91, verified: true, joinedYear: 2022, totalSold: 9.5
  },
  "0xe56c12b3a90d3c2ef89a5f69ef27f519e87d3a10": {
    alias: "NanoGrid Hub", location: "Mysuru, KA", panelKw: 4.0,
    greenScore: 82, verified: false, joinedYear: 2024, totalSold: 0.4
  },
  "0xf7ad23c4b12e96a5b69ef27f5170dcbe43df2fb1": {
    alias: "TerraWatt X", location: "Surat, GJ", panelKw: 22.0,
    greenScore: 94, verified: true, joinedYear: 2021, totalSold: 15.3
  },
  "0xa18b34d5c06fccc77ec204ca2dc4813ed58cccd6": {
    alias: "UrbanSun Co.", location: "Kolkata, WB", panelKw: 3.8,
    greenScore: 76, verified: false, joinedYear: 2024, totalSold: 0.6
  },
  "0xb29e45e6d1789a4096a5f69ef27f5170dcb43df3": {
    alias: "InfinityGrid", location: "Mumbai, MH", panelKw: 15.0,
    greenScore: 90, verified: true, joinedYear: 2022, totalSold: 8.1
  },
  "0xc3af56g7e2a3f89b1d3189a5031b7accd678219f9": {
    alias: "SkyWatt South", location: "Coimbatore, TN", panelKw: 7.5,
    greenScore: 83, verified: true, joinedYear: 2023, totalSold: 2.9
  },
  "0xd4b067c8f3a4g90b2e3289b5132c8bdde789320a": {
    alias: "MegaSolar Farm", location: "Rajkot, GJ", panelKw: 30.0,
    greenScore: 97, verified: true, joinedYear: 2021, totalSold: 22.7
  },
};

const DEFAULT_PROFILE = {
  alias: "Unknown Seller", location: "India", panelKw: 5.0,
  greenScore: 75, verified: false, joinedYear: 2024, totalSold: 0.3
};

function getProfile(seller: string) {
  return SELLER_PROFILES[seller.toLowerCase()] || DEFAULT_PROFILE;
}

function GreenScoreBadge({ score }: { score: number }) {
  const color = score >= 90
    ? "text-[var(--neon-green)] border-[var(--neon-green)]/40 bg-[var(--neon-green)]/10"
    : score >= 75
    ? "text-yellow-400 border-yellow-400/40 bg-yellow-400/10"
    : "text-orange-400 border-orange-400/40 bg-orange-400/10";
  const icon = score >= 90 ? "🌿" : score >= 75 ? "⚡" : "🔶";
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${color}`}>
      {icon} {score}
    </span>
  );
}

function StarRating({ score }: { score: number }) {
  const stars = Math.round(score / 20);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= stars ? "text-yellow-400 fill-yellow-400" : "text-white/10 fill-white/5"}`}
        />
      ))}
    </div>
  );
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
  const [maxPrice, setMaxPrice] = useState<number>(0.005);
  const [sortBy, setSortBy] = useState<"price-asc" | "price-desc" | "amount-desc" | "score-desc">("price-asc");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const activeSellListings = useMemo(() => {
    return listings.filter(l => {
      const isAvailable = l.isActive && !l.isMatched && !l.isSettled;
      const isSelf = account && account.toLowerCase() === l.seller.toLowerCase();
      const profile = getProfile(l.seller);
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        l.seller.toLowerCase().includes(searchLower) ||
        profile.alias.toLowerCase().includes(searchLower) ||
        profile.location.toLowerCase().includes(searchLower);
      const matchesPrice = parseFloat(l.pricePerToken) <= maxPrice;
      return isAvailable && matchesSearch && matchesPrice && !isSelf;
    });
  }, [listings, searchTerm, maxPrice, account]);

  const metrics = useMemo(() => {
    const rawActive = listings.filter(l => l.isActive && !l.isMatched && !l.isSettled);
    if (rawActive.length === 0) return { cheapest: null, largest: null, totalEnergy: 0, avgPrice: 0 };
    let cheapest = rawActive[0];
    let largest = rawActive[0];
    let totalEnergy = 0;
    let priceSum = 0;
    rawActive.forEach(l => {
      const price = parseFloat(l.pricePerToken);
      const amount = parseFloat(l.amount);
      totalEnergy += amount;
      priceSum += price;
      if (price < parseFloat(cheapest.pricePerToken)) cheapest = l;
      if (amount > parseFloat(largest.amount)) largest = l;
    });
    return { cheapest, largest, totalEnergy, avgPrice: priceSum / rawActive.length };
  }, [listings]);

  const sortedListings = useMemo(() => {
    const list = [...activeSellListings];
    list.sort((a, b) => {
      const priceA = parseFloat(a.pricePerToken);
      const priceB = parseFloat(b.pricePerToken);
      const amountA = parseFloat(a.amount);
      const amountB = parseFloat(b.amount);
      const scoreA = getProfile(a.seller).greenScore;
      const scoreB = getProfile(b.seller).greenScore;
      if (sortBy === "price-asc") return priceA - priceB;
      if (sortBy === "price-desc") return priceB - priceA;
      if (sortBy === "amount-desc") return amountB - amountA;
      if (sortBy === "score-desc") return scoreB - scoreA;
      return 0;
    });
    return list;
  }, [activeSellListings, sortBy]);

  const compareListings = useMemo(() =>
    sortedListings.filter(l => compareIds.includes(l.id)),
    [sortedListings, compareIds]
  );

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const toggleCompare = (id: number) => {
    if (compareIds.includes(id)) {
      setCompareIds(prev => prev.filter(x => x !== id));
    } else if (compareIds.length < 3) {
      setCompareIds(prev => [...prev, id]);
      if (compareIds.length === 1) {
        toast.info("Click 'Compare' to view side-by-side!", { duration: 2500 });
      }
    } else {
      toast.warning("You can compare up to 3 sellers at a time.");
    }
  };

  const handleBuy = async (listingId: number, totalCostMatic: string) => {
    if (walletMismatch) return;
    if (!signer) {
      toast.error("Please connect your wallet first!");
      return;
    }
    setProcessingId(listingId);
    try {
      const listing = listings.find(l => l.id === listingId);
      const amountStr = listing ? listing.amount : "0";
      const priceStr = listing ? listing.pricePerToken : "0";
      const sellerStr = listing ? listing.seller : "";

      if (listingId >= 101) {
        toast.info("Sending payment deposit to escrow contract (Simulated)...");
        await new Promise(resolve => setTimeout(resolve, 1500));
        const purchasedMocks = JSON.parse(localStorage.getItem("greengrid_purchased_mocks") || "[]");
        purchasedMocks.push(listingId);
        localStorage.setItem("greengrid_purchased_mocks", JSON.stringify(purchasedMocks));
        toast.success("✔ Matched listing & payment successfully escrowed! Awaiting physical delivery...");
        onSuccess({
          amount: amountStr,
          price: priceStr,
          seller: sellerStr,
          total: totalCostMatic
        });
        return;
      }
      toast.info("Sending payment deposit to escrow contract via MetaMask...");
      await buyEnergyListing(signer, listingId, totalCostMatic);
      toast.success("✔ Matched listing & payment successfully escrowed! Awaiting physical delivery...");
      onSuccess({
        amount: amountStr,
        price: priceStr,
        seller: sellerStr,
        total: totalCostMatic
      });
    } catch (err: any) {
      toast.error(err.reason || err.message || "Failed to purchase energy");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-[Space_Grotesk] text-2xl font-bold tracking-tight text-foreground">
            P2P Solar Energy <span className="text-glow-green">Marketplace</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compare solar exporters, review green scores, and buy clean energy directly on-chain.
          </p>
        </div>
        {compareIds.length > 0 && (
          <Button
            onClick={() => setShowCompare(true)}
            className="shrink-0 h-9 px-4 border border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <Scale className="h-3.5 w-3.5" />
            Compare {compareIds.length} Seller{compareIds.length > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* Market Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-[2px] h-full bg-[var(--neon-green)] opacity-40 group-hover:opacity-100 transition-opacity" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Best Price</p>
          {metrics.cheapest ? (
            <>
              <p className="mt-1.5 text-xl font-[Space_Grotesk] font-bold text-glow-green">
                {parseFloat(metrics.cheapest.pricePerToken).toFixed(4)}
                <span className="text-xs font-normal text-muted-foreground ml-1">POL/kWh</span>
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-1 font-mono">
                {getProfile(metrics.cheapest.seller).alias}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">No offers</p>
          )}
          <Award className="absolute bottom-3 right-3 h-6 w-6 text-[var(--neon-green)]/10" />
        </div>

        <div className="glass-panel p-4 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-[2px] h-full bg-[var(--neon-cyan)] opacity-40 group-hover:opacity-100 transition-opacity" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avg Market Rate</p>
          <p className="mt-1.5 text-xl font-[Space_Grotesk] font-bold text-glow-cyan">
            {metrics.avgPrice > 0 ? metrics.avgPrice.toFixed(4) : "—"}
            <span className="text-xs font-normal text-muted-foreground ml-1">POL/kWh</span>
          </p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">
            Across {listings.filter(l => l.isActive && !l.isMatched && !l.isSettled).length} offers
          </p>
          <BarChart3 className="absolute bottom-3 right-3 h-6 w-6 text-[var(--neon-cyan)]/10" />
        </div>

        <div className="glass-panel p-4 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-[2px] h-full bg-purple-500 opacity-40 group-hover:opacity-100 transition-opacity" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Grid Supply</p>
          <p className="mt-1.5 text-xl font-[Space_Grotesk] font-bold text-purple-400">
            {metrics.totalEnergy.toFixed(1)}
            <span className="text-xs font-normal text-muted-foreground ml-1">kWh</span>
          </p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">Available now</p>
          <Zap className="absolute bottom-3 right-3 h-6 w-6 text-purple-500/10" />
        </div>

        <div className="glass-panel p-4 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-[2px] h-full bg-yellow-500 opacity-40 group-hover:opacity-100 transition-opacity" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active Exporters</p>
          <p className="mt-1.5 text-xl font-[Space_Grotesk] font-bold text-yellow-400">
            {sortedListings.length}
          </p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">In filtered view</p>
          <Sun className="absolute bottom-3 right-3 h-6 w-6 text-yellow-500/10" />
        </div>
      </div>

      {/* Search, Filter, Sort Bar */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by seller, alias, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/[0.02] border-white/5 focus:border-[var(--neon-green)]/35 text-foreground h-10 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-3 glass-panel px-3 py-1.5 border-white/5 rounded-xl">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-xs whitespace-nowrap">
            <span className="text-muted-foreground">Max Price:</span>{" "}
            <span className="font-mono text-glow-green font-semibold">{maxPrice.toFixed(4)} POL/kWh</span>
          </div>
          <input
            type="range"
            min="0.0001"
            max="0.005"
            step="0.0001"
            value={maxPrice}
            onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
            className="w-28 accent-[var(--neon-green)] h-1 rounded-lg cursor-pointer bg-white/10"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5" /> Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:border-[var(--neon-green)]/35 cursor-pointer h-10 min-w-[170px]"
          >
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="amount-desc">Energy: High to Low</option>
            <option value="score-desc">Green Score: Best First</option>
          </select>
        </div>
      </div>

      {/* Seller Cards Grid */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sortedListings.map((l) => {
            const totalCost = (parseFloat(l.amount) * parseFloat(l.pricePerToken)).toFixed(5);
            const profile = getProfile(l.seller);
            const isCheapest = metrics.cheapest && l.id === metrics.cheapest.id;
            const isWholesale = parseFloat(l.amount) >= 7.0;
            const isHighGreen = profile.greenScore >= 90;
            const isCompared = compareIds.includes(l.id);

            return (
              <div
                key={l.id}
                className={`glass-panel p-5 relative flex flex-col justify-between transition group overflow-hidden ${
                  isCompared
                    ? "border-[var(--neon-cyan)]/40 shadow-[0_0_20px_rgba(6,182,212,0.12)]"
                    : "hover:border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.02)]"
                }`}
              >
                {/* Top accent line */}
                <div className={`absolute top-0 left-0 w-full h-[2px] ${
                  isCheapest ? "bg-[var(--neon-green)]" :
                  isHighGreen ? "bg-emerald-500" :
                  isWholesale ? "bg-[var(--neon-cyan)]" :
                  "bg-white/5"
                } opacity-60`} />

                {/* Badges row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-wrap gap-1">
                    {isCheapest && (
                      <span className="text-[8px] uppercase tracking-wider font-bold bg-[var(--neon-green)]/15 text-glow-green border border-[var(--neon-green)]/35 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Flame className="h-2.5 w-2.5" /> Best Deal
                      </span>
                    )}
                    {isWholesale && !isCheapest && (
                      <span className="text-[8px] uppercase tracking-wider font-bold bg-[var(--neon-cyan)]/15 text-glow-cyan border border-[var(--neon-cyan)]/35 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Package className="h-2.5 w-2.5" /> Bulk
                      </span>
                    )}
                    {isHighGreen && !isCheapest && !isWholesale && (
                      <span className="text-[8px] uppercase tracking-wider font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Leaf className="h-2.5 w-2.5" /> Top Green
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCompare(l.id)}
                    title={isCompared ? "Remove from comparison" : "Add to compare"}
                    className={`p-1.5 rounded-lg border transition ${
                      isCompared
                        ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-[var(--neon-cyan)]/40"
                        : "bg-white/5 text-muted-foreground border-white/5 hover:border-white/15 hover:text-foreground"
                    }`}
                  >
                    {isCompared ? <CheckCircle className="h-3.5 w-3.5" /> : <Scale className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Seller Profile */}
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--neon-green)]/10 to-[var(--neon-cyan)]/10 border border-white/5 flex items-center justify-center text-lg font-bold text-[var(--neon-green)] shrink-0">
                    {profile.alias.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground truncate">{profile.alias}</span>
                      {profile.verified && (
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--neon-cyan)] shrink-0" title="Verified Seller" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{profile.location}</span>
                    </div>
                  </div>
                </div>

                {/* Green Score + Stars */}
                <div className="flex items-center gap-2 mb-4">
                  <GreenScoreBadge score={profile.greenScore} />
                  <StarRating score={profile.greenScore} />
                  <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                    {profile.panelKw} kWp
                  </span>
                </div>

                {/* Pricing Details */}
                <div className="space-y-2 border-t border-white/5 pt-3 mb-5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Offered Power:
                    </span>
                    <span className="font-mono text-foreground font-bold">{parseFloat(l.amount).toFixed(1)} kWh</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Energy Rate:
                    </span>
                    <span className="font-mono text-glow-green font-bold">{parseFloat(l.pricePerToken).toFixed(4)} POL/kWh</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">All-time Sold:</span>
                    <span className="font-mono text-muted-foreground">{profile.totalSold} MWh</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-dashed border-white/5 pt-2 mt-2">
                    <span className="text-xs font-semibold text-foreground/80">Total Cost:</span>
                    <span className="font-mono text-lg font-bold text-glow-cyan">{totalCost} POL</span>
                  </div>
                </div>

                {/* Buy Button */}
                <Button
                  disabled={processingId === l.id || !!walletMismatch}
                  onClick={() => handleBuy(l.id, totalCost)}
                  className="w-full h-10 border border-[var(--neon-cyan)]/35 bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] rounded-xl text-xs font-bold uppercase tracking-wider transition duration-150 flex items-center justify-center gap-2"
                >
                  {processingId === l.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : walletMismatch ? (
                    "Wallet Mismatch"
                  ) : (
                    <>Match &amp; Buy Offer <ChevronRight className="h-3.5 w-3.5" /></>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && compareListings.length >= 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setShowCompare(false)}
        >
          <div
            className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 max-w-4xl w-full shadow-2xl overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-[Space_Grotesk] text-lg font-bold flex items-center gap-2">
                <Scale className="h-5 w-5 text-[var(--neon-cyan)]" />
                Side-by-Side Seller Comparison
              </h3>
              <button
                onClick={() => setShowCompare(false)}
                className="text-muted-foreground hover:text-foreground transition p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: `180px repeat(${compareListings.length}, 1fr)` }}>
              {/* Label column */}
              <div className="space-y-0">
                {["Seller", "Location", "Panel Capacity", "Green Score", "Rating", "Verified", "Energy Offered", "Price / kWh", "Total Cost", "All-time Sold"].map(label => (
                  <div key={label} className="h-11 flex items-center text-xs text-muted-foreground font-semibold px-2 border-b border-white/5">
                    {label}
                  </div>
                ))}
              </div>

              {compareListings.map(l => {
                const profile = getProfile(l.seller);
                const totalCost = (parseFloat(l.amount) * parseFloat(l.pricePerToken)).toFixed(5);
                const rows = [
                  <span className="font-bold text-foreground">{profile.alias}</span>,
                  <span className="flex items-center gap-1 text-muted-foreground text-[10px]"><MapPin className="h-3 w-3 shrink-0" />{profile.location}</span>,
                  <span className="font-mono text-foreground">{profile.panelKw} kWp</span>,
                  <GreenScoreBadge score={profile.greenScore} />,
                  <StarRating score={profile.greenScore} />,
                  profile.verified
                    ? <span className="text-[var(--neon-cyan)] flex items-center gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" /> Verified</span>
                    : <span className="text-muted-foreground text-[10px]">Unverified</span>,
                  <span className="font-mono text-foreground">{parseFloat(l.amount).toFixed(1)} kWh</span>,
                  <span className="font-mono text-glow-green">{parseFloat(l.pricePerToken).toFixed(4)} POL</span>,
                  <span className="font-mono text-glow-cyan font-bold">{totalCost} POL</span>,
                  <span className="text-muted-foreground text-[10px]">{profile.totalSold} MWh</span>,
                ];
                return (
                  <div key={l.id} className="glass-panel rounded-xl overflow-hidden">
                    {rows.map((cell, i) => (
                      <div key={i} className="h-11 flex items-center px-3 border-b border-white/5 last:border-0 text-xs">
                        {cell}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-white/5">
              {compareListings.map(l => {
                const profile = getProfile(l.seller);
                const totalCost = (parseFloat(l.amount) * parseFloat(l.pricePerToken)).toFixed(5);
                return (
                  <Button
                    key={l.id}
                    disabled={processingId === l.id || !!walletMismatch}
                    onClick={async () => {
                      await handleBuy(l.id, totalCost);
                      setShowCompare(false);
                    }}
                    className="flex-1 h-10 border border-[var(--neon-cyan)]/35 bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 rounded-xl text-xs font-bold uppercase tracking-wider"
                  >
                    {processingId === l.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      `Buy from ${profile.alias}`
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Other Tab Views ──
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
