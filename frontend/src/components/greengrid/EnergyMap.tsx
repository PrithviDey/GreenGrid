import { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type NodeRole = "exporting" | "importing" | "idle";

interface GridNode {
  id: string;
  label: string;
  shortAddr: string;
  role: NodeRole;
  kwh: string;
  x: number; // SVG coordinate 0–1000
  y: number; // SVG coordinate 0–560
  isUser?: boolean;
  isGrid?: boolean;
}

// ─── Static neighborhood layout ──────────────────────────────────────────────
// Central grid hub at (500, 280). User house at (500, 110).
// Neighbors arranged around the hub.
const STATIC_NODES: GridNode[] = [
  // Neighbor houses — fixed roles for the demo
  { id: "n1", label: "House A",  shortAddr: "0x89F...7C2", role: "exporting", kwh: "3.2", x: 180,  y: 80  },
  { id: "n2", label: "House B",  shortAddr: "0x41A...9E8", role: "importing", kwh: "1.8", x: 820,  y: 80  },
  { id: "n3", label: "House C",  shortAddr: "0xB0D...1F4", role: "idle",      kwh: "0.0", x: 100,  y: 310 },
  { id: "n4", label: "House D",  shortAddr: "0x77E...50b", role: "exporting", kwh: "4.5", x: 900,  y: 310 },
  { id: "n5", label: "House E",  shortAddr: "0x9E8...8Cc", role: "importing", kwh: "2.1", x: 220,  y: 480 },
  { id: "n6", label: "House F",  shortAddr: "0xC3A...Fd5", role: "idle",      kwh: "0.0", x: 780,  y: 480 },
];

const GRID_NODE: GridNode = {
  id: "grid", label: "Utility Grid", shortAddr: "grid.amoy.io",
  role: "idle", kwh: "0", x: 500, y: 290, isGrid: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const GREEN  = "rgba(74,222,128,";   // neon green with alpha
const CYAN   = "rgba(34,211,238,";   // neon cyan with alpha
const DIM    = "rgba(255,255,255,";  // neutral for idle

function roleColor(role: NodeRole, alpha = 0.9): string {
  if (role === "exporting") return `${GREEN}${alpha})`;
  if (role === "importing") return `${CYAN}${alpha})`;
  return `${DIM}${alpha})`;
}

function roleBg(role: NodeRole): string {
  if (role === "exporting") return "rgba(74,222,128,0.12)";
  if (role === "importing") return "rgba(34,211,238,0.12)";
  return "rgba(255,255,255,0.04)";
}

function roleBorder(role: NodeRole): string {
  if (role === "exporting") return "rgba(74,222,128,0.5)";
  if (role === "importing") return "rgba(34,211,238,0.5)";
  return "rgba(255,255,255,0.08)";
}

function roleLabel(role: NodeRole, kwh: string): string {
  if (role === "exporting") return `↑ Exporting ${kwh} kWh`;
  if (role === "importing") return `↓ Importing ${kwh} kWh`;
  return "Idle";
}

// ─── Canvas-based animated flow line ─────────────────────────────────────────
// We render the energy map inside an SVG so we can do animated stroke-dashoffset.

function buildPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // slight quadratic curve toward center
  const cx = mx + (500 - mx) * 0.15;
  const cy = my + (290 - my) * 0.15;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function EnergyMap({
  account,
  netFlow,
}: {
  account: string | null;
  netFlow: number;
}) {
  const userRole: NodeRole = netFlow > 0.05 ? "exporting" : netFlow < -0.05 ? "importing" : "idle";
  const displayAddr = account
    ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}`
    : "0x71C...3A9";

  const userNode: GridNode = {
    id: "user", label: "My House", shortAddr: displayAddr,
    role: userRole, kwh: Math.abs(netFlow).toFixed(2),
    x: 500, y: 90, isUser: true,
  };

  // All nodes that connect to the grid hub
  const allNodes: GridNode[] = [...STATIC_NODES, userNode];

  const SVG_W = 1000;
  const SVG_H = 560;

  return (
    <div className="glass-panel relative overflow-hidden p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Energy Map</div>
          <div className="mt-0.5 font-[Space_Grotesk] text-base font-semibold">
            Neighborhood Grid · Sector 14-B
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            style={{ background: roleBg(userRole), border: `1px solid ${roleBorder(userRole)}`, color: roleColor(userRole) }}
            className="rounded-full px-3 py-1 font-semibold font-[JetBrains_Mono] text-[11px]"
          >
            {userRole === "idle" ? "Idle — No Flow" : `${netFlow > 0 ? "+" : ""}${netFlow.toFixed(2)} kWh`}
          </span>
        </div>
      </div>

      {/* Background grid dots */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* SVG Map */}
      <div className="relative" style={{ height: 420 }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Green glow filter */}
            <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Cyan glow filter */}
            <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Dim glow */}
            <filter id="glow-dim" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Grid hub gradient */}
            <radialGradient id="hub-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(74,222,128,0.25)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.08)" />
            </radialGradient>
          </defs>

          {/* ── Connection lines from each neighbor to grid hub ── */}
          {allNodes.map(node => {
            const path = buildPath(node.x, node.y, GRID_NODE.x, GRID_NODE.y);
            const isActive = node.role !== "idle";
            const color = node.role === "exporting"
              ? `${GREEN}0.85)` : node.role === "importing"
              ? `${CYAN}0.85)` : `${DIM}0.06)`;
            const filterId = node.role === "exporting" ? "glow-green"
              : node.role === "importing" ? "glow-cyan" : "glow-dim";
            // Exporting: flow goes FROM node TO grid (dashoffset decreases → particles move toward grid)
            // Importing: flow goes FROM grid TO node
            const animClass = isActive
              ? (node.role === "exporting" ? "energy-flow-out" : "energy-flow-in")
              : "";

            return (
              <g key={node.id}>
                {/* Static dim underline */}
                <path
                  d={path}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Animated flow line — only rendered when active */}
                {isActive && (
                  <path
                    d={path}
                    stroke={color}
                    strokeWidth={node.isUser ? 3 : 2.5}
                    fill="none"
                    strokeDasharray="12 18"
                    filter={`url(#${filterId})`}
                    className={animClass}
                    style={{ opacity: 0.9 }}
                  />
                )}
              </g>
            );
          })}

          {/* ── Central Utility Grid Hub ── */}
          <GridHubNode node={GRID_NODE} />

          {/* ── All house nodes ── */}
          {allNodes.map(node => (
            <HouseNode key={node.id} node={node} />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-5 text-[11px] text-muted-foreground border-t border-white/5 pt-3">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-6 rounded" style={{ background: `${GREEN}0.9)`, boxShadow: `0 0 6px ${GREEN}0.5)` }} />
          Exporting (Solar → Grid)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-6 rounded" style={{ background: `${CYAN}0.9)`, boxShadow: `0 0 6px ${CYAN}0.5)` }} />
          Importing (Grid → House)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-6 rounded bg-white/10" />
          Idle — No Energy Flow
        </span>
        <span className="ml-auto font-[JetBrains_Mono]">
          {STATIC_NODES.filter(n => n.role !== "idle").length + (userRole !== "idle" ? 1 : 0)} active flows · {allNodes.length + 1} nodes
        </span>
      </div>
    </div>
  );
}

// ─── Grid Hub SVG Node ────────────────────────────────────────────────────────
function GridHubNode({ node }: { node: GridNode }) {
  const R = 48; // hexagon "radius"
  // Regular hexagon points centered at node.x, node.y
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${node.x + R * Math.cos(angle)},${node.y + R * Math.sin(angle)}`;
  }).join(" ");

  return (
    <g>
      {/* Outer glow ring */}
      <circle cx={node.x} cy={node.y} r={R + 18} fill="url(#hub-grad)" opacity="0.6" />
      <circle cx={node.x} cy={node.y} r={R + 8} fill="rgba(34,211,238,0.04)" stroke="rgba(34,211,238,0.12)" strokeWidth="1" />
      {/* Hexagon body */}
      <polygon
        points={pts}
        fill="rgba(15,20,30,0.95)"
        stroke="rgba(74,222,128,0.4)"
        strokeWidth="2"
        filter="url(#glow-dim)"
      />
      {/* Icon: lightning bolt SVG path */}
      <text
        x={node.x} y={node.y - 12}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="22" fill="rgba(74,222,128,0.9)"
      >⚡</text>
      {/* Label */}
      <text
        x={node.x} y={node.y + 10}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fontFamily="Space Grotesk, sans-serif"
        fill="rgba(255,255,255,0.9)"
      >
        Utility Grid
      </text>
      <text
        x={node.x} y={node.y + 24}
        textAnchor="middle"
        fontSize="8"
        fontFamily="JetBrains Mono, monospace"
        fill="rgba(255,255,255,0.35)"
      >
        grid.amoy.io
      </text>
    </g>
  );
}

// ─── House SVG Node ───────────────────────────────────────────────────────────
function HouseNode({ node }: { node: GridNode }) {
  const W = node.isUser ? 130 : 110;
  const H = node.isUser ? 86 : 74;
  const rx = W / 2;
  const ry = H / 2;

  const borderColor = node.isUser
    ? (node.role === "exporting" ? "rgba(74,222,128,0.7)"
      : node.role === "importing" ? "rgba(34,211,238,0.7)"
      : "rgba(255,255,255,0.2)")
    : roleBorder(node.role);

  const bgColor = node.isUser
    ? (node.role === "exporting" ? "rgba(74,222,128,0.12)"
      : node.role === "importing" ? "rgba(34,211,238,0.10)"
      : "rgba(255,255,255,0.04)")
    : "rgba(12,17,26,0.92)";

  const accentColor = roleColor(node.role, 0.9);
  const filterId = node.role === "exporting" ? "glow-green"
    : node.role === "importing" ? "glow-cyan" : undefined;

  // House emoji or user marker
  const emoji = node.isUser ? "🏠" : node.role === "exporting" ? "☀️" : node.role === "importing" ? "🔌" : "🏡";

  return (
    <g filter={filterId ? `url(#${filterId})` : undefined}>
      {/* Card background */}
      <rect
        x={node.x - rx} y={node.y - ry}
        width={W} height={H}
        rx="10" ry="10"
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={node.isUser ? 2 : 1.5}
      />

      {/* "YOU" pulse ring for user node */}
      {node.isUser && node.role !== "idle" && (
        <rect
          x={node.x - rx - 4} y={node.y - ry - 4}
          width={W + 8} height={H + 8}
          rx="14" ry="14"
          fill="none"
          stroke={accentColor}
          strokeWidth="1.5"
          opacity="0.35"
          className="energy-pulse-ring"
        />
      )}

      {/* Emoji icon */}
      <text x={node.x - rx + 14} y={node.y} textAnchor="middle" dominantBaseline="middle" fontSize={node.isUser ? 18 : 15}>
        {emoji}
      </text>

      {/* House label */}
      <text
        x={node.x - rx + 28} y={node.y - 14}
        fontSize={node.isUser ? 11 : 9.5}
        fontWeight="700"
        fontFamily="Space Grotesk, sans-serif"
        fill={node.isUser ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)"}
      >
        {node.isUser ? "My House" : node.label}
      </text>

      {/* Address */}
      <text
        x={node.x - rx + 28} y={node.y - 1}
        fontSize="7.5"
        fontFamily="JetBrains Mono, monospace"
        fill="rgba(255,255,255,0.3)"
      >
        {node.shortAddr}
      </text>

      {/* Status badge */}
      <rect
        x={node.x - rx + 8} y={node.y + 16}
        width={W - 16} height={16}
        rx="4"
        fill={roleBg(node.role)}
      />
      <text
        x={node.x} y={node.y + 24}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="7.5"
        fontWeight="600"
        fontFamily="Space Grotesk, sans-serif"
        fill={accentColor}
      >
        {roleLabel(node.role, node.kwh)}
      </text>
    </g>
  );
}
