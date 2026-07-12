import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { 
  Leaf, 
  Zap, 
  ShieldCheck, 
  Lock, 
  Wallet, 
  AlertCircle, 
  Activity, 
  ArrowRight, 
  Globe, 
  Award, 
  CheckCircle2, 
  X,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { EnergyBackground } from "./EnergyBackground";

export function LandingPage({ 
  onEnterApp 
}: { 
  onEnterApp: (username: string) => void 
}) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Signup role selection
  const [role, setRole] = useState<"seller" | "buyer">("seller");

  // Generated embedded wallet state (shown on signup)
  const [generatedWallet, setGeneratedWallet] = useState<{
    address: string;
    privateKey: string;
    mnemonic: string;
  } | null>(null);
  const [showPrivKey, setShowPrivKey] = useState(false);

  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Check if already logged in
  const [savedUser, setSavedUser] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("greengrid_user");
    if (user) {
      setSavedUser(user);
    }
  }, []);

  const handleLaunchApp = () => {
    if (savedUser) {
      onEnterApp(savedUser);
      toast.success(`Redirected: Welcome back, ${savedUser}!`);
    } else {
      setAuthMode("login");
      setShowAuthModal(true);
    }
  };

  // ── Login: Connect existing MetaMask wallet ──────────────────────────────
  const handleMetaMaskLogin = async () => {
    if (!window.ethereum) {
      toast.error("MetaMask is not installed. Please install it from metamask.io");
      return;
    }
    setLoading(true);
    try {
      const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        toast.error("No accounts found. Please unlock MetaMask and try again.");
        return;
      }
      const address = accounts[0].toLowerCase();
      // Persist the wallet address as the session identity
      localStorage.setItem("greengrid_user", address);
      // Check if there's a saved role; default to buyer
      if (!localStorage.getItem(`greengrid_role_${address}`)) {
        localStorage.setItem(`greengrid_role_${address}`, "buyer");
      }
      // Also link this wallet to the address-based user profile
      localStorage.setItem(`greengrid_wallet_${address}`, address);
      toast.success(`Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
      onEnterApp(address);
    } catch (err: any) {
      toast.error(err.message || "MetaMask connection rejected.");
    } finally {
      setLoading(false);
    }
  };

  // ── Signup Option A: Connect new/existing MetaMask account ────────────────
  const handleMetaMaskSignup = async () => {
    if (!window.ethereum) {
      toast.error("MetaMask is not installed. Please install it from metamask.io");
      return;
    }
    setLoading(true);
    try {
      // Force MetaMask to show account selection dialog
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts: string[] = await window.ethereum.request({ method: "eth_accounts" });
      if (!accounts || accounts.length === 0) {
        toast.error("No accounts found.");
        return;
      }
      const address = accounts[0].toLowerCase();
      localStorage.setItem("greengrid_user", address);
      localStorage.setItem(`greengrid_role_${address}`, role);
      localStorage.setItem(`greengrid_wallet_${address}`, address);
      toast.success(`Registered: ${address.slice(0, 6)}...${address.slice(-4)} as ${role}!`);
      onEnterApp(address);
    } catch (err: any) {
      toast.error(err.message || "MetaMask connection rejected.");
    } finally {
      setLoading(false);
    }
  };

  // ── Signup Option B: Generate brand new embedded wallet ───────────────────
  const handleGenerateWallet = () => {
    setLoading(true);
    try {
      const wallet = ethers.Wallet.createRandom();
      const address = wallet.address.toLowerCase();
      const privateKey = wallet.privateKey;
      const mnemonic = wallet.mnemonic?.phrase || "";

      // Persist embedded wallet credentials to localStorage
      localStorage.setItem(`greengrid_privkey_${address}`, privateKey);
      localStorage.setItem(`greengrid_role_${address}`, role);
      localStorage.setItem(`greengrid_wallet_${address}`, address);
      localStorage.setItem("greengrid_user", address);

      setGeneratedWallet({ address, privateKey, mnemonic });
    } catch (err: any) {
      toast.error("Failed to generate wallet: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterWithGeneratedWallet = () => {
    if (!generatedWallet) return;
    toast.success(`New wallet active: ${generatedWallet.address.slice(0, 6)}...${generatedWallet.address.slice(-4)}`);
    onEnterApp(generatedWallet.address);
  };

  // Steps for Interactive flow visualizer
  const flowSteps = [
    {
      title: "1. Solar Generation & Listing",
      desc: "Producers list their excess rooftop solar generation on the dashboard. The local smart meter measures the output, and they choose their trading volume (kWh) and price per unit.",
      icon: <Zap className="h-6 w-6 text-[var(--neon-green)]" />,
      color: "from-[var(--neon-green)]/20 to-[var(--neon-green)]/5",
      border: "border-[var(--neon-green)]/30",
      accent: "text-[var(--neon-green)]"
    },
    {
      title: "2. Secure On-chain Escrow",
      desc: "GreenCoin (GRN) energy credits are locked securely in the P2P Escrow Smart Contract. This guarantees that once listed, the energy is committed and can be verified.",
      icon: <Lock className="h-6 w-6 text-[var(--neon-cyan)]" />,
      color: "from-[var(--neon-cyan)]/20 to-[var(--neon-cyan)]/5",
      border: "border-[var(--neon-cyan)]/30",
      accent: "text-[var(--neon-cyan)]"
    },
    {
      title: "3. Smart Matchmaking",
      desc: "Consumers browse the live marketplace, select a nearby seller, and deposit MATIC/POL payment into the escrow. The trade is matched instantly and logged in the public ledger.",
      icon: <Wallet className="h-6 w-6 text-[var(--neon-cyan)]" />,
      color: "from-[var(--neon-cyan)]/20 to-[var(--neon-cyan)]/5",
      border: "border-[var(--neon-cyan)]/30",
      accent: "text-[var(--neon-cyan)]"
    },
    {
      title: "4. Telemetry Verification & Payout",
      desc: "The FastAPI backend oracle queries smart meter telemetry. Once physical electricity flow is verified, the escrow contract releases MATIC/POL to the seller and GRN to the buyer.",
      icon: <ShieldCheck className="h-6 w-6 text-[var(--neon-green)]" />,
      color: "from-[var(--neon-green)]/20 to-[var(--neon-green)]/5",
      border: "border-[var(--neon-green)]/30",
      accent: "text-[var(--neon-green)]"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col font-sans">
      <EnergyBackground />
      
      {/* Decorative Glow Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--neon-green)]/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--neon-cyan)]/5 rounded-full blur-[150px] pointer-events-none" />
      
      {/* Interactive Floating Grid Line (Mock) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none mask-image-linear" />

      {/* Landing Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 backdrop-blur-xl bg-background/60">
        <div className="mx-auto max-w-[1500px] h-16 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              <img src="/favicon.png" className="h-6 w-6 object-contain" alt="GreenGrid Logo" />
            </div>
            <span className="font-[Space_Grotesk] text-xl font-bold tracking-tight">
              Green<span className="text-glow-green">Grid</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-wider text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#stats" className="hover:text-foreground transition">Core Metrics</a>
            <a href="#process" className="hover:text-foreground transition">How it Works</a>
          </nav>

          <div className="flex items-center gap-3">
            {!savedUser ? (
              <>
                <button 
                  onClick={() => { setAuthMode("login"); setShowAuthModal(true); }}
                  className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition px-3 py-1.5"
                >
                  Sign In
                </button>
                <Button 
                  onClick={() => { setAuthMode("signup"); setShowAuthModal(true); }}
                  className="h-9 px-4 text-xs font-semibold uppercase tracking-wider bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/35 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/25 transition"
                >
                  Connect Wallet
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleLaunchApp}
                className="h-9 px-4 text-xs font-semibold uppercase tracking-wider bg-[var(--neon-cyan)]/15 border border-[var(--neon-cyan)]/35 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/25 transition"
              >
                Go to Dashboard
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        
        {/* Hero Section */}
        <section className="mx-auto max-w-[1500px] px-5 pt-16 pb-20 md:pt-24 md:pb-28 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--neon-green)]/20 bg-[var(--neon-green)]/5 text-[var(--neon-green)] text-[10px] uppercase tracking-wider font-semibold mb-6 animate-pulse">
            <Activity className="h-3.5 w-3.5" /> Next-Generation P2P Energy Trading
          </div>
          
          <h1 className="font-[Space_Grotesk] text-4xl sm:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.1] text-foreground">
            Decentralized Energy. <br className="hidden sm:inline"/>
            <span className="bg-gradient-to-r from-[var(--neon-green)] to-[var(--neon-cyan)] bg-clip-text text-transparent">Neighborhood Powered.</span>
          </h1>

          <p className="mt-6 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Trade local rooftop solar energy directly with your neighbors on the blockchain. Secure transactions, instant payments, and absolute environmental accountability.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button 
              onClick={handleLaunchApp}
              className="h-12 px-8 text-xs font-bold uppercase tracking-wider bg-[var(--neon-green)] border border-[var(--neon-green)] text-black hover:bg-transparent hover:text-[var(--neon-green)] transition duration-200 shadow-[0_0_30px_rgba(34,197,94,0.3)] flex items-center gap-2 rounded-xl"
            >
              <span>{savedUser ? "Launch Dashboard" : "Get Started Now"}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <a 
              href="#process"
              className="h-12 px-8 text-xs font-semibold uppercase tracking-wider border border-white/10 hover:border-white/20 transition flex items-center justify-center rounded-xl bg-white/[0.02]"
            >
              See how it works
            </a>
          </div>
        </section>

        {/* Live Grid Metrics Section */}
        <section id="stats" className="border-y border-white/5 bg-white/[0.01] py-12 relative">
          <div className="mx-auto max-w-[1500px] px-5 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div className="space-y-1">
              <span className="block font-[Space_Grotesk] text-4xl font-extrabold text-glow-green text-[var(--neon-green)]">
                142,840 kWh
              </span>
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                Total Renewable Energy Traded
              </span>
            </div>
            <div className="space-y-1 border-y sm:border-y-0 sm:border-x border-white/5 py-6 sm:py-0">
              <span className="block font-[Space_Grotesk] text-4xl font-extrabold text-glow-cyan text-[var(--neon-cyan)]">
                54,279 kg
              </span>
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                CO₂ Emissions Prevented
              </span>
            </div>
            <div className="space-y-1">
              <span className="block font-[Space_Grotesk] text-4xl font-extrabold text-foreground">
                1,482 Nodes
              </span>
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                Active Household Grid Partners
              </span>
            </div>
          </div>
        </section>

        {/* Features Showcase */}
        <section id="features" className="mx-auto max-w-[1500px] px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-[Space_Grotesk] text-2xl sm:text-3xl font-bold">Engineered for Transparency</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">GreenGrid couples physical smart-meter infrastructure with secure Polygon blockchain smart contracts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="glass-panel p-8 relative group hover:border-[var(--neon-green)]/30 transition duration-300">
              <div className="h-10 w-10 rounded-lg bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 flex items-center justify-center mb-6">
                <Leaf className="h-5 w-5 text-[var(--neon-green)]" />
              </div>
              <h3 className="font-[Space_Grotesk] text-lg font-bold text-foreground">100% Peer-to-Peer</h3>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                Skip standard corporate electricity middlemen. Buy energy directly from neighborhood solar arrays at competitive rates, keeping revenue inside the local community.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel p-8 relative group hover:border-[var(--neon-cyan)]/30 transition duration-300">
              <div className="h-10 w-10 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20 flex items-center justify-center mb-6">
                <Lock className="h-5 w-5 text-[var(--neon-cyan)]" />
              </div>
              <h3 className="font-[Space_Grotesk] text-lg font-bold text-foreground">Escrow Protected</h3>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                Our optimized Polygon smart contracts lock the buyer's funds in secure escrow. Payouts are only triggered once physical delivery is validated by smart meters.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel p-8 relative group hover:border-[var(--neon-green)]/30 transition duration-300">
              <div className="h-10 w-10 rounded-lg bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 flex items-center justify-center mb-6">
                <ShieldCheck className="h-5 w-5 text-[var(--neon-green)]" />
              </div>
              <h3 className="font-[Space_Grotesk] text-lg font-bold text-foreground">Smart-Meter Oracle</h3>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                An automated telemetry engine matches buyer/seller physical consumption metrics, settles trades, and updates balances without requiring manual user input.
              </p>
            </div>

          </div>
        </section>

        {/* How It Works Section (Interactive Flow Visualizer) */}
        <section id="process" className="mx-auto max-w-[1500px] px-5 py-16 border-t border-white/5">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-[Space_Grotesk] text-2xl sm:text-3xl font-bold">Interactive Transaction Flow</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">Click through the steps below to see how energy is tokenized and traded on-chain.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Step Selection Buttons */}
            <div className="lg:col-span-4 space-y-3">
              {flowSteps.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition duration-200 flex items-center gap-4 ${
                    activeStep === idx 
                      ? "bg-white/[0.03] border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.03)]" 
                      : "bg-transparent border-transparent hover:bg-white/[0.01]"
                  }`}
                >
                  <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${activeStep === idx ? step.accent : "text-muted-foreground"}`}>
                    {step.icon}
                  </div>
                  <div>
                    <span className={`block font-[Space_Grotesk] text-sm font-bold ${activeStep === idx ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Step Display Area */}
            <div className="lg:col-span-8">
              <div className={`glass-panel p-8 bg-gradient-to-br ${flowSteps[activeStep].color} border ${flowSteps[activeStep].border} transition-all duration-300 min-h-[220px] flex flex-col justify-between relative`}>
                <div>
                  <h3 className="font-[Space_Grotesk] text-lg font-bold text-foreground flex items-center gap-2.5">
                    {flowSteps[activeStep].icon}
                    {flowSteps[activeStep].title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-4 leading-relaxed max-w-2xl">
                    {flowSteps[activeStep].desc}
                  </p>
                </div>
                
                <div className="mt-8 flex justify-between items-center text-[10px] text-muted-foreground font-[JetBrains_Mono]">
                  <span>Status: Fully Implemented</span>
                  <span className="flex items-center gap-1 text-[var(--neon-green)] font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Polygon Amoy Testnet Ready
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/20 py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-[1500px] px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" className="h-5 w-5 object-contain opacity-60" alt="Logo" />
            <span className="font-[Space_Grotesk] font-bold text-foreground/80">GreenGrid P2P</span>
          </div>
          <span>&copy; {new Date().getFullYear()} GreenGrid. Secure Decentralized Solar Energy Network.</span>
        </div>
      </footer>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel max-w-md w-full p-8 border-t-2 border-t-[var(--neon-green)] shadow-[0_0_50px_rgba(34,197,94,0.15)] relative animate-in zoom-in-95 duration-200">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-[0_0_10px_rgba(34,197,94,0.1)] mb-3">
                <img src="/favicon.png" className="h-6 w-6 object-contain" alt="Logo" />
              </div>
              <h3 className="font-[Space_Grotesk] text-xl font-bold">
                {authMode === "login" ? "Sign In to Microgrid" : "Register Grid Account"}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                {authMode === "login" 
                  ? "Enter your credentials to access the solar trading pool" 
                  : "Register as a buyer or seller on the decentralized energy pool"
                }
              </p>
            </div>

            {/* Login Mode */}
            {authMode === "login" ? (
              <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground text-center">
                  Connect your MetaMask wallet to access your energy trading account.
                </p>

                <Button
                  onClick={handleMetaMaskLogin}
                  disabled={loading}
                  className="w-full h-12 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-bold tracking-wide hover:bg-[var(--neon-green)]/20 shadow-[0_0_20px_rgba(34,197,94,0.15)] rounded-xl transition duration-200 flex items-center justify-center gap-2.5"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" className="h-5 w-5" alt="MetaMask" />
                      <span>Connect with MetaMask</span>
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 text-[10px] text-muted-foreground/70 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground/70">
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-500/80" />
                    How it works
                  </div>
                  <p className="leading-relaxed">Your MetaMask wallet address becomes your GreenGrid identity. No passwords required — your cryptographic keys are the proof of identity.</p>
                </div>

                <div className="text-center text-[11px] text-muted-foreground mt-1">
                  New to GreenGrid?{" "}
                  <button
                    type="button"
                    onClick={() => { setAuthMode("signup"); setGeneratedWallet(null); }}
                    className="text-[var(--neon-green)] underline hover:text-white transition ml-0.5"
                  >
                    Register a wallet
                  </button>
                </div>
              </div>
            ) : (
              // Signup Mode
              <div className="space-y-4">
                {!generatedWallet ? (
                  <>
                    {/* Role selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                        <Award className="h-3 w-3 text-[var(--neon-green)]" /> Your Microgrid Role
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRole("seller")}
                          className={`h-10 rounded-lg border text-xs font-semibold transition ${
                            role === "seller"
                              ? "bg-[var(--neon-green)]/15 border-[var(--neon-green)]/40 text-[var(--neon-green)]"
                              : "bg-transparent border-white/5 hover:bg-white/[0.02]"
                          }`}
                        >
                          ☀️ Solar Producer
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole("buyer")}
                          className={`h-10 rounded-lg border text-xs font-semibold transition ${
                            role === "buyer"
                              ? "bg-[var(--neon-cyan)]/15 border-[var(--neon-cyan)]/40 text-[var(--neon-cyan)]"
                              : "bg-transparent border-white/5 hover:bg-white/[0.02]"
                          }`}
                        >
                          ⚡ Grid Consumer
                        </button>
                      </div>
                    </div>

                    {/* Option A: MetaMask */}
                    <Button
                      onClick={handleMetaMaskSignup}
                      disabled={loading}
                      className="w-full h-11 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-bold hover:bg-[var(--neon-green)]/20 rounded-xl transition flex items-center justify-center gap-2.5"
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" className="h-5 w-5" alt="MetaMask" />
                          <span>Register with MetaMask</span>
                        </>
                      )}
                    </Button>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-white/[0.05]" />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                    </div>

                    {/* Option B: Generate embedded wallet */}
                    <Button
                      onClick={handleGenerateWallet}
                      disabled={loading}
                      className="w-full h-11 border border-[var(--neon-cyan)]/30 bg-[var(--neon-cyan)]/5 text-[var(--neon-cyan)] font-bold hover:bg-[var(--neon-cyan)]/15 rounded-xl transition flex items-center justify-center gap-2.5"
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Generate New Wallet</span>
                        </>
                      )}
                    </Button>

                    <p className="text-[9.5px] text-muted-foreground/60 text-center leading-relaxed">
                      No MetaMask? We'll create a secure Ethereum wallet for you automatically.
                    </p>
                  </>
                ) : (
                  /* Generated wallet reveal screen */
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[var(--neon-green)]/5 border border-[var(--neon-green)]/20 p-3 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--neon-green)]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Wallet Generated!
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Address</div>
                        <div className="font-mono text-[10px] text-foreground/90 break-all bg-black/20 rounded p-1.5">{generatedWallet.address}</div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Private Key</div>
                          <button onClick={() => setShowPrivKey(v => !v)} className="text-muted-foreground hover:text-foreground transition">
                            {showPrivKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        </div>
                        <div className="font-mono text-[10px] text-yellow-400/80 break-all bg-black/20 rounded p-1.5">
                          {showPrivKey ? generatedWallet.privateKey : "•".repeat(32) + "..."}
                        </div>
                      </div>
                      {generatedWallet.mnemonic && (
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Recovery Phrase</div>
                          <div className="font-mono text-[9px] text-foreground/60 break-words bg-black/20 rounded p-1.5 leading-relaxed">{generatedWallet.mnemonic}</div>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-2.5 text-[9.5px] text-yellow-400/80 leading-relaxed">
                      ⚠️ Save your private key and recovery phrase now. This is the only time they will be shown.
                    </div>
                    <Button
                      onClick={handleEnterWithGeneratedWallet}
                      className="w-full h-11 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-bold hover:bg-[var(--neon-green)]/20 rounded-xl transition flex items-center justify-center gap-2"
                    >
                      <Wallet className="h-4 w-4" />
                      Enter GreenGrid
                    </Button>
                  </div>
                )}

                <div className="text-center text-[11px] text-muted-foreground">
                  Already registered?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="text-[var(--neon-green)] underline hover:text-white transition ml-0.5"
                  >
                    Login here
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
