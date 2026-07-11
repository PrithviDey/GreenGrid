import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf, ShieldCheck, Lock, User, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      toast.error("Please enter both User ID and Password");
      return;
    }

    setLoading(true);
    // Simulate minor network delay
    setTimeout(() => {
      setLoading(false);
      const cleanUser = userId.trim().toLowerCase();
      
      if (
        (cleanUser === "seller_pro" || cleanUser === "buyer_eco") && 
        password === "password123"
      ) {
        onLogin(cleanUser);
        toast.success(`Welcome back, ${cleanUser}!`);
      } else {
        toast.error("Invalid credentials. Use seller_pro / buyer_eco with password123");
      }
    }, 800); // 800ms
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--neon-green)]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-[var(--neon-cyan)]/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 overflow-hidden mb-2 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
            <img src="/favicon.png" className="h-10 w-10 object-contain" alt="GreenGrid Logo" />
          </div>
          <h1 className="font-[Space_Grotesk] text-3xl font-bold tracking-tight text-foreground">
            Green<span className="text-glow-green">Grid</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            P2P Solar Energy Trading
          </p>
        </div>

        {/* Login Form Card */}
        <div className="glass-panel p-8 relative">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--neon-green)] to-transparent opacity-50" />
          
          <h2 className="text-lg font-semibold mb-6 text-foreground/90 flex items-center gap-2">
            <Lock className="h-4.5 w-4.5 text-[var(--neon-green)]" />
            Sign In to your Grid Account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <User className="h-3 w-3 text-glow-green" /> User ID
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="e.g. seller_pro"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="bg-white/[0.02] border-white/5 focus:border-[var(--neon-green)]/35 text-foreground h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-glow-green" /> Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/[0.02] border-white/5 focus:border-[var(--neon-green)]/35 text-foreground h-11 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 border border-[var(--neon-green)]/35 bg-[var(--neon-green)]/10 text-[var(--neon-green)] font-bold tracking-wide hover:bg-[var(--neon-green)]/20 shadow-[0_0_15px_rgba(34,197,94,0.15)] rounded-xl mt-6 transition duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <img src="/favicon.png" className="h-4.5 w-4.5 object-contain" alt="Logo" />
                  <span>Sign In</span>
                </>
              )}
            </Button>
          </form>

          {/* Test Credentials Hint */}
          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.01] p-3 text-[11px] text-muted-foreground/80 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground/80">
              <AlertCircle className="h-3.5 w-3.5 text-glow-cyan" />
              Demo Credentials (Amoy Sync):
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1 pt-1 border-t border-white/5">
              <div>
                <span className="text-foreground font-medium">User 1 (Seller):</span>
                <span className="block text-[10px] font-mono">seller_pro / password123</span>
              </div>
              <div>
                <span className="text-foreground font-medium">User 2 (Buyer):</span>
                <span className="block text-[10px] font-mono">buyer_eco / password123</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--neon-green)]" />
          Secured P2P Solar Network
        </div>
      </div>
    </div>
  );
}
