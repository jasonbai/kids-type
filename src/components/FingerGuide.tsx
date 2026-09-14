import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { FINGERS, FINGER_MAP, type FingerId, type FingerNo } from '../data/fingerMap';

interface Props {
  /** 包含键盘与手部留白的相对定位容器 */
  containerRef: RefObject<HTMLDivElement | null>;
  /** 字母 → 按键 DOM 引用表（由 VirtualKeyboard 填充） */
  keyRefs: RefObject<Map<string, HTMLButtonElement>>;
  targetChar: string | null;
  /** 刚按错的字母：其对应手指短暂闪红（与 VirtualKeyboard 的 wrongChar 同源） */
  wrongChar?: string | null;
}

/* ---------- 视觉参数（长度按 56px 键宽归一，运行时乘 scale 适配小屏） ---------- */
/** 手部轮廓色（slate-400，浅/深主题下均可读，故不走 token） */
const OUTLINE = '#94a3b8';
/** 静止时指尖距键盘底边的间隙（中指最长、小指最短） */
const REST_TIP_GAP: Record<FingerNo, number> = { 1: 12, 2: 5, 3: 10, 4: 21 };
/** 手指半宽 */
const FINGER_R: Record<FingerNo, number> = { 1: 8, 2: 8.4, 3: 8, 4: 7 };
/** 指根线距键盘底边 */
const BASE_Y_GAP = 80;
/** 相邻指根横向间距：手掌收拢，指尖才展开到各自键位 */
const KNUCKLE_SPACING = 20;
/** 指尖横向朝基准键收拢的比例，1 = 精确对齐键心 */
const TIP_PULL = 0.85;
/** 活动手指指尖朝目标键横向偏移的比例 */
const ACTIVE_PULL = 0.4;

/** 一根手指 = 从指根到指尖的胶囊 */
interface FingerGeo {
  id: FingerId;
  bx: number;
  by: number;
  tx: number;
  ty: number;
  r: number;
}

interface HandGeo {
  fingers: FingerGeo[];
  palm: { x: number; y: number; w: number; h: number; rx: number };
  thumb: { x1: number; y1: number; x2: number; y2: number; r: number };
}

interface ActiveGeo {
  fingerId: FingerId;
  color: string;
  /** 伸展后的手指（指根不动，指尖抬向目标键） */
  finger: FingerGeo;
  kx: number;
  /** 目标键底边（轨迹线终点，避免压住键帽字母） */
  kbY: number;
}

interface Geo {
  hands: HandGeo[];
  s: number;
  active: ActiveGeo | null;
  /** 按错的手指（静止位置闪红） */
  wrong: FingerGeo | null;
}

/** 两点间胶囊（两端半圆头）路径 */
function capsule(x1: number, y1: number, x2: number, y2: number, r: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ax = x1 + nx * r;
  const ay = y1 + ny * r;
  const bx = x2 + nx * r;
  const by = y2 + ny * r;
  const cx = x2 - nx * r;
  const cy = y2 - ny * r;
  const dx2 = x1 - nx * r;
  const dy2 = y1 - ny * r;
  return `M ${ax} ${ay} L ${bx} ${by} A ${r} ${r} 0 0 0 ${cx} ${cy} L ${dx2} ${dy2} A ${r} ${r} 0 0 0 ${ax} ${ay} Z`;
}

function buildHand(
  side: 'L' | 'R',
  /** 由外向内的手指序：左手小指→食指，右手食指→小指 */
  order: FingerNo[],
  /** 各手指基准键中心 x（左手 a s d f，右手 j k l 及小指虚拟位） */
  tipXs: number[],
  kbBottom: number,
  s: number,
): HandGeo {
  const center = (Math.min(...tipXs) + Math.max(...tipXs)) / 2;
  const baseY = kbBottom + BASE_Y_GAP * s;
  const fingers = order.map((no, i) => ({
    id: `${side}${no}` as FingerId,
    bx: center + (i - 1.5) * KNUCKLE_SPACING * s,
    by: baseY,
    tx: center + (tipXs[i] - center) * TIP_PULL,
    ty: kbBottom + REST_TIP_GAP[no] * s,
    r: FINGER_R[no] * s,
  }));
  const bxMin = Math.min(...fingers.map((f) => f.bx));
  const bxMax = Math.max(...fingers.map((f) => f.bx));
  const palm = {
    x: bxMin - 10 * s,
    y: baseY - 8 * s,
    w: bxMax - bxMin + 20 * s,
    h: 42 * s,
    rx: 18 * s,
  };
  // 拇指从掌根内侧（两手之间）斜向下伸出
  const dir = side === 'L' ? 1 : -1;
  const inner = side === 'L' ? palm.x + palm.w : palm.x;
  const thumb = {
    x1: inner - dir * 4 * s,
    y1: baseY + 16 * s,
    x2: inner + dir * 28 * s,
    y2: baseY + 36 * s,
    r: 7.5 * s,
  };
  return { fingers, palm, thumb };
}

/** 伸展活动手指：指尖抬到键盘底边下方，横向朝目标键偏移 */
function extendFinger(rest: FingerGeo, keyCx: number, kbBottom: number, s: number): FingerGeo {
  return {
    ...rest,
    tx: rest.tx + (keyCx - rest.tx) * ACTIVE_PULL,
    ty: kbBottom + 10 * s,
  };
}

