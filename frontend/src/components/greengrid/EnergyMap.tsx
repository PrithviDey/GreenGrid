// EnergyMap — hub-and-spoke grid topology with animated energy flows
type NodeRole = "exporting" | "importing" | "idle";

interface GridNode {
  id: string;
  label: string;
  shortAddr: string;
  role: NodeRole;
  kwh: string;
  x: number;
  y: number;
  isUser?: boolean;
}

/* ── Layout: SVG 1200 × 640 ─────────────────────────────────────────────────
   Grid hub at (600, 320). User house top-centre. Neighbours spread wide.   */
const STATIC_NODES: GridNode[] = [
  { id: "n1", label: "House A", shortAddr: "0x89F...7C2", role: "exporting", kwh: "3.2", x: 140,  y: 90  },
  { id: "n2", label: "House B", shortAddr: "0x41A...9E8", role: "importing", kwh: "1.8", x: 1060, y: 90  },
  { id: "n3", label: "House C", shortAddr: "0xB0D...1F4", role: "idle",      kwh: "0.0", x: 40,   y: 340 },
  { id: "n4", label: "House D", shortAddr: "0x77E...50b", role: "exporting", kwh: "4.5", x: 1160, y: 340 },
  { id: "n5", label: "House E", shortAddr: "0x9E8...8Cc", role: "importing", kwh: "2.1", x: 140,  y: 560 },
  { id: "n6", label: "House F", shortAddr: "0xC3A...Fd5", role: "idle",      kwh: "0.0", x: 1060, y: 560 },
];

const GX = 600, GY = 325; // Grid hub centre

const G  = "rgba(74,222,128,";
const C  = "rgba(34,211,238,";
const DIM = "rgba(255,255,255,";

const roleStroke = (r: NodeRole) =>
  r === "exporting" ? `${G}0.95)` : r === "importing" ? `${C}0.95)` : `${DIM}0.07)`;

const roleFill = (r: NodeRole) =>
  r === "exporting" ? `${G}0.10)` : r === "importing" ? `${C}0.10)` : "rgba(14,20,30,0.85)";

const roleBorder = (r: NodeRole) =>
  r === "exporting" ? `${G}0.55)` : r === "importing" ? `${C}0.55)` : "rgba(255,255,255,0.09)";

const roleText = (r: NodeRole) =>
  r === "exporting" ? `${G}1)` : r === "importing" ? `${C}1)` : "rgba(255,255,255,0.35)";

const roleLabel = (r: NodeRole, kwh: string) =>
  r === "exporting" ? `↑ Exporting ${kwh} kWh` : r === "importing" ? `↓ Importing ${kwh} kWh` : "Idle";

/* Cubic bezier path: node → grid, with a slight bow inward */
function curveTo(nx: number, ny: number): string {
  const mx = (nx + GX) / 2;
  const my = (ny + GY) / 2;
  const bow = 0.15;
  const cx = mx + (GX - mx) * bow;
  const cy = my + (GY - my) * bow;
  return `M ${nx} ${ny} Q ${cx} ${cy} ${GX} ${GY}`;
}

/* ── SVG Icon helpers (no emoji) ──────────────────────────────────────────── */
function HouseIcon({ cx, cy, s, color }: { cx: number; cy: number; s: number; color: string }) {
  return (
    <g opacity="0.9">
      {/* Roof */}
      <polygon points={`${cx},${cy - s} ${cx - s * 0.9},${cy - s * 0.05} ${cx + s * 0.9},${cy - s * 0.05}`} fill={color} />
      {/* Walls */}
      <rect x={cx - s * 0.65} y={cy - s * 0.05} width={s * 1.3} height={s * 0.9} fill={color} opacity="0.75" rx="2" />
      {/* Door */}
      <rect x={cx - s * 0.18} y={cy + s * 0.35} width={s * 0.36} height={s * 0.55} fill="rgba(0,0,0,0.45)" rx="2" />
    </g>
  );
}

