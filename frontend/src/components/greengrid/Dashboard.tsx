import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Zap,
  Sun,
  Activity,
  Coins,
  Leaf,
  Radio,
  Settings2,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  CircleDot,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EnergyMap } from "./EnergyMap";
import { toast } from "sonner";
import { ethers } from "ethers";
import { Login } from "./Login";
import { MarketplaceView, ContractsView, AnalyticsView, SELLER_PROFILES } from "./MarketplaceView";

// Import Web3 Helpers
import {
  connectWallet,
  getGCBalance,
  getListingsFromChain,
  createListing,
  buyEnergyListing,
  settleListingViaOracle,
  abortListingViaOracle,
  mintCreditsViaOracle,
  Listing,
  GREEN_COIN_ADDRESS,
  ENERGY_TRADING_ADDRESS
} from "../../lib/web3";

const generationCurve = [
  { t: "6", kwh: 0.2 },
  { t: "8", kwh: 1.4 },
  { t: "10", kwh: 4.8 },
  { t: "12", kwh: 8.2 },
  { t: "13", kwh: 8.9 },
  { t: "14", kwh: 8.5 },
  { t: "16", kwh: 6.1 },
  { t: "18", kwh: 2.3 },
  { t: "20", kwh: 0.4 },
];

const consumptionCurve = [
  { t: "6", kwh: 1.1 },
  { t: "8", kwh: 2.8 },
  { t: "10", kwh: 2.1 },
  { t: "12", kwh: 3.4 },
  { t: "13", kwh: 3.9 },
  { t: "14", kwh: 3.2 },
  { t: "16", kwh: 2.5 },
  { t: "18", kwh: 4.1 },
  { t: "20", kwh: 3.6 },
];

type Tx = {
  id: string;
  kind: "sell" | "buy";
  kwh: number;
  gc: number;
  addr: string;
  ago: string;
};

const seedTx: Tx[] = [
  { id: "0xa1", kind: "sell", kwh: 2.5, gc: 5, addr: "0x89F...7C2", ago: "just now" },
  { id: "0xa2", kind: "sell", kwh: 1.2, gc: 2.4, addr: "0x41A...9E8", ago: "12s" },
  { id: "0xa3", kind: "buy", kwh: 0.8, gc: 1.6, addr: "Utility Grid", ago: "38s" },
  { id: "0xa4", kind: "sell", kwh: 3.1, gc: 6.2, addr: "0xB0D...1F4", ago: "1m" },
  { id: "0xa5", kind: "sell", kwh: 0.6, gc: 1.2, addr: "0x77E...C10", ago: "2m" },
];