function computeGeo(
  container: HTMLDivElement,
  keyRefs: RefObject<Map<string, HTMLButtonElement>>,
  targetChar: string | null,
  wrongChar: string | null,
): Geo | null {
  const rectOf = (ch: string) => {
    const el = keyRefs.current?.get(ch);
    if (!el) return null;
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      cx: r.left + r.width / 2 - c.left,
      cy: r.top + r.height / 2 - c.top,
      bottom: r.bottom - c.top,
      w: r.width,
    };
  };
  const home = {
    a: rectOf('a'), s: rectOf('s'), d: rectOf('d'), f: rectOf('f'),
    j: rectOf('j'), k: rectOf('k'), l: rectOf('l'), m: rectOf('m'),
  };
  if (!home.a || !home.s || !home.d || !home.f || !home.j || !home.k || !home.l || !home.m) {
    return null;
  }
  const s = home.a.w / 56;
  const pitch = home.s.cx - home.a.cx;
  // 手掌基准线取整个键盘的底边（例句模式多了空格排，需用它而非字母第三排）
  const bottomOf = (ch: string) => rectOf(ch)?.bottom ?? null;
  const kbBottom = bottomOf(' ') ?? home.m.bottom;
  const hands: HandGeo[] = [
    buildHand('L', [4, 3, 2, 1], [home.a.cx, home.s.cx, home.d.cx, home.f.cx], kbBottom, s),
    buildHand('R', [1, 2, 3, 4], [home.j.cx, home.k.cx, home.l.cx, home.l.cx + pitch], kbBottom, s),
  ];

  const allFingers = hands.flatMap((h) => h.fingers);
  const activeId = targetChar ? FINGER_MAP[targetChar] : undefined;
  let active: ActiveGeo | null = null;
  if (activeId && targetChar) {
    const key = rectOf(targetChar);
    const rest = allFingers.find((f) => f.id === activeId);
    if (key && rest) {
      active = {
        fingerId: activeId,
        color: FINGERS[activeId].color,
        finger: extendFinger(rest, key.cx, kbBottom, s),
        kx: key.cx,
        kbY: key.bottom,
      };
    }
  }

  const wrongId = wrongChar ? FINGER_MAP[wrongChar] : undefined;
  const wrong = wrongId && wrongId !== activeId
    ? allFingers.find((f) => f.id === wrongId) ?? null
    : null;

  return { hands, s, active, wrong };
}

export default function FingerGuide({ containerRef, keyRefs, targetChar, wrongChar }: Props) {
  const [geo, setGeo] = useState<Geo | null>(null);

  useEffect(() => {
    const compute = () => {
      const container = containerRef.current;
      if (!container) {
        setGeo(null);
        return;
      }
      setGeo(computeGeo(container, keyRefs, targetChar, wrongChar ?? null));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [targetChar, wrongChar, containerRef, keyRefs]);

  if (!geo) return null;
  const { s, active, wrong } = geo;
  const sw = 2.4 * s;

  // 轨迹线：从活动指尖弧向目标键中心
  let traj: string | null = null;
  let tipDot: { x: number; y: number } | null = null;
  if (active) {
    const startX = active.finger.tx;
    const startY = active.finger.ty - 4 * s;
    tipDot = { x: startX, y: startY };
    const endY = active.kbY + 2 * s;
    const cX = (startX + active.kx) / 2;
    const cY = Math.min(startY, endY) - 26 * s;
    traj = `M ${startX} ${startY} Q ${cX} ${cY} ${active.kx} ${endY}`;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      {geo.hands.map((hand, hi) => (
        <g key={hi}>
          <rect
            x={hand.palm.x}
            y={hand.palm.y}
            width={hand.palm.w}
            height={hand.palm.h}
            rx={hand.palm.rx}
            className="fill-card"
            stroke={OUTLINE}
            strokeWidth={sw}
          />
          <path
            d={capsule(hand.thumb.x1, hand.thumb.y1, hand.thumb.x2, hand.thumb.y2, hand.thumb.r)}
            className="fill-card"
            stroke={OUTLINE}
            strokeWidth={sw}
          />
          {hand.fingers.map((f) =>
            f.id === active?.fingerId ? null : (
              <path
                key={f.id}
                d={capsule(f.bx, f.by, f.tx, f.ty, f.r)}
                className="fill-card"
                stroke={OUTLINE}
                strokeWidth={sw}
              />
            ),
          )}
        </g>
      ))}

      {wrong && (
        <g
          key={`wrong-${wrong.id}`}
          className="animate-finger-pop"
          style={POP_STYLE}
        >
          <path
            d={capsule(wrong.bx, wrong.by, wrong.tx, wrong.ty, wrong.r)}
            className="fill-wrong/15 stroke-wrong"
            strokeWidth={sw * 1.2}
            strokeLinejoin="round"
          />
        </g>
      )}

      {active && traj && (
        <g
          key={targetChar ?? 'active'}
          className="animate-finger-pop"
          style={POP_STYLE}
        >
          <path
            d={capsule(
              active.finger.bx,
              active.finger.by,
              active.finger.tx,
              active.finger.ty,
              active.finger.r,
            )}
            fill={active.color}
            fillOpacity={0.16}
            stroke={active.color}
            strokeWidth={sw * 1.25}
            strokeLinejoin="round"
          />
          {tipDot && (
            <circle cx={tipDot.x} cy={tipDot.y} r={5 * s} fill={active.color} opacity={0.9} />
          )}
          <path
            d={traj}
            fill="none"
            stroke={active.color}
            strokeWidth={4.5 * s}
            strokeLinecap="round"
            opacity={0.7}
          />
        </g>
      )}
    </svg>
  );
}

const POP_STYLE: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: '50% 100%',
};