function BoltIcon({ cx, cy, s, color }: { cx: number; cy: number; s: number; color: string }) {
  return (
    <path
      d={`M ${cx + s * 0.12} ${cy - s} L ${cx - s * 0.3} ${cy + s * 0.08} L ${cx + s * 0.04} ${cy + s * 0.08} L ${cx - s * 0.12} ${cy + s} L ${cx + s * 0.3} ${cy - s * 0.08} L ${cx - s * 0.04} ${cy - s * 0.08} Z`}
      fill={color}
      opacity="0.95"
    />
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */
export function EnergyMap({ account, netFlow }: { account: string | null; netFlow: number }) {
  const userRole: NodeRole = netFlow > 0.05 ? "exporting" : netFlow < -0.05 ? "importing" : "idle";
  const displayAddr = account
    ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}`
    : "0x71C...3A9";

  const userNode: GridNode = {
    id: "user", label: "My House", shortAddr: displayAddr,
    role: userRole, kwh: Math.abs(netFlow).toFixed(2), x: 600, y: 85, isUser: true,
  };

  const allNodes: GridNode[] = [...STATIC_NODES, userNode];
  const activeCount = allNodes.filter(n => n.role !== "idle").length;

  return (
    <div className="glass-panel relative overflow-hidden p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live Energy Map</div>
          <div className="mt-0.5 font-[Space_Grotesk] text-base font-semibold">
            Neighborhood Grid · Sector 14-B
          </div>
        </div>
        <span
          style={{ background: roleFill(userRole), border: `1px solid ${roleBorder(userRole)}`, color: roleText(userRole) }}
          className="rounded-full px-3 py-1 font-semibold font-[JetBrains_Mono] text-[11px]"
        >
          {userRole === "idle" ? "Idle — No Flow" : `${netFlow > 0 ? "+" : ""}${netFlow.toFixed(2)} kWh`}
        </span>
      </div>

      {/* Dot-grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      {/* SVG Map */}
      <div className="relative" style={{ height: 480 }}>
        <svg
          viewBox="0 0 1200 640"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Strong neon glow filters */}
            <filter id="fg" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="6" result="b1" />
              <feGaussianBlur stdDeviation="2" result="b2" in="SourceGraphic" />
              <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="fc" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="6" result="b1" />
              <feGaussianBlur stdDeviation="2" result="b2" in="SourceGraphic" />
              <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="fhub" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="fnode" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Hub radial gradient */}
            <radialGradient id="hub-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(74,222,128,0.22)" />
              <stop offset="60%"  stopColor="rgba(34,211,238,0.10)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>

            {/* Line gradients for glow direction */}
            <linearGradient id="lg-green" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(74,222,128,0)" />
              <stop offset="50%"  stopColor="rgba(74,222,128,1)" />
              <stop offset="100%" stopColor="rgba(74,222,128,0)" />
            </linearGradient>
            <linearGradient id="lg-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(34,211,238,0)" />
              <stop offset="50%"  stopColor="rgba(34,211,238,1)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </linearGradient>
          </defs>

          {/* ── WIRES: 3-layer rendering for each connection ── */}
          {allNodes.map(node => {
            const d = curveTo(node.x, node.y);
            const isActive = node.role !== "idle";
            const isOut = node.role === "exporting";
            const stroke = roleStroke(node.role);
            const filterId = isOut ? "fg" : "fc";
            const animCls = isActive ? (isOut ? "ef-out" : "ef-in") : "";
            const animCls2 = isActive ? (isOut ? "ef-out2" : "ef-in2") : "";
            const animCls3 = isActive ? (isOut ? "ef-out3" : "ef-in3") : "";

            return (
              <g key={node.id}>
                {/* Layer 0: static background wire */}
                <path d={d} stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" fill="none" />

                {/* Layer 1: thick glow base (always shown when active, dim when idle) */}
                {isActive && (
                  <path
                    d={d}
                    stroke={stroke}
                    strokeWidth="3"
                    fill="none"
                    opacity="0.18"
                  />
                )}

                {/* Layer 2: main dashed animated flow */}
                {isActive && (
                  <path
                    d={d}
                    stroke={stroke}
                    strokeWidth={node.isUser ? 4 : 3}
                    fill="none"
                    strokeDasharray="16 24"
                    strokeLinecap="round"
                    filter={`url(#${filterId})`}
                    className={animCls}
                    opacity="0.95"
                  />
                )}

                {/* Layer 3: faster, smaller dashes (staggered offset) */}
                {isActive && (
                  <path
                    d={d}
                    stroke={stroke}
                    strokeWidth={node.isUser ? 2.5 : 2}
                    fill="none"
                    strokeDasharray="6 34"
                    strokeLinecap="round"
                    filter={`url(#${filterId})`}
                    className={animCls2}
                    opacity="0.75"
                  />
                )}

                {/* Layer 4: bright leading dot */}
                {isActive && (
                  <path
                    d={d}
                    stroke={stroke}
                    strokeWidth={node.isUser ? 6 : 5}
                    fill="none"
                    strokeDasharray="2 200"
                    strokeLinecap="round"
                    filter={`url(#${filterId})`}
                    className={animCls3}
                    opacity="1"
                  />
                )}
              </g>
            );
          })}

          {/* ── CENTRAL UTILITY GRID HUB ── */}
          <HubNode />

          {/* ── HOUSE NODES ── */}
          {allNodes.map(node => (
            <HouseNode key={node.id} node={node} />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-5 text-[11px] text-muted-foreground border-t border-white/5 pt-3">
        <span className="flex items-center gap-2">
          <span className="inline-flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `${G}1)`, boxShadow: `0 0 4px ${G}0.8)` }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `${G}1)`, boxShadow: `0 0 4px ${G}0.8)` }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `${G}1)`, boxShadow: `0 0 4px ${G}0.8)` }} />
          </span>
          Exporting (Solar → Grid)
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `${C}1)`, boxShadow: `0 0 4px ${C}0.8)` }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `${C}1)`, boxShadow: `0 0 4px ${C}0.8)` }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: `${C}1)`, boxShadow: `0 0 4px ${C}0.8)` }} />
          </span>
          Importing (Grid → House)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-white/10" />
          Idle — No Flow
        </span>
        <span className="ml-auto font-[JetBrains_Mono] text-[10px]">
          {activeCount} active flows · {allNodes.length + 1} nodes
        </span>
      </div>
    </div>
  );
}

