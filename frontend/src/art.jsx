// 아이콘, 로고, 히어로 카드 줄.
// 히어로 카드 줄은 사진 대신 실제로 받은 데이터(2026-11-13, 대구·조리·제과제빵 예시와 전국 공고 수)를 담는다.

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

// 히어로 아래 카드 줄 (높이를 엇갈리게)
const TILES = [
  { tab: "trainings", kind: "dark", h: 72, icon: "book", label: "국비 교육", big: "31", unit: "개 과정", sub: "대구 · 3개월 안에 시작" },
  { tab: "exams", kind: "light", h: 86, icon: "cert", label: "한식조리기능사", big: "14,500", unit: "원", sub: "필기 응시료 · 실기 26,900원", chip: "상시 시험" },
  { tab: "jobs", kind: "mint", h: 60, icon: "cal", label: "현장 채용행사", big: "11.17", unit: "", sub: "제3차 달성군 취업박람회 · 14:00" },
  { tab: "jobs", kind: "dark", h: 96, icon: "work", label: "중장년 채용공고", big: "259", unit: "건", sub: "전국 지금 접수 중 · 50세 이상 우대 포함" },
  { tab: "exams", kind: "light", h: 74, icon: "pin", label: "대구 상설 시험장", big: "25", unit: "곳", sub: "디지털시험센터 포함" },
];

export function HeroTiles({ onOpen }) {
  return (
    <div className="tiles-wrap">
      <div className="tiles">
        {TILES.map((t, i) => (
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
            <span className="tile-num">{t.big}<small>{t.unit}</small></span>
            <span className="tile-sub">{t.sub}</span>
            {t.chip && <span className="tile-chip">{t.chip}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
