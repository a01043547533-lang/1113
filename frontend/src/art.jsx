// 가로 줄무늬(스캔라인)로 그린 그림과 아이콘. 모두 코드로 생성해서 이미지 파일이 없다.

// 같은 모양이 매번 나오도록 고정 시드 난수
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 원 하나를 가로줄로 쪼갠 선분 목록. 가장자리는 끊어지고 흩어져서 '스캔' 느낌을 낸다.
function circleLines({ cx, cy, r, gap, seed, from = -1, to = 1 }) {
  const rand = rng(seed);
  const out = [];
  for (let y = cy - r; y <= cy + r; y += gap) {
    const dy = (y - cy) / r;
    if (dy < from || dy > to) continue;
    const hw = Math.sqrt(Math.max(0, 1 - dy * dy)) * r;
    if (hw < 2) continue;
    let x1 = cx - hw + (rand() - 0.3) * r * 0.12;
    let x2 = cx + hw - (rand() - 0.3) * r * 0.12;
    if (rand() < 0.35) {
      // 가운데가 한 번 끊어지는 줄
      const cut = x1 + (x2 - x1) * (0.25 + rand() * 0.5);
      const w = r * (0.04 + rand() * 0.1);
      out.push([x1, cut - w / 2, y], [cut + w / 2, x2, y]);
    } else {
      out.push([x1, x2, y]);
    }
    if (rand() < 0.18) {
      // 바깥으로 튄 짧은 선
      const side = rand() < 0.5 ? -1 : 1;
      const sx = cx + side * (hw + r * (0.08 + rand() * 0.25));
      const len = r * (0.06 + rand() * 0.16);
      out.push([sx - len / 2, sx + len / 2, y]);
    }
  }
  return out;
}

function Lines({ lines, stroke, width, className = "" }) {
  return (
    <g className={"scan " + className} stroke={stroke} strokeWidth={width} strokeLinecap="butt">
      {lines.map(([x1, x2, y], i) => (
        <line key={i} x1={x1} x2={x2} y1={y} y2={y} style={{ animationDelay: `${i * 14}ms` }} />
      ))}
    </g>
  );
}

// 히어로: 떠오르는 해
export function HeroSun({ className }) {
  const lines = circleLines({ cx: 160, cy: 160, r: 132, gap: 7, seed: 7 });
  return (
    <svg className={className} viewBox="0 0 320 320" aria-hidden="true" focusable="false">
      <Lines lines={lines} stroke="var(--accent)" width={3} />
    </svg>
  );
}

// 마무리: 수평선 위로 반쯤 뜬 해 (아래는 파란 푸터로 이어지는 반사광)
export function Horizon() {
  const sun = circleLines({ cx: 400, cy: 250, r: 170, gap: 9, seed: 21, from: -1, to: 0 });
  const rand = rng(5);
  const ground = [];
  for (let i = 0; i < 6; i++) {
    const y = 214 + i * 7;
    const half = 240 + i * 40 + rand() * 30;
    const a = 400 - half, b = 400 + half;
    const cut = a + (b - a) * (0.2 + rand() * 0.6);
    ground.push([a, cut - 10, y], [cut + 10, b, y]);
  }
  return (
    <svg className="horizon" viewBox="0 0 800 252" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <Lines lines={sun.filter(([, , y]) => y < 206)} stroke="var(--accent)" width={3} />
      <Lines lines={ground} stroke="var(--accent)" width={2} />
    </svg>
  );
}

export function Reflection() {
  const rand = rng(11);
  const lines = [];
  for (let i = 0; i < 12; i++) {
    const y = 6 + i * 9;
    const half = 170 * (1 - i / 13) + rand() * 30;
    const a = 400 - half, b = 400 + half;
    if (rand() < 0.5) {
      const cut = a + (b - a) * (0.3 + rand() * 0.4);
      lines.push([a, cut - 8, y], [cut + 8, b, y]);
    } else lines.push([a, b, y]);
  }
  return (
    <svg className="reflection" viewBox="0 0 800 116" aria-hidden="true" focusable="false">
      <Lines lines={lines} stroke="#fff" width={2} className="soft" />
    </svg>
  );
}

// ---------------------------------------------------------------- 줄무늬 아이콘
// <StripeDefs/> 를 페이지에 한 번 두면 모든 아이콘이 같은 줄무늬 패턴을 쓴다.
export function StripeDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="jm-stripes" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="2.2" fill="var(--accent)" />
        </pattern>
      </defs>
    </svg>
  );
}

const ICONS = {
  pin: (
    <path fillRule="evenodd" d="M24 3C15.7 3 9 9.5 9 17.6 9 28.4 24 45 24 45s15-16.6 15-27.4C39 9.5 32.3 3 24 3Zm0 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" />
  ),
  work: (
    <path fillRule="evenodd" d="M17 8h14a3 3 0 0 1 3 3v4h7a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V18a3 3 0 0 1 3-3h7v-4a3 3 0 0 1 3-3Zm2 7h10v-3H19v3Z" />
  ),
  list: (
    <path fillRule="evenodd" d="M10 4h22l8 8v30a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 16v4h20v-4H14Zm0 8v4h20v-4H14Zm0 8v4h12v-4H14Z" />
  ),
  zoom: (
    <path fillRule="evenodd" d="M20 4a16 16 0 1 0 9.4 29l9.1 9.1 4.3-4.3-9.1-9.1A16 16 0 0 0 20 4Zm0 6a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z" />
  ),
  gauge: (
    <path fillRule="evenodd" d="M24 8C12.4 8 3 17.4 3 29c0 3.3.8 6.4 2.1 9.2l.5.8h36.8l.5-.8c1.3-2.8 2.1-5.9 2.1-9.2C45 17.4 35.6 8 24 8Zm9.6 9.2-6.9 10.3a4 4 0 1 1-3.4-2l10.3-8.3Z" />
  ),
  shield: (
    <path fillRule="evenodd" d="M24 3 7 9v12c0 11 7.3 20.4 17 24 9.7-3.6 17-13 17-24V9L24 3Zm-2.2 28.6L14 23.8l3.2-3.2 4.6 4.6 9-9 3.2 3.2-12.2 12.2Z" />
  ),
};

export function StripeIcon({ name, size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="url(#jm-stripes)">
      {ICONS[name]}
    </svg>
  );
}

// 로고: 파란 막대 + 글자
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true" />
      50+ 재취업 길잡이
    </span>
  );
}