/* ── Hub Node (large hexagonal utility grid) ─────────────────────────────── */
function HubNode() {
  const R = 72; // larger hexagon
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${GX + R * Math.cos(a)},${GY + R * Math.sin(a)}`;
  }).join(" ");
  const outerPts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${GX + (R + 18) * Math.cos(a)},${GY + (R + 18) * Math.sin(a)}`;
  }).join(" ");

  return (
    <g>
      {/* Ambient radial glow */}
      <circle cx={GX} cy={GY} r={R + 55} fill="url(#hub-bg)" opacity="0.9" />

      {/* Spinning outer hex ring */}
      <polygon points={outerPts} fill="none"
        stroke="rgba(74,222,128,0.18)" strokeWidth="1.5"
        className="hub-spin" />
      <polygon points={outerPts} fill="none"
        stroke="rgba(34,211,238,0.12)" strokeWidth="1"
        strokeDasharray="8 14"
        className="hub-spin-rev" />

      {/* Main hexagon */}
      <polygon points={pts}
        fill="rgba(10,16,24,0.96)"
        stroke="rgba(74,222,128,0.55)"
        strokeWidth="2.5"
        filter="url(#fhub)"
      />

      {/* Inner hex accent */}
      {(() => {
        const rInner = R * 0.62;
        const innerPts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          return `${GX + rInner * Math.cos(a)},${GY + rInner * Math.sin(a)}`;
        }).join(" ");
        return <polygon points={innerPts} fill="none" stroke="rgba(34,211,238,0.2)" strokeWidth="1" />;
      })()}

      {/* Lightning bolt SVG icon */}
      <BoltIcon cx={GX} cy={GY - 14} s={18} color="rgba(74,222,128,0.95)" />

      {/* "Utility Grid" label */}
      <text x={GX} y={GY + 18} textAnchor="middle"
        fontSize="13.5" fontWeight="800" fontFamily="Space Grotesk, sans-serif"
        fill="rgba(255,255,255,0.95)">
        Utility Grid
      </text>
      <text x={GX} y={GY + 34} textAnchor="middle"
        fontSize="9" fontFamily="JetBrains Mono, monospace"
        fill="rgba(255,255,255,0.32)">
        grid.amoy.io
      </text>

      {/* Pulsing hub ring */}
      <circle cx={GX} cy={GY} r={R + 8}
        fill="none" stroke="rgba(74,222,128,0.25)" strokeWidth="2"
        className="hub-pulse" />
    </g>
  );
}

