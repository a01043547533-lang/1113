// 히어로 그림과 아이콘. 그림은 왼쪽에서 오른쪽으로 올라가는 계단(배우고 → 취득하고 → 다시 일하기)을
// 하늘색·풀색·해바라기색 기둥으로 그리고, 가운데에 실제 데이터로 만든 예시 화면 카드를 띄운다.

export const SIGNS = [
  { tab: "trainings", word: "배우고", label: "국비 교육", sub: "내일배움카드 과정", tone: "sky" },
  { tab: "exams", word: "취득하고", label: "자격증 시험", sub: "일정 · 응시료 · 시험장", tone: "leaf" },
  { tab: "jobs", word: "다시 일하기", label: "채용 · 알바", sub: "중장년 공고 · 현장면접", tone: "sun" },
];

const I = {
  arrow: <path d="M5 12h12m-5-5 5 5-5 5" />,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  cal: <><rect x="4" y="5.5" width="16" height="14" rx="3" /><path d="M4 10h16M9 3.5v4M15 3.5v4" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  book: <path d="M4 6.5c3-1.4 5.7-1.2 8 .6v12c-2.3-1.8-5-2-8-.6v-12Zm16 0c-3-1.4-5.7-1.2-8 .6v12c2.3-1.8 5-2 8-.6v-12Z" />,
  work: <><rect x="3.5" y="7.5" width="17" height="12" rx="2.5" /><path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7M3.5 12.5h17" /></>,
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

// 계단 기둥. 각 기둥은 위가 둥근 면(진한 색)과 몸통(옅은 색)으로 이루어진다. 오른쪽으로 갈수록 높아진다.
const PILLARS = [
  { x: 0, w: 15, h: 46, tone: "sky", cap: "diamond" },
  { x: 11, w: 13, h: 30, tone: "sun", cap: "oval" },
  { x: 20, w: 12, h: 54, tone: "leaf", cap: "dome" },
  { x: 30, w: 14, h: 26, tone: "sky", cap: "oval" },
  { x: 56, w: 14, h: 42, tone: "sun", cap: "oval" },
  { x: 66, w: 13, h: 70, tone: "leaf", cap: "dome" },
  { x: 77, w: 13, h: 56, tone: "sun", cap: "oval" },
  { x: 86, w: 14, h: 82, tone: "sky", cap: "diamond" },
];

export function HeroArt({ children }) {
  return (
    <div className="art">
      <div className="art-field" aria-hidden="true">
        {PILLARS.map((p, i) => (
          <span
            key={i}
            className={`pillar t-${p.tone} cap-${p.cap}`}
            style={{ "--x": `${p.x}%`, "--w": `${p.w}%`, "--h": `${p.h}%`, "--i": i }}
          />
        ))}
        <span className="grain" />
      </div>
      {children}
    </div>
  );
}

// 히어로 가운데 카드: 실제로 받은 데이터(2026-11-13, 대구·한식조리기능사)로 만든 예시
export function PreviewCard({ onOpen }) {
  return (
    <div className="preview">
      <span className="preview-back b2" aria-hidden="true" />
      <span className="preview-back b1" aria-hidden="true" />
      <button type="button" className="preview-card" onClick={onOpen} aria-label="예시 화면. 누르면 내 조건으로 찾기로 이동">
        <span className="pv-top">
          <span className="pv-app t-leaf"><Icon name="cal" size={22} /></span>
          <span className="pv-meta">
            <strong>자격증 시험</strong>
            <span>대구 · 2025년 540명 응시</span>
          </span>
          <span className="pv-tag">예시</span>
        </span>
        <span className="pv-title">한식조리기능사 실기 원서접수</span>
        <span className="pv-text">
          상시 시험이라 거의 매주 있어요. 응시료는 필기 14,500원, 실기 26,900원이고 대구에 상설 시험장이 25곳 있습니다.
        </span>
        <span className="pv-chips">
          <span className="pv-chip"><i className="d-leaf" />상시 시험</span>
          <span className="pv-chip"><Icon name="cal" size={15} />마감까지 2일</span>
        </span>
        <span className="pv-actions">
          <span className="pv-btn ok"><Icon name="check" size={16} />시험 일정</span>
          <span className="pv-btn"><Icon name="book" size={16} />국비 과정 <em>14</em></span>
          <span className="pv-btn"><Icon name="pin" size={16} />시험장 <em>25</em></span>
          <span className="pv-btn go">내 조건으로 보기 <Arrow size={16} /></span>
        </span>
      </button>
    </div>
  );
}