function truncateAddress(address: string) {
  if (!address || address === ethers.ZeroAddress) return "None";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function Dashboard() {
  const [minPrice, setMinPrice] = useState<number[]>([1.8]);
  const [autoTrade, setAutoTrade] = useState(true);
  const [feed, setFeed] = useState<Tx[]>([]);
  const [activeTab, setActiveTab] = useState<string>("grid");
  
  // User Authentication state
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("greengrid_user");
    }
    return null;
  });

  // Web3 states
  const [account, setAccount] = useState<string | null>(null);
  const [balanceGC, setBalanceGC] = useState<string>("0");
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState<boolean>(false);
  const [oracleStatus, setOracleStatus] = useState<boolean>(false);

  // Calculate wallet mismatch relative to logged in user's locked address
  const walletMismatch = useMemo(() => {
    if (!currentUser || !account) return false;
    const lockedWallet = localStorage.getItem(`greengrid_wallet_${currentUser}`);
    if (!lockedWallet) return false;
    return lockedWallet.toLowerCase() !== account.toLowerCase();
  }, [currentUser, account]);

  // Dynamic Solar Telemetry simulation states
  const [simHour, setSimHour] = useState<number>(12);
  const [simGen, setSimGen] = useState<number>(8.5);
  const [simCon, setSimCon] = useState<number>(3.2);

  // Dynamic Sparkline histories (rolling windows of last 9 hours)
  const [genHistory, setGenHistory] = useState<{ t: string; kwh: number }[]>(generationCurve);
  const [conHistory, setConHistory] = useState<{ t: string; kwh: number }[]>(consumptionCurve);

  // Ticking simulated clock matching the smart meter speed (3 seconds per hour)
  useEffect(() => {
    const timer = setInterval(() => {
      setSimHour(prev => {
        const next = (prev + 1) % 24;
        
        // Solar Curve Generation
        let gen = 0;
        if (next >= 6 && next <= 18) {
          const angle = Math.PI * (next - 6) / 12;
          gen = 8.5 * Math.sin(angle) * (0.90 + Math.random() * 0.10);
        }
        
        // Load Curve Consumption
        let con = 0.8;
        if (next >= 7 && next <= 9) con = 3.5;
        else if (next >= 18 && next <= 21) con = 5.0;
        else if (next >= 10 && next <= 16) con = 1.8;
        con += Math.random() * 0.4 - 0.2;
        
        const finalGen = parseFloat(gen.toFixed(2));
        const finalCon = parseFloat(Math.max(0.1, con).toFixed(2));

        setSimGen(finalGen);
        setSimCon(finalCon);
        
        // Push to rolling history arrays
        setGenHistory(prev => [...prev.slice(1), { t: next.toString(), kwh: finalGen }]);
        setConHistory(prev => [...prev.slice(1), { t: next.toString(), kwh: finalCon }]);
        
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const netFlow = simGen - simCon;

  // Helper to synchronize connected wallet with user profiles
  const syncUserWithWallet = (walletAddress: string, signerInstance: ethers.Signer) => {
    if (!walletAddress) return;
    
    // Search if any user in localStorage is linked to this walletAddress
    let foundUser: string | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("greengrid_wallet_")) {
        const linkedVal = localStorage.getItem(key);
        if (linkedVal && linkedVal.toLowerCase() === walletAddress.toLowerCase()) {
          foundUser = key.replace("greengrid_wallet_", "");
          break;
        }
      }
    }

    if (foundUser) {
      // If a different user is associated with this wallet, switch the logged-in user profile
      if (foundUser !== currentUser) {
        setCurrentUser(foundUser);
        localStorage.setItem("greengrid_user", foundUser);
        toast.info(`Switched user profile to "${foundUser}" to match connected wallet.`);
      }
    } else if (currentUser) {
      // If the wallet is new and not linked to any user yet, link it to current logged-in user
      localStorage.setItem(`greengrid_wallet_${currentUser}`, walletAddress);
      toast.success(`Linked wallet ${truncateAddress(walletAddress)} to user "${currentUser}"`);
    }

    setAccount(walletAddress);
    setSigner(signerInstance);
    refreshState(walletAddress);
  };

  // Connect Wallet handler
  const handleConnect = async () => {
    try {
      const wallet = await connectWallet();
      syncUserWithWallet(wallet.address, wallet.signer);
      toast.success("Wallet connected successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to connect wallet");
    }
  };

  // Switch Wallet handler
  const handleSwitchWallet = async () => {
    try {
      if (!window.ethereum) {
        toast.error("MetaMask is not installed.");
        return;
      }
      
      toast.info("Requesting account switch in MetaMask...");
      // Request permissions to trigger account select popup
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }]
      });
      
      const wallet = await connectWallet();
      syncUserWithWallet(wallet.address, wallet.signer);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to switch wallet");
    }
  };

  // Refresh Web3 balances and on-chain listings
  const refreshState = async (addr?: string) => {
    const activeAddr = addr || account;
    if (activeAddr) {
      const bal = await getGCBalance(activeAddr);
      setBalanceGC(parseFloat(bal).toFixed(2));
    }
    
    setLoadingListings(true);
    const chainListings = await getListingsFromChain();

    // Define mock listings under 0.005 POL per kWh for visual marketplace comparison
    const mockListings: Listing[] = [
      {
        id: 101,
        seller: "0x89F3119561E8D303C0D0aB1e57cFFd570245C7C2",
        amount: "2.5",
        pricePerToken: "0.0012",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 102,
        seller: "0x41A23e8f810Ac09d3031789A4096a5F69Ef27f51",
        amount: "4.0",
        pricePerToken: "0.0028",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 103,
        seller: "0xB0D31789A4096a5F69Ef27f5170dcBe43df2Fa67",
        amount: "1.5",
        pricePerToken: "0.0045",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 104,
        seller: "0x77EC104CA2Dc4813ED58CcCd678619E87C2d450b",
        amount: "5.0",
        pricePerToken: "0.0032",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 105,
        seller: "0x9E87C2d450b06FCcC77EC104CA2Dc4813ED58CcC",
        amount: "3.2",
        pricePerToken: "0.0050",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 106,
        seller: "0xC3A22f9c89D3031789b81aD83C0D0aB1e57cFFd5",
        amount: "6.0",
        pricePerToken: "0.0008",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 107,
        seller: "0xD14f67B2e3F89B0D3189A5031B7aCCd678219e88",
        amount: "8.5",
        pricePerToken: "0.0015",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 108,
        seller: "0xE56c12B3a90D3C2eF89a5F69Ef27F519E87D3A10",
        amount: "2.0",
        pricePerToken: "0.0022",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 109,
        seller: "0xF7aD23C4b12E96a5B69Ef27f5170dcBe43df2Fb1",
        amount: "10.0",
        pricePerToken: "0.0035",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 110,
        seller: "0xA18b34D5c06FCcC77EC204CA2Dc4813ED58CcCd6",
        amount: "1.8",
        pricePerToken: "0.0041",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 111,
        seller: "0xB29e45E6D1789A4096a5F69Ef27f5170dcB43df3",
        amount: "7.2",
        pricePerToken: "0.0019",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 112,
        seller: "0xC3Af56G7E2a3F89B1D3189A5031B7aCCd678219f9",
        amount: "3.8",
        pricePerToken: "0.0047",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      },
      {
        id: 113,
        seller: "0xD4B067C8F3a4G90B2E3289B5132C8bDDe789320a",
        amount: "12.0",
        pricePerToken: "0.0011",
        buyer: "0x0000000000000000000000000000000000000000",
        matchedAt: 0,
        isActive: true,
        isMatched: false,
        isSettled: false
      }
    ];

    const purchasedMockIds = JSON.parse(localStorage.getItem("greengrid_purchased_mocks") || "[]");
    const settledMockIds = JSON.parse(localStorage.getItem("greengrid_settled_mocks") || "[]");

    // Process mocks with purchase and settlement flags
    const processedMocks = mockListings.map(m => {
      const isMatched = purchasedMockIds.includes(m.id);
      const isSettled = settledMockIds.includes(m.id);
      return {
        ...m,
        isMatched,
        isSettled,
        isActive: !isSettled,
        buyer: isMatched ? (activeAddr || "0xd3031789A4096a5F69Ef27f5170dcBe43df2Fa67") : m.buyer,
        matchedAt: isMatched ? 1783801112 : 0
      };
    });

    // Show active and matched mocks in listings state
    const activeOrMatchedMocks = processedMocks.filter(m => !m.isSettled);
    setListings([...activeOrMatchedMocks, ...chainListings]);
    
    // Map actual settled listings and settled mock listings to feed
    const settledChainListings = chainListings.filter(l => l.isSettled);
    const settledMocks = processedMocks.filter(m => m.isSettled);

    const mappedChainFeed: Tx[] = settledChainListings.map(l => {
      const isSeller = activeAddr && l.seller.toLowerCase() === activeAddr.toLowerCase();
      const isBuyer = activeAddr && l.buyer.toLowerCase() === activeAddr.toLowerCase();
      
      let agoStr = "completed";
      if (l.matchedAt > 0) {
        const diffSeconds = Math.floor(Date.now() / 1000) - l.matchedAt;
        if (diffSeconds < 60) agoStr = "just now";
        else if (diffSeconds < 3600) agoStr = `${Math.floor(diffSeconds / 60)}m ago`;
        else if (diffSeconds < 86400) agoStr = `${Math.floor(diffSeconds / 3600)}h ago`;
        else agoStr = `${Math.floor(diffSeconds / 86400)}d ago`;
      }
      
      return {
        id: `chain-${l.id}`,
        kind: isBuyer ? "buy" : "sell",
        kwh: parseFloat(l.amount),
        gc: parseFloat((parseFloat(l.amount) * parseFloat(l.pricePerToken)).toFixed(6)),
        addr: isSeller ? truncateAddress(l.buyer) : truncateAddress(l.seller),
        ago: agoStr
      };
    });

    const mappedMockFeed: Tx[] = settledMocks.map(m => {
      const isSeller = activeAddr && m.seller.toLowerCase() === activeAddr.toLowerCase();
      const isBuyer = activeAddr && m.buyer.toLowerCase() === activeAddr.toLowerCase();
      return {
        id: `mock-${m.id}`,
        kind: isBuyer ? "buy" : "sell",
        kwh: parseFloat(m.amount),
        gc: parseFloat((parseFloat(m.amount) * parseFloat(m.pricePerToken)).toFixed(6)),
        addr: isSeller ? truncateAddress(m.buyer) : truncateAddress(m.seller),
        ago: "just now"
      };
    });

    const combinedFeed = [...mappedMockFeed, ...mappedChainFeed];
    
    // Sort combined feed by listing ID descending
    combinedFeed.sort((a, b) => {
      const getNum = (idStr: string) => parseInt(idStr.replace("chain-", "").replace("mock-", ""));
      return getNum(b.id) - getNum(a.id);
    });
    
    setFeed(combinedFeed);
    setLoadingListings(false);
  };

  // Ping backend to check if Oracle is running
  const checkBackendOracle = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/");
      if (res.ok) {
        setOracleStatus(true);
      } else {
        setOracleStatus(false);
      }
    } catch {
      setOracleStatus(false);
    }
  };

  // Listen to accountsChanged and handle auto-connection on login
  useEffect(() => {
    if (!currentUser) {
      setAccount(null);
      setSigner(null);
      return;
    }

    const initConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            const activeAddress = accounts[0].address;
            const signerInstance = await provider.getSigner();
            syncUserWithWallet(activeAddress, signerInstance);
          }
        } catch (err) {
          console.error("Auto-connect failed:", err);
        }
      }
    };

    initConnection();

    if (window.ethereum) {
      const handleAccounts = async (accounts: string[]) => {
        if (accounts.length > 0) {
          const newAddr = accounts[0];
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signerInstance = await provider.getSigner();
          syncUserWithWallet(newAddr, signerInstance);
        } else {
          setAccount(null);
          setSigner(null);
        }
      };
      
      window.ethereum.on("accountsChanged", handleAccounts);
      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccounts);
      };
    }
  }, [currentUser]);

  useEffect(() => {
    checkBackendOracle();
    if (currentUser) {
      refreshState();
    }
    
    // Auto refresh listings and status every 8 seconds
    const interval = setInterval(() => {
      if (currentUser) {
        refreshState();
      }
      checkBackendOracle();
    }, 8000);
    
    return () => clearInterval(interval);
  }, [account, currentUser]);

  const handleLogout = () => {
    localStorage.removeItem("greengrid_user");
    setCurrentUser(null);
    setAccount(null);
    setSigner(null);
    toast.info("Logged out successfully.");
  };

  const handleLogin = (username: string) => {
    localStorage.setItem("greengrid_user", username);
    setCurrentUser(username);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen text-foreground">
      <Navbar 
        account={account} 
        balanceGC={balanceGC} 
        onConnect={handleConnect} 
        onSwitchWallet={handleSwitchWallet}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      
      <main className="mx-auto max-w-[1500px] space-y-5 px-5 pb-10 pt-6">
        
        {/* Wallet Mismatch Warning Banner */}
        {walletMismatch && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex flex-col lg:flex-row items-center justify-between gap-3 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <span className="font-semibold block">MetaMask Wallet Mismatch!</span>
                <span className="text-xs text-muted-foreground">
                  You are logged in as <strong className="text-foreground">{currentUser}</strong>, which is locked to wallet <strong className="font-[JetBrains_Mono] text-foreground">{localStorage.getItem(`greengrid_wallet_${currentUser}`)}</strong>. However, MetaMask is currently on account <strong className="font-[JetBrains_Mono] text-foreground">{account}</strong>.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                onClick={handleSwitchWallet}
                className="text-xs font-semibold bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/30 text-red-300 transition duration-150"
              >
                Switch Wallet
              </Button>
              <Button
                onClick={() => {
                  if (account) {
                    localStorage.setItem(`greengrid_wallet_${currentUser}`, account);
                    toast.success(`Successfully linked "${currentUser}" to wallet ${truncateAddress(account)}`);
                    refreshState(account);
                  }
                }}
                className="text-xs font-semibold bg-[var(--neon-green)]/15 px-3 py-1.5 rounded-lg border border-[var(--neon-green)]/35 hover:bg-[var(--neon-green)]/25 text-[var(--neon-green)] transition duration-150"
              >
                Relink Wallet
              </Button>
            </div>
          </div>
        )}

        {/* Connection/Oracle Alert */}
        {!oracleStatus && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-red-500 animate-pulse" />
              <span><strong>Oracle Offline:</strong> The FastAPI backend server is not running on <code>http://127.0.0.1:8000</code>. Oracle confirmations will fail. Please run the server to test full settlement.</span>
            </div>
          </div>
        )}

        {activeTab === "grid" && (
          <>
            {/* Row 1: Map full width */}
            <EnergyMap account={account} netFlow={netFlow} />

            {/* Row 2: Stats + QuickTrade + Ledger */}
            <div className="grid grid-cols-12 gap-5">
              <aside className="col-span-12 lg:col-span-4 space-y-5">
                <LiveStats 
                  generation={simGen} 
                  consumption={simCon} 
                  netFlow={netFlow} 
                  hour={simHour} 
                  genHistory={genHistory}
                  conHistory={conHistory}
                />
                <EnvCard account={account} onSuccess={() => refreshState()} />
              </aside>

              <section className="col-span-12 lg:col-span-5 space-y-5">
                <QuickTrade 
                  signer={signer} 
                  account={account} 
                  suggestedPrice={minPrice[0]} 
                  onSuccess={() => refreshState()} 
                  onConnect={handleConnect}
                  walletMismatch={walletMismatch}
                  listings={listings}
                />
                <ActionCard
                  minPrice={minPrice[0]}
                  onMinPrice={(v) => setMinPrice(v)}
                  autoTrade={autoTrade}
                  setAutoTrade={setAutoTrade}
                />
              </section>

              <aside className="col-span-12 lg:col-span-3">
                <Ledger feed={feed} />
              </aside>
            </div>

            {/* Row 3: Active Listings/Marketplace */}
            <ActiveListings 
              listings={listings} 
              loading={loadingListings} 
              signer={signer} 
              account={account} 
              onSuccess={() => refreshState()}
              walletMismatch={walletMismatch}
            />
          </>
        )}

        {activeTab === "market" && (
          <MarketplaceView
            listings={listings}
            loading={loadingListings}
            signer={signer}
            account={account}
            onSuccess={() => refreshState()}
            walletMismatch={walletMismatch}
          />
        )}

        {activeTab === "contracts" && (
          <ContractsView />
        )}

        {activeTab === "analytics" && (
          <AnalyticsView />
        )}

      </main>
    </div>
  );
}

