import { T } from "./tokens";

export function Defs({ id }: { id: string }) {
  return (
    <defs>
      <marker id={`${id}-arrow`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={T.muted} />
      </marker>
      <marker id={`${id}-arrow-accent`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={T.accent} />
      </marker>
      <marker id={`${id}-arrow-lend`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={T.lend} />
      </marker>
      <marker id={`${id}-arrow-short`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={T.short} />
      </marker>
    </defs>
  );
}

type NodeKind = "focal" | "step" | "store" | "external" | "user" | "lend" | "short";

const fills: Record<NodeKind, { fill: string; stroke: string; dash?: string }> = {
  focal: { fill: T.accentTint, stroke: T.accent },
  step: { fill: T.paper2, stroke: T.ink },
  store: { fill: "rgba(20,26,31,0.05)", stroke: T.muted },
  external: { fill: "rgba(20,26,31,0.03)", stroke: "rgba(20,26,31,0.30)" },
  user: { fill: "rgba(91,100,112,0.10)", stroke: T.soft },
  lend: { fill: T.lendTint, stroke: T.lend },
  short: { fill: T.shortTint, stroke: T.short },
};

export function Node({
  x, y, w, h, kind = "step", name, sub, tag,
}: { x: number; y: number; w: number; h: number; kind?: NodeKind; name: string; sub?: string; tag?: string }) {
  const f = fills[kind];
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={T.paper} />
      <rect x={x} y={y} width={w} height={h} rx={4} fill={f.fill} stroke={f.stroke} strokeWidth={1} strokeDasharray={f.dash} />
      {tag && (
        <>
          <rect x={x + 8} y={y + 6} width={tag.length * 6 + 10} height={12} rx={2} fill="transparent" stroke={f.stroke} strokeOpacity={0.4} strokeWidth={0.8} />
          <text x={x + 13 + tag.length * 3} y={y + 15} fill={f.stroke} fillOpacity={0.85} fontSize={7} fontFamily="var(--font-mono)" textAnchor="middle" letterSpacing="0.08em">{tag}</text>
        </>
      )}
      <text x={cx} y={sub ? cy + 2 : cy + 4} fill={T.ink} fontSize={12} fontWeight={600} fontFamily="var(--font-sans)" textAnchor="middle">{name}</text>
      {sub && <text x={cx} y={cy + 17} fill={T.muted} fontSize={9} fontFamily="var(--font-mono)" textAnchor="middle">{sub}</text>}
    </g>
  );
}

/// Arrow label with an opaque mask and a 6px gap kept clear of the stroke by the caller's placement.
export function Label({ x, y, text, tone = T.soft, anchor = "middle" }: { x: number; y: number; text: string; tone?: string; anchor?: "middle" | "start" | "end" }) {
  const w = text.length * 5.2 + 8;
  const rx = anchor === "middle" ? x - w / 2 : anchor === "start" ? x - 4 : x - w + 4;
  return (
    <g>
      <rect x={rx} y={y - 9} width={w} height={12} rx={2} fill={T.paper} />
      <text x={x} y={y} fill={tone} fontSize={8} fontFamily="var(--font-mono)" textAnchor={anchor} letterSpacing="0.04em">{text}</text>
    </g>
  );
}

export function Legend({ items }: { items: { swatch: string; label: string; dashed?: boolean }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px] border" style={{ background: it.swatch, borderColor: it.dashed ? T.muted : it.swatch, borderStyle: it.dashed ? "dashed" : "solid" }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function Figure({ children, caption, minWidth = 640 }: { children: React.ReactNode; caption?: string; minWidth?: number }) {
  return (
    <figure className="mt-6">
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>{children}</div>
      </div>
      {caption && <figcaption className="mt-3 max-w-prose text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