/* ── House Node ────────────────────────────────────────────────────────────── */
function HouseNode({ node }: { node: GridNode }) {
  const W = node.isUser ? 190 : 130;
  const H = node.isUser ? 116 : 78;
  const rx = W / 2;
  const ry = H / 2;

  const border = node.isUser
    ? (node.role === "exporting" ? `${G}0.70)` : node.role === "importing" ? `${C}0.70)` : "rgba(255,255,255,0.20)")
    : roleBorder(node.role);
  const bg = node.isUser
    ? (node.role === "exporting" ? `${G}0.10)` : node.role === "importing" ? `${C}0.10)` : "rgba(255,255,255,0.03)")
    : "rgba(11,16,26,0.92)";
  const accent  = roleText(node.role);
  const filterId = node.role !== "idle" ? (node.role === "exporting" ? "fg" : "fc") : "fnode";
  const iconColor = node.role === "exporting" ? `${G}0.9)` : node.role === "importing" ? `${C}0.9)` : "rgba(255,255,255,0.30)";
  const iconS = node.isUser ? 14 : 10;   // house icon scale
  const iconCY = node.y - ry + (node.isUser ? 34 : 24);  // vertical centre of icon
  const iconCX = node.x - rx + (node.isUser ? 22 : 16);  // left-aligned icon

  return (
    <g filter={`url(#${filterId})`}>
      {/* User: double pulsing halo */}
      {node.isUser && (
        <>
          <rect x={node.x - rx - 12} y={node.y - ry - 12} width={W + 24} height={H + 24}
            rx="22" fill="none"
            stroke={node.role === "exporting" ? `${G}0.10)` : node.role === "importing" ? `${C}0.10)` : "rgba(255,255,255,0.05)"}
            strokeWidth="2.5" className="node-pulse-user" />
          <rect x={node.x - rx - 5} y={node.y - ry - 5} width={W + 10} height={H + 10}
            rx="18" fill="none"
            stroke={node.role === "exporting" ? `${G}0.28)` : node.role === "importing" ? `${C}0.28)` : "rgba(255,255,255,0.10)"}
            strokeWidth="1.5" className="node-pulse-user" style={{ animationDelay: "-0.9s" }} />
        </>
      )}
      {/* Neighbour: single halo when active */}
      {!node.isUser && node.role !== "idle" && (
        <rect x={node.x - rx - 5} y={node.y - ry - 5} width={W + 10} height={H + 10}
          rx="16" fill="none"
          stroke={node.role === "exporting" ? `${G}0.18)` : `${C}0.18)`}
          strokeWidth="1.5" className="node-pulse" />
      )}

      {/* Card background */}
      <rect x={node.x - rx} y={node.y - ry} width={W} height={H}
        rx="12" fill={bg} stroke={border} strokeWidth={node.isUser ? 2 : 1.5} />

      {/* Top colour accent bar */}
      <rect x={node.x - rx + 6} y={node.y - ry + 1} width={W - 12} height={2.5} rx="1.5"
        fill={node.role === "exporting" ? `${G}0.45)` : node.role === "importing" ? `${C}0.45)` : "rgba(255,255,255,0.05)"} />

      {/* House icon */}
      <HouseIcon cx={iconCX} cy={iconCY} s={iconS} color={iconColor} />

      {/* Label */}
      <text
        x={node.x - rx + iconS * 2 + (node.isUser ? 14 : 10)}
        y={node.y - ry + (node.isUser ? 28 : 20)}
        fontSize={node.isUser ? 13 : 10}
        fontWeight="700"
        fontFamily="Space Grotesk, sans-serif"
        fill="rgba(255,255,255,0.92)"
      >
        {node.isUser ? "My House" : node.label}
      </text>

      {/* Address — user only */}
      {node.isUser && (
        <text
          x={node.x - rx + iconS * 2 + 14}
          y={node.y - ry + 43}
          fontSize="8"
          fontFamily="JetBrains Mono, monospace"
          fill="rgba(255,255,255,0.25)"
        >
          {node.shortAddr}
        </text>
      )}

      {/* Divider */}
      <line
        x1={node.x - rx + 8} y1={node.y - ry + (node.isUser ? 56 : 38)}
        x2={node.x + rx - 8} y2={node.y - ry + (node.isUser ? 56 : 38)}
        stroke="rgba(255,255,255,0.05)" strokeWidth="1"
      />

      {/* Status pill */}
      <rect
        x={node.x - rx + 8} y={node.y - ry + (node.isUser ? 62 : 44)}
        width={W - 16} height={node.isUser ? 40 : 24}
        rx="7" fill={roleFill(node.role)}
      />
      <text
        x={node.x}
        y={node.y - ry + (node.isUser ? 62 : 44) + (node.isUser ? 20 : 12)}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={node.isUser ? 11 : 8.5}
        fontWeight="700"
        fontFamily="Space Grotesk, sans-serif"
        fill={accent}
      >
        {roleLabel(node.role, node.kwh)}
      </text>
    </g>
  );
}
