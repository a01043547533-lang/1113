// 아이콘, 로고, 히어로 카드 줄.
// 히어로 카드 줄은 사진 대신 전국 실시간 숫자(/api/highlights)를 담는다.

export const SIGNS = [
  { tab: "trainings", word: "배우고", label: "국비 교육", tone: "sky" },
  { tab: "exams", word: "취득하고", label: "자격증 시험", tone: "leaf" },
  { tab: "jobs", word: "다시 일하기", label: "채용 · 알바", tone: "sun" },
];

const I = {
  arrow: <path d="M5 12h12m-5-5 5 5-5 5" />,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  cal: <><rect x="4" y="5.5" width="16" height="14" rx="3" /><path d="M4 10h16M9 3.5v4M15 3.5v4" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  book: <path d="M4 6.5c3-1.4 5.7-1.2 8 .6v12c-2.3-1.8-5-2-8-.6v-12Zm16 0c-3-1.4-5.7-1.2-8 .6v12c2.3-1.8 5-2 8-.6v-12Z" />,
  work: <><rect x="3.5" y="7.5" width="17" height="12" rx="2.5" /><path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7M3.5 12.5h17" /></>,
  won: <path d="M4 8h16M4 12h16M6 5l3 13 3-10 3 10 3-13" />,
  cert: <><rect x="4" y="4" width="16" height="12" rx="2.5" /><path d="M8 8.5h8M8 11.5h5" /><path d="M15 15.5v5l2-1.2 2 1.2v-5" /></>,
  // 관심 분야
  cook: <><path d="M6 11h12v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-6Z" /><path d="M4 11h16M9 4.5c0 1.5 1 1.5 1 3M13 4.5c0 1.5 1 1.5 1 3" /></>,
  truck: <><path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 9.5V20h12V9.5M10 20v-5h4v5" /></>,
  leaf: <><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-4 6-6.5 9-8" /></>,
  wrench: <path d="M14.5 5.5a4 4 0 0 0 4.9 4.9l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-1.9-1.9Z" />,
  scissors: <><circle cx="6.5" cy="7" r="2.5" /><circle cx="6.5" cy="17" r="2.5" /><path d="M8.6 8.4 20 17M8.6 15.6 20 7" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  shield: <path d="M12 3.5 5 6.5v5.5c0 4.3 3 7.6 7 8.5 4-.9 7-4.2 7-8.5V6.5l-7-3Z" />,
  brief: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 9.5h8M8 13h8M8 16.5h5" /></>,
  phone: <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15.5 15.5 0 0 1 4.5 6 2 2 0 0 1 6.5 4Z" />,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7 7.5 6 7.5-6" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.6v.1" /></>,
  team: <><circle cx="9" cy="9" r="3" /><circle cx="16.5" cy="10" r="2.4" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M14.5 15.2c2.6-.3 4.7 1 5.5 3.8" /></>,
  pen: <path d="M15.5 4.5 19.5 8.5 9 19H5v-4L15.5 4.5ZM13.5 6.5l4 4" />,
};

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: "none" }}>
      {I[name]}
    </svg>
  );
}

export function Arrow({ size = 20 }) {
  return <Icon name="arrow" size={size} />;
}

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="logo-text">재취업 길잡이<sup>50+</sup></span>
    </span>
  );
}

// 히어로 아래 카드 줄: /api/highlights 의 전국 숫자로 채운다(높이를 엇갈리게).
const n = (v) => (v == null ? "—" : Number(v).toLocaleString("ko-KR"));
const cut = (t, k = 22) => (t && t.length > k ? t.slice(0, k).trim() + "…" : t || "");
const md = (iso) => (iso ? `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일` : "");

export function agoText(iso) {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return m < 1 ? "방금" : m < 60 ? `${m}분 전` : `${Math.round(m / 60)}시간 전`;
}

function buildTiles(hl) {
  const sc = hl?.senior_courses, pc = hl?.popular_courses, jb = hl?.jobs, ev = hl?.events;
  const age = hl?.age_top?.groups?.["50대"];
  const ok = (x) => x && !x.error;
  const pcs = Array.isArray(pc) ? pc : [];
  return [
    { tab: "trainings", kind: "dark", h: 72, icon: "book", label: "중장년 대상 국비 과정",
      big: ok(sc) ? n(sc.count) : "—", unit: "개", sub: ok(sc) && sc.top ? `${cut(sc.top.title)} · ${sc.top.sido || ""}` : "중장년·신중년·시니어 과정" },
    { tab: "trainings", kind: "light", h: 86, icon: "cal", label: `많이 열리는 국비 과정${pcs[0] ? ` · ${pcs[0].name}` : ""}`,
      big: pcs[0] ? n(pcs[0].count) : "—", unit: "개 회차", sub: pcs.slice(1, 3).map((x) => `${x.name} ${n(x.count)}`).join(" · ") || "3개월 안에 시작" },
    { tab: "exams", kind: "mint", h: 64, icon: "cert", label: "50·60대 응시 1위", text: true,
      big: age ? "지게차" : "—", unit: "", sub: "지게차운전기능사 · 기사는 전기기사 · 2025년 필기 응시자" },
    { tab: "jobs", kind: "dark", h: 96, icon: "work", label: "중장년 채용공고 접수 중",
      big: ok(jb) ? n(jb.open) : "—", unit: "건", sub: ok(jb) && jb.kinds?.[0] ? `가장 많은 일: ${jb.kinds[0].name} ${n(jb.kinds[0].count)}건` : "전국 기준" },
    { tab: "jobs", kind: "light", h: 74, icon: "pin", label: "다가오는 채용행사",
      big: ok(ev) ? n(ev.count) : "—", unit: "건", sub: ok(ev) && ev.next ? `${cut(ev.next.title, 18)} · ${md(ev.next.date)}` : "고용센터 현장면접·박람회" },
  ];
}

export function HeroTiles({ hl, loading, onOpen }) {
  const tiles = buildTiles(hl);
  return (
    <div className={"tiles-wrap" + (loading ? " is-loading" : "")}>
      <div className="tiles">
        {tiles.map((t, i) => (
          <button
            key={i}
            type="button"
            className={`tile tile-${t.kind}`}
            style={{ "--h": t.h, "--i": i }}
            onClick={() => onOpen(t.tab)}
          >
            <span className="tile-top">
              <span className="tile-icon"><Icon name={t.icon} size={20} /></span>
              <span className="tile-label">{t.label}</span>
            </span>
            <span className={"tile-num" + (t.text ? " is-text" : "")}>{t.big}<small>{t.unit}</small></span>
            <span className="tile-sub">{t.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
