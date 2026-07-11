import { Home, Users, Factory, Zap } from "lucide-react";

export function EnergyMap({ 
  account, 
  netFlow 
}: { 
  account: string | null; 
  netFlow: number;
}) {
  const isExporting = netFlow > 0;
  const flowText = isExporting 
    ? `Exporting ${netFlow.toFixed(2)} kWh` 
    : `Importing ${Math.abs(netFlow).toFixed(2)} kWh`;
  const toneClass = isExporting 
    ? "bg-[var(--neon-green)]/15 text-glow-green border-[var(--neon-green)]/40" 
    : "bg-[var(--neon-cyan)]/15 text-glow-cyan border-[var(--neon-cyan)]/40";
  const glowBlur = isExporting 
    ? "bg-[var(--neon-green)]/15" 
    : "bg-[var(--neon-cyan)]/15";

  const displayAddr = account 
    ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` 
    : "0x71C...3A9";

  return (
    <div className="glass-panel relative overflow-hidden p-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Energy Map
          </div>
          <div className="mt-1 font-[Space_Grotesk] text-lg font-semibold">
            Neighborhood Grid · Sector 14-B
          </div>
        </div>
        <div className="rounded-full glass-panel px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">Net Flow </span>
          <span className={`font-[JetBrains_Mono] font-semibold ${isExporting ? "text-glow-green" : "text-glow-cyan"}`}>
            {isExporting ? "+" : ""}{netFlow.toFixed(2)} kWh
          </span>
        </div>
      </div>

      {/* backdrop grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            "linear-gradient(var(--neon-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--neon-cyan) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      {/* canvas */}
      <div className="relative mt-6 h-[380px]">
        {/* SVG connections layer */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 800 380"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="lineGreen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--neon-green)" stopOpacity="0.2" />
              <stop offset="50%" stopColor="var(--neon-green)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--neon-green)" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="lineCyan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.2" />
              <stop offset="50%" stopColor="var(--neon-cyan)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0.2" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* House(400,190) -> Neighbor(140,90) */}
          <path
            d="M 400 190 C 300 130, 220 100, 140 90"
            stroke={isExporting ? "url(#lineGreen)" : "url(#lineCyan)"}
            strokeWidth="2"
            fill="none"
            strokeDasharray="6 8"
            className="dash-flow"
            filter="url(#glow)"
          />
          {/* House(400,190) -> Utility(660,300) */}
          <path
            d="M 400 190 C 500 230, 580 270, 660 300"
            stroke={!isExporting ? "url(#lineGreen)" : "url(#lineCyan)"}
            strokeWidth="2"
            fill="none"
            strokeDasharray="6 8"
            className="dash-flow"
            filter="url(#glow)"
          />
          {/* House(400,190) -> Neighbor2(660,80) */}
          <path
            d="M 400 190 C 500 140, 580 100, 660 80"
            stroke="url(#lineGreen)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 8"
            className="dash-flow"
            opacity="0.55"
          />
          {/* House(400,190) -> Neighbor3(140,300) */}
          <path
            d="M 400 190 C 300 240, 220 280, 140 300"
            stroke="url(#lineCyan)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 8"
            className="dash-flow"
            opacity="0.5"
          />
        </svg>

        {/* Nodes */}
        <MapNode
          x="17.5%"
          y="23.5%"
          label="Neighbor"
          sub="0x89F...7C2"
          icon={<Users className="h-5 w-5" />}
          meta="Buying 2.5 kWh"
          tone="green"
        />
        <MapNode
          x="82.5%"
          y="21%"
          label="Neighbor"
          sub="0x41A...9E8"
          icon={<Users className="h-5 w-5" />}
          meta="Idle"
          tone="muted"
          small
        />
        <MapNode
          x="17.5%"
          y="78%"
          label="Neighbor"
          sub="0xB0D...1F4"
          icon={<Users className="h-5 w-5" />}
          meta="Bidding 1.9 GC"
          tone="cyan"
          small
        />
        <MapNode
          x="82.5%"
          y="79%"
          label="Utility Grid"
          sub="grid.io"
          icon={<Factory className="h-5 w-5" />}
          meta="Buying 1.7 kWh"
          tone="cyan"
        />

        {/* Center: My House */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: "50%", top: "50%" }}
        >
          <div className="relative">
            <div className={`absolute inset-0 -m-6 rounded-full blur-2xl ${glowBlur}`} />
            <div className={`pulse-glow relative flex w-56 flex-col items-center gap-2 rounded-2xl border bg-background/70 p-5 backdrop-blur-xl transition-all duration-500 ${isExporting ? "border-[var(--neon-green)]/40" : "border-[var(--neon-cyan)]/40"}`}>
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-background ${isExporting ? "bg-[var(--gradient-neon)]" : "bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-green)]"}`}>
                <Home className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <div className="text-center">
                <div className="font-[Space_Grotesk] text-base font-bold">My House</div>
                <div className="font-[JetBrains_Mono] text-[10px] text-muted-foreground">
                  {displayAddr}
                </div>
              </div>
              <div className={`mt-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
                <Zap className="h-3 w-3" />
                {flowText}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-6 bg-[var(--neon-green)]" /> Exporting
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-6 bg-[var(--neon-cyan)]" /> Importing
        </span>
        <span className="ml-auto font-[JetBrains_Mono]">4 active peers · 2 pending bids</span>
      </div>
    </div>
  );
}

function MapNode({
  x,
  y,
  label,
  sub,
  icon,
  meta,
  tone,
  small,
}: {
  x: string;
  y: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  meta: string;
  tone: "green" | "cyan" | "muted";
  small?: boolean;
}) {
  const ring =
    tone === "green"
      ? "border-[var(--neon-green)]/30"
      : tone === "cyan"
        ? "border-[var(--neon-cyan)]/30"
        : "border-white/10";
  const chip =
    tone === "green"
      ? "bg-[var(--neon-green)]/12 text-glow-green"
      : tone === "cyan"
        ? "bg-[var(--neon-cyan)]/12 text-glow-cyan"
        : "bg-white/5 text-muted-foreground";

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y }}
    >
      <div
        className={`flex ${small ? "w-40" : "w-48"} flex-col items-center gap-1.5 rounded-2xl border ${ring} bg-background/60 p-3 backdrop-blur-xl`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${chip}`}
          >
            {icon}
          </div>
          <div>
            <div className="font-[Space_Grotesk] text-sm font-semibold leading-tight">
              {label}
            </div>
            <div className="font-[JetBrains_Mono] text-[10px] text-muted-foreground">
              {sub}
            </div>
          </div>
        </div>
        <div className={`w-full rounded-lg ${chip} px-2 py-1 text-center text-[10px]`}>
          {meta}
        </div>
      </div>
    </div>
  );
}