function Navbar({ 
  account, 
  balanceGC, 
  onConnect,
  onSwitchWallet,
  currentUser,
  onLogout,
  activeTab,
  setActiveTab
}: { 
  account: string | null; 
  balanceGC: string; 
  onConnect: () => void;
  onSwitchWallet: () => void;
  currentUser: string | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 backdrop-blur-xl bg-background/60">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 overflow-hidden shadow-[0_0_10px_rgba(34,197,94,0.1)]">
            <img src="/favicon.png" className="h-6 w-6 object-contain" alt="GreenGrid Logo" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-[Space_Grotesk] text-lg font-bold tracking-tight">
              Green<span className="text-glow-green">Grid</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              P2P Solar · Polygon Amoy
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 rounded-full glass-panel px-1.5 py-1.5 text-sm">
          {["Grid", "Market", "Contracts", "Analytics"].map((n) => {
            const tabKey = n.toLowerCase();
            const isActive = activeTab === tabKey;
            return (
              <button
                key={n}
                onClick={() => setActiveTab(tabKey)}
                className={`rounded-full px-4 py-1.5 transition font-semibold ${
                  isActive
                    ? "bg-white/10 text-glow-green shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {currentUser && (
            <div className="flex items-center gap-2 glass-panel px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">User:</span>
              <span className="font-semibold text-glow-green">{currentUser}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onLogout}
                className="h-6 px-2 hover:bg-white/5 text-red-400 hover:text-red-300 font-medium rounded text-[11px]"
              >
                Log Out
              </Button>
            </div>
          )}

          {account && (
            <div className="hidden sm:flex items-center gap-2 glass-panel px-3 py-2 font-[JetBrains_Mono] text-xs">
              <Coins className="h-4 w-4 text-glow-green" />
              <span className="font-semibold">{balanceGC}</span>
              <span className="text-muted-foreground">GRN</span>
            </div>
          )}
          
          {account ? (
            <button 
              onClick={onSwitchWallet}
              className="flex items-center gap-2 glass-panel px-3 py-2 text-xs transition duration-200 hover:bg-white/5 active:scale-95 group relative cursor-pointer"
              title="Click to switch MetaMask account"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--neon-green)] opacity-70"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--neon-green)]"></span>
              </span>
              <Wallet className="h-4 w-4 text-glow-cyan group-hover:text-[var(--neon-green)] transition-colors" strokeWidth={2.5} />
              <span className="font-[JetBrains_Mono] group-hover:text-[var(--neon-green)] transition-colors">{truncateAddress(account)}</span>
              <span className="ml-1 text-[9px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">(Switch)</span>
            </button>
          ) : (
            <Button 
              onClick={onConnect}
              className="border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-semibold hover:bg-[var(--neon-green)]/20 shadow-[0_0_15px_rgba(34,197,94,0.15)] px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition duration-200"
            >
              <img src="/favicon.png" className="h-3.5 w-3.5 object-contain" alt="Logo" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function LiveStats({
  generation,
  consumption,
  netFlow,
  hour,
  genHistory,
  conHistory
}: {
  generation: number;
  consumption: number;
  netFlow: number;
  hour: number;
  genHistory: { t: string; kwh: number }[];
  conHistory: { t: string; kwh: number }[];
}) {
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const timeStr = `${displayHour.toString().padStart(2, '0')}:00 ${ampm}`;

  const isExporting = netFlow >= 0;
  
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
          Live Stats <span className="text-[10px] text-[var(--neon-cyan)] lowercase font-mono">({timeStr})</span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <CircleDot className="h-3 w-3 text-[var(--neon-green)] animate-pulse" /> streaming
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <StatWithSparkline
          label="Current Generation"
          value={generation.toFixed(2)}
          unit="kWh"
          delta="+12.4%"
          up
          tone="green"
          icon={<Sun className="h-3.5 w-3.5" />}
          data={genHistory}
        />
        <StatWithSparkline
          label="Current Consumption"
          value={consumption.toFixed(2)}
          unit="kWh"
          delta="−4.1%"
          up={false}
          tone="cyan"
          icon={<Activity className="h-3.5 w-3.5" />}
          data={conHistory}
        />
        <StatWithSparkline
          label={isExporting ? "Net Export" : "Net Import"}
          value={Math.abs(netFlow).toFixed(2)}
          unit="kWh"
          delta={isExporting ? "+8.2%" : "−3.5%"}
          up={isExporting}
          tone={isExporting ? "green" : "cyan"}
          icon={<Zap className="h-3.5 w-3.5" />}
          data={genHistory.map((d, i) => {
            const conVal = conHistory[i] ? conHistory[i].kwh : 0;
            return {
              t: d.t,
              kwh: Math.max(0, d.kwh - conVal)
            };
          })}
        />
      </div>
    </div>
  );
}

function StatWithSparkline({
  label,
  value,
  unit,
  delta,
  up,
  tone,
  icon,
  data,
}: {
  label: string;
  value: string;
  unit: string;
  delta: string;
  up: boolean;
  tone: "green" | "cyan";
  icon: React.ReactNode;
  data: { t: string; kwh: number }[];
}) {
  const color = tone === "green" ? "var(--neon-green)" : "var(--neon-cyan)";
  const glowClass = tone === "green" ? "text-glow-green" : "text-glow-cyan";
  const gradId = `spark-${label.replace(/\s+/g, "")}`;
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span style={{ color }}>{icon}</span>
          {label}
        </div>
        <div
          className={`flex items-center gap-1 text-[10px] font-[JetBrains_Mono] ${
            up ? "text-[var(--neon-green)]" : "text-muted-foreground"
          }`}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta}
        </div>
      </div>

      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className={`font-[Space_Grotesk] text-3xl font-bold tracking-tight ${glowClass}`}>
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
        <div className="h-10 flex-1 max-w-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide />
              <Area
                type="monotone"
                dataKey="kwh"
                stroke={color}
                strokeWidth={1.8}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function QuickTrade({ 
  signer, 
  account, 
  suggestedPrice, 
  onSuccess,
  onConnect,
  walletMismatch,
  listings
}: { 
  signer: ethers.Signer | null; 
  account: string | null;
  suggestedPrice: number; 
  onSuccess: () => void;
  onConnect: () => void;
  walletMismatch?: boolean;
  listings: Listing[];
}) {
  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [amount, setAmount] = useState("5.0");
  const [price, setPrice] = useState(suggestedPrice.toFixed(2));
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (side === "sell") {
      setPrice(suggestedPrice.toFixed(2));
    }
  }, [suggestedPrice, side]);

  const activeListings = useMemo(() => {
    return listings.filter(
      (l) => l.isActive && !l.isMatched && l.seller.toLowerCase() !== account?.toLowerCase()
    );
  }, [listings, account]);

  // Auto-select cheapest listing on Buy tab
  useEffect(() => {
    if (side === "buy" && activeListings.length > 0) {
      if (!selectedId || !activeListings.some(l => l.id.toString() === selectedId)) {
        const sorted = [...activeListings].sort(
          (a, b) => parseFloat(a.pricePerToken) - parseFloat(b.pricePerToken)
        );
        setSelectedId(sorted[0].id.toString());
        setAmount(sorted[0].amount);
        setPrice(parseFloat(sorted[0].pricePerToken).toString());
      }
    }
  }, [side, activeListings, selectedId]);

  const handleSelectListing = (idStr: string) => {
    setSelectedId(idStr);
    const l = activeListings.find(item => item.id.toString() === idStr);
    if (l) {
      setAmount(l.amount);
      setPrice(parseFloat(l.pricePerToken).toString());
    }
  };

  const total = (parseFloat(amount || "0") * parseFloat(price || "0") || 0).toFixed(6).replace(/\.?0+$/, "");
  const isSell = side === "sell";
  const accent = isSell ? "var(--neon-green)" : "var(--neon-cyan)";
  const accentClass = isSell ? "text-glow-green" : "text-glow-cyan";

  const handleSubmit = async () => {
    if (walletMismatch) return;
    if (!account || !signer) {
      onConnect();
      return;
    }

    if (isSell) {
      const parsedAmount = parseFloat(amount || "0");
      const parsedPrice = parseFloat(price || "0");
      if (isNaN(parsedAmount) || parsedAmount <= 0 || isNaN(parsedPrice) || parsedPrice <= 0) {
        toast.error("Please enter a valid amount and price");
        return;
      }

      // Check user GreenCoin balance before listing on blockchain
      try {
        const userBalance = await getGCBalance(account);
        if (parseFloat(userBalance) < parsedAmount) {
          toast.error(`Insufficient GreenCoin (GRN) balance. You have ${parseFloat(userBalance).toFixed(2)} GRN, but tried to list ${parsedAmount} GRN. Go to the Contracts tab to mint credits first!`);
          return;
        }
      } catch (err) {
        console.warn("Failed to check token balance before listing, proceeding anyway:", err);
      }
      setLoading(true);
      try {
        toast.info("1. Approving GreenCoin token spend in MetaMask...");
        const receipt = await createListing(signer, amount, price);
        toast.success("✔ Energy listed successfully on the blockchain!");
        onSuccess();
      } catch (err: any) {
        console.error(err);
        toast.error(err.reason || err.message || "Transaction failed");
      } finally {
        setLoading(false);
      }
    } else {
      const selectedListing = activeListings.find(l => l.id.toString() === selectedId);
      if (!selectedListing) {
        toast.error("Please select an active listing to purchase");
        return;
      }
      setLoading(true);
      try {
        if (selectedListing.id >= 101) {
          toast.info("Sending payment deposit to escrow contract (Simulated)...");
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const purchasedMocks = JSON.parse(localStorage.getItem("greengrid_purchased_mocks") || "[]");
          purchasedMocks.push(selectedListing.id);
          localStorage.setItem("greengrid_purchased_mocks", JSON.stringify(purchasedMocks));
          toast.success("✔ Matched listing & payment successfully escrowed! Awaiting physical delivery...");
          onSuccess();
        } else {
          toast.info("Sending payment deposit to escrow contract via MetaMask...");
          await buyEnergyListing(signer, selectedListing.id, total);
          toast.success("✔ Matched listing & payment successfully escrowed! Awaiting physical delivery...");
          onSuccess();
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err.reason || err.message || "Failed to purchase energy");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Quick Trade
          </div>
          <div className="mt-1 font-[Space_Grotesk] text-lg font-semibold">
            Instant P2P Order
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>Action</div>
          <div className="font-[JetBrains_Mono] text-foreground">
            {isSell ? "List Excess Energy" : "Buy from Neighbors"}
          </div>
        </div>
      </div>

      {/* Side toggle */}
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
        <button
          onClick={() => setSide("sell")}
          className={`rounded-lg py-2.5 text-sm font-semibold transition ${
            isSell
              ? "bg-[var(--neon-green)]/15 text-glow-green shadow-[inset_0_0_0_1px_var(--neon-green)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowUpRight className="mr-1 inline h-4 w-4" />
          Sell Energy
        </button>
        <button
          onClick={() => setSide("buy")}
          className={`rounded-lg py-2.5 text-sm font-semibold transition ${
            !isSell
              ? "bg-[var(--neon-cyan)]/15 text-glow-cyan shadow-[inset_0_0_0_1px_var(--neon-cyan)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowDownLeft className="mr-1 inline h-4 w-4" />
          Buy Energy
        </button>
      </div>

      {/* Inputs */}
      {isSell ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FieldGroup
            label="Amount"
            suffix="kWh"
            value={amount}
            onChange={setAmount}
            quickValues={["1", "2.5", "5", "10"]}
            onQuick={setAmount}
          />
          <FieldGroup
            label="Price"
            suffix="POL/kWh"
            value={price}
            onChange={setPrice}
            hint={`market · ${suggestedPrice.toFixed(2)}`}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Select Active Seller Listing
            </label>
            {activeListings.length > 0 ? (
              <select
                value={selectedId}
                onChange={(e) => handleSelectListing(e.target.value)}
                className="mt-1.5 w-full h-11 rounded-lg border border-white/10 bg-black/40 text-sm text-foreground focus:ring-1 focus:ring-[var(--neon-cyan)]/40 px-3 outline-none"
              >
                {activeListings.map((l) => {
                  const profile = SELLER_PROFILES[l.seller.toLowerCase()];
                  const name = profile ? profile.alias : truncateAddress(l.seller);
                  return (
                    <option key={l.id} value={l.id} className="bg-slate-900 text-foreground">
                      {name} — {l.amount} kWh @ {parseFloat(l.pricePerToken)} POL/kWh
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="mt-1.5 border border-dashed border-white/10 rounded-xl p-4 text-center text-xs text-muted-foreground">
                No active listings available to buy right now.
              </div>
            )}
          </div>
          {selectedId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Amount to Buy
                </label>
                <div className="relative mt-1.5">
                  <Input
                    value={amount}
                    disabled
                    className="h-11 border-white/10 bg-white/[0.01] pr-16 font-[JetBrains_Mono] text-base opacity-75"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    kWh
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Seller Price
                </label>
                <div className="relative mt-1.5">
                  <Input
                    value={price}
                    disabled
                    className="h-11 border-white/10 bg-white/[0.01] pr-16 font-[JetBrains_Mono] text-base opacity-75"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    POL/kWh
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{isSell ? "You receive" : "You pay"}</span>
          <span className="font-[JetBrains_Mono]">gas ~0.0002 POL</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className={`font-[Space_Grotesk] text-3xl font-bold ${accentClass}`}>
              {total}
            </span>
            <span className="text-sm text-muted-foreground">POL</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-[JetBrains_Mono]">{amount || "0"} GRN (kWh)</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-[JetBrains_Mono]">{total} POL</span>
          </div>
        </div>
      </div>

      <Button
        disabled={loading || walletMismatch || (!isSell && activeListings.length === 0)}
        onClick={handleSubmit}
        className="mt-4 h-12 w-full text-base font-semibold text-background hover:opacity-90 disabled:opacity-50"
        style={{
          background: isSell
            ? "var(--gradient-neon)"
            : "linear-gradient(135deg, var(--neon-cyan), var(--neon-green))",
          boxShadow: `0 0 30px color-mix(in oklab, ${accent} 40%, transparent)`,
        }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Processing...
          </span>
        ) : walletMismatch ? (
          "Wallet Mismatch - Switch MetaMask Account"
        ) : account ? (
          isSell ? "List Energy for Sale" : "Purchase Energy"
        ) : (
          isSell ? "Connect Wallet to List" : "Connect Wallet to Buy"
        )}
      </Button>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className={`h-3 w-3 ${isSell ? "text-[var(--neon-green)]" : "text-[var(--neon-cyan)]"}`} />
        Executes via GreenGrid Escrow Contract
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  suffix,
  value,
  onChange,
  quickValues,
  onQuick,
  hint,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  quickValues?: string[];
  onQuick?: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        {hint && (
          <span className="text-[10px] font-[JetBrains_Mono] text-muted-foreground">{hint}</span>
        )}
      </div>
      <div className="relative mt-1.5">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 border-white/10 bg-white/[0.03] pr-16 font-[JetBrains_Mono] text-base focus-visible:ring-[var(--neon-green)]/40"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
      {quickValues && (
        <div className="mt-2 flex gap-1">
          {quickValues.map((q) => (
            <button
              key={q}
              onClick={() => onQuick?.(q)}
              className="flex-1 rounded-md border border-white/5 bg-white/[0.02] py-1 text-[10px] font-[JetBrains_Mono] text-muted-foreground transition hover:border-[var(--neon-green)]/30 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EnvCard({ account, onSuccess }: { account: string | null; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleMintTestCredits = async () => {
    if (!account) {
      toast.error("Please connect your wallet first!");
      return;
    }

    setLoading(true);
    try {
      const res = await mintCreditsViaOracle(account, 50.0);
      toast.success("✔ Successfully minted 50.0 GRN (kWh) test credits to your wallet via Oracle!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to mint test credits");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>Impact & Faucet</span>
        <Leaf className="h-3.5 w-3.5 text-[var(--neon-green)]" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 items-center">
        <div>
          <div className="font-[Space_Grotesk] text-2xl font-bold">4.2<span className="text-sm text-muted-foreground ml-1">kg</span></div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CO₂ offset</div>
        </div>
        <div>
          <Button
            size="sm"
            disabled={loading || !account}
            onClick={handleMintTestCredits}
            className="w-full bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 hover:bg-[var(--neon-green)]/20 text-glow-green text-[10px] py-4 uppercase font-semibold"
          >
            {loading ? "Minting..." : "Simulate Solar (Mint 50 GRN)"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  minPrice,
  onMinPrice,
  autoTrade,
  setAutoTrade,
}: {
  minPrice: number;
  onMinPrice: (v: number[]) => void;
  autoTrade: boolean;
  setAutoTrade: (b: boolean) => void;
}) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[var(--neon-cyan)]" />
          <h3 className="font-[Space_Grotesk] text-lg font-semibold">Trading Parameters</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--neon-green)]" />
          Smart contracts synced
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Minimum Sell Price
            </label>
            <div className="font-[JetBrains_Mono] text-sm">
              <span className="text-glow-green font-semibold">{minPrice.toFixed(2)}</span>
              <span className="ml-1 text-muted-foreground">POL / kWh</span>
            </div>
          </div>
          <Slider
            value={[minPrice]}
            onValueChange={onMinPrice}
            min={0.5}
            max={5}
            step={0.05}
            className="mt-4"
          />
          <div className="mt-2 flex justify-between font-[JetBrains_Mono] text-[10px] text-muted-foreground">
            <span>0.50</span>
            <span>market · 2.10</span>
            <span>5.00</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[var(--neon-green)]" />
                <span className="font-[Space_Grotesk] font-semibold">Automated Smart Trading</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Sign trades automatically when neighbors bid above your minimum.
              </p>
            </div>
            <Switch
              checked={autoTrade}
              onCheckedChange={setAutoTrade}
              className="data-[state=checked]:bg-[var(--neon-green)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Ledger({ feed }: { feed: Tx[] }) {
  return (
    <div className="glass-panel flex h-full min-h-[460px] flex-col p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Live Feed
          </div>
          <div className="mt-1 font-[Space_Grotesk] text-lg font-semibold">Activity Ticker</div>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-2 overflow-hidden flex flex-col justify-center">
        {feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-5 text-muted-foreground text-sm my-auto">
            <Zap className="h-8 w-8 text-muted-foreground/20 mb-2 animate-pulse" />
            <p className="font-semibold text-foreground/75">No transactions completed yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">Complete a P2P trade delivery to see it logged here.</p>
          </div>
        ) : (
          feed.map((tx) => (
            <div
              key={tx.id}
              className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  tx.kind === "sell"
                    ? "bg-[var(--neon-green)]/12 text-[var(--neon-green)]"
                    : "bg-[var(--neon-cyan)]/12 text-[var(--neon-cyan)]"
                }`}
              >
                <Zap className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 text-sm">
                  <span className={tx.kind === "sell" ? "text-glow-green font-semibold" : "text-glow-cyan font-semibold"}>
                    {tx.kind === "sell" ? "Sold" : "Bought"}
                  </span>
                  <span className="font-[JetBrains_Mono]">{tx.kwh} kWh</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-[JetBrains_Mono] text-xs text-muted-foreground truncate">
                    {tx.addr}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{tx.ago}</span>
                  <span className="font-[JetBrains_Mono] text-foreground/80">
                    {tx.kind === "sell" ? "+" : "−"}
                    {tx.gc} POL
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Active Listings Component (Marketplace & Oracle Operations Panel)
function ActiveListings({
  listings,
  loading,
  signer,
  account,
  onSuccess,
  walletMismatch
}: {
  listings: Listing[];
  loading: boolean;
  signer: ethers.Signer | null;
  account: string | null;
  onSuccess: () => void;
  walletMismatch?: boolean;
}) {
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Buy listing handler
  const handleBuy = async (listingId: number, totalCostMatic: string) => {
    if (walletMismatch) return;
    if (!signer) {
      toast.error("Please connect your wallet first!");
      return;
    }
    
    setProcessingId(listingId);
    try {
      if (listingId >= 101) {
        toast.info("Sending payment deposit to escrow contract (Simulated)...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const purchasedMocks = JSON.parse(localStorage.getItem("greengrid_purchased_mocks") || "[]");
        purchasedMocks.push(listingId);
        localStorage.setItem("greengrid_purchased_mocks", JSON.stringify(purchasedMocks));
        toast.success("✔ Matched listing & payment successfully escrowed! Awaiting physical delivery...");
        onSuccess();
        return;
      }

      toast.info("Sending payment deposit to escrow contract via MetaMask...");
      const receipt = await buyEnergyListing(signer, listingId, totalCostMatic);
      toast.success("✔ Matched listing & payment successfully escrowed! Awaiting physical delivery...");
      onSuccess();
    } catch (err: any) {
      toast.error(err.reason || err.message || "Failed to purchase energy");
    } finally {
      setProcessingId(null);
    }
  };

  // Oracle settlement handler
  const handleSettle = async (listingId: number) => {
    if (walletMismatch) return;
    setProcessingId(listingId);
    try {
      if (listingId >= 101) {
        toast.info("Invoking Backend Oracle to verify energy delivery (Simulated)...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const settledMocks = JSON.parse(localStorage.getItem("greengrid_settled_mocks") || "[]");
        settledMocks.push(listingId);
        localStorage.setItem("greengrid_settled_mocks", JSON.stringify(settledMocks));
        toast.success("✔ Oracle Verified: Delivery confirmed, funds released to seller!");
        onSuccess();
        return;
      }

      toast.info("Invoking Backend Oracle API to verify energy delivery...");
      const res = await settleListingViaOracle(listingId);
      toast.success(`✔ Oracle Verified: ${res.message}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Oracle delivery settlement failed");
    } finally {
      setProcessingId(null);
    }
  };

  // Oracle abort handler
  const handleAbort = async (listingId: number) => {
    if (walletMismatch) return;
    setProcessingId(listingId);
    try {
      if (listingId >= 101) {
        toast.info("Invoking Backend Oracle to cancel trade and trigger refunds (Simulated)...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const purchasedMocks = JSON.parse(localStorage.getItem("greengrid_purchased_mocks") || "[]");
        const nextPurchased = purchasedMocks.filter((id: number) => id !== listingId);
        localStorage.setItem("greengrid_purchased_mocks", JSON.stringify(nextPurchased));
        toast.success("✔ Oracle Aborted: Payment refunded successfully.");
        onSuccess();
        return;
      }

      toast.info("Invoking Backend Oracle API to cancel trade and trigger refunds...");
      const res = await abortListingViaOracle(listingId);
      toast.success(`✔ Oracle Aborted: ${res.message}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to abort trade");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="glass-panel p-6 mt-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
        <div>
          <h3 className="font-[Space_Grotesk] text-lg font-semibold">GreenGrid P2P Marketplace</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Active electricity listings and oracle operations on Polygon Amoy</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onSuccess} 
          disabled={loading}
          className="border-white/5 hover:bg-white/5 text-xs h-8 px-2.5 rounded-lg flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh listings
        </Button>
      </div>

      {loading && listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
          <RefreshCw className="h-6 w-6 animate-spin mb-2 text-glow-green" />
          Fetching active listings from contract...
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No energy listings active on-chain right now.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Seller</th>
                <th className="py-3 px-4">Amount (kWh)</th>
                <th className="py-3 px-4">Price (POL/kWh)</th>
                <th className="py-3 px-4">Escrow Value</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-[JetBrains_Mono] text-xs">
              {listings.map((l) => {
                const totalCost = (parseFloat(l.amount) * parseFloat(l.pricePerToken)).toFixed(4);
                const isSeller = account && account.toLowerCase() === l.seller.toLowerCase();
                const isBuyer = account && account.toLowerCase() === l.buyer.toLowerCase();
                
                return (
                  <tr key={l.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 px-4 font-semibold text-foreground">#{l.id}</td>
                    <td className="py-4 px-4">{truncateAddress(l.seller)} {isSeller && <span className="text-[9px] bg-[var(--neon-green)]/15 text-glow-green px-1.5 py-0.5 rounded ml-1 uppercase">You</span>}</td>
                    <td className="py-4 px-4 text-foreground">{l.amount}</td>
                    <td className="py-4 px-4">{l.pricePerToken}</td>
                    <td className="py-4 px-4 text-[var(--neon-cyan)]">{totalCost} POL</td>
                    <td className="py-4 px-4 text-center">
                      {l.isSettled ? (
                        <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px]">
                          <ShieldCheck className="h-3 w-3" /> Settled
                        </span>
                      ) : l.isMatched ? (
                        <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full text-[10px] animate-pulse">
                          <Clock className="h-3 w-3" /> Matched (Awaiting Delivery)
                        </span>
                      ) : l.isActive ? (
                        <span className="inline-flex items-center gap-1 bg-[var(--neon-green)]/10 text-glow-green px-2 py-0.5 rounded-full text-[10px]">
                          <CircleDot className="h-3 w-3 text-[var(--neon-green)] animate-pulse" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-white/5 text-muted-foreground px-2 py-0.5 rounded-full text-[10px]">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {l.isActive && !l.isMatched && (
                        <Button
                          disabled={processingId === l.id || isSeller || walletMismatch}
                          onClick={() => handleBuy(l.id, totalCost)}
                          size="sm"
                          className="bg-glow-cyan/10 hover:bg-glow-cyan/20 text-glow-cyan text-[10px] font-semibold uppercase px-3 py-1 rounded-lg border border-[var(--neon-cyan)]/20"
                        >
                          {isSeller ? "Your Listing" : "Buy Offer"}
                        </Button>
                      )}

                      {l.isMatched && !l.isSettled && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            disabled={processingId === l.id || walletMismatch}
                            onClick={() => handleSettle(l.id)}
                            size="sm"
                            className="bg-[var(--neon-green)] text-background hover:bg-[var(--neon-green)]/90 text-[10px] font-bold uppercase px-3 py-1 rounded-lg shadow-[var(--shadow-neon)]"
                          >
                            Simulate Delivery
                          </Button>
                          <Button
                            disabled={processingId === l.id || walletMismatch}
                            onClick={() => handleAbort(l.id)}
                            variant="destructive"
                            size="sm"
                            className="text-[10px] font-semibold uppercase px-2 py-1 rounded-lg"
                          >
                            Abort
                          </Button>
                        </div>
                      )}

                      {l.isSettled && (
                        <span className="text-[10px] text-muted-foreground/50">Receipt: {truncateAddress(l.buyer)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}