import { useMemo } from "react";

// The start page's backdrop: a time-scaled tree, the picture every Nextstrain dataset opens with,
// grown from a seeded random split so it is the same on every visit. Decorative only.

const TIPS = 90;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Node = { x: number; y: number; children: Node[]; clade: number };

function randomTree(): Node {
  const random = mulberry32(11);
  let tip = 0;
  let clades = 0;
  // A clade of n tips splits in two at a random size; tips are sampled over the last fifth of the
  // time axis, as in a surveillance dataset. Branches from the third level down each get a color.
  const grow = (n: number, x: number, depth: number, clade: number): Node => {
    const own = depth === 3 ? ++clades : clade;
    if (n === 1) return { x: Math.max(x + 0.02, 0.8 + random() * 0.2), y: tip++ / (TIPS - 1), children: [], clade: own };
    const k = 1 + Math.floor(random() * (n - 1));
    const step = () => x + (0.8 - x) * (0.1 + random() * 0.3);
    const children = [grow(Math.min(k, n - k), step(), depth + 1, own), grow(Math.max(k, n - k), step(), depth + 1, own)];
    return { x, y: (children[0].y + children[1].y) / 2, children, clade: own };
  };
  return grow(TIPS, 0, 0, 0);
}

function flatten(n: Node): Node[] {
  return [n, ...n.children.flatMap(flatten)];
}

const CLADE_COLORS = ["var(--cal-cat-1)", "var(--cal-cat-2)", "var(--cal-cat-3)", "var(--cal-cat-4)", "var(--cal-cat-5)", "var(--cal-cat-7)"];

export function Backdrop() {
  const nodes = useMemo(() => flatten(randomTree()), []);
  const W = 1000;
  const H = 1000;
  const X = (x: number) => 40 + x * (W - 80);
  const Y = (y: number) => 30 + y * (H - 60);
  const color = (n: Node) => (n.clade === 0 ? "var(--cal-ink-muted)" : CLADE_COLORS[n.clade % CLADE_COLORS.length]);
  return (
    <svg className="start-backdrop" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {nodes.flatMap((n) =>
        n.children.map((c, i) => (
          <path key={`${n.x}-${n.y}-${i}`} d={`M${X(n.x)},${Y(c.y)}H${X(c.x)}`} stroke={color(c)} strokeWidth="1.5" fill="none" />
        ))
      )}
      {nodes.filter((n) => n.children.length).map((n, i) => (
        <path key={i} d={`M${X(n.x)},${Y(n.children[0].y)}V${Y(n.children[n.children.length - 1].y)}`} stroke={color(n)} strokeWidth="1.5" fill="none" />
      ))}
      {nodes.filter((n) => !n.children.length).map((n, i) => (
        <circle key={i} cx={X(n.x)} cy={Y(n.y)} r="4" fill={color(n)} />
      ))}
    </svg>
  );
}
