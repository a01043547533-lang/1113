// 이정표(도로 방향표지) 모양의 로고와 히어로 표지판.
// 표지판 세 장은 파랑(배우고)·초록(취득하고)·주황(다시 일하기). 하늘·해·잔디 장면 안에 세운다.

export const SIGNS = [
  { tab: "trainings", word: "배우고", label: "국비 교육", sub: "내일배움카드 과정", tone: "blue" },
  { tab: "exams", word: "취득하고", label: "자격증 시험", sub: "일정 · 응시료 · 시험장", tone: "green" },
  { tab: "jobs", word: "다시 일하기", label: "채용 · 알바", sub: "중장년 공고 · 현장면접", tone: "orange" },
];

export function Arrow({ dir = "right", size = 34 }) {
  const rot = { right: 0, down: 90, left: 180, up: -90 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false"
      style={{ transform: `rotate(${rot}deg)`, flex: "none" }}>
      <path d="M4 13h15V6l10 10-10 10v-7H4z" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-plate" aria-hidden="true">50+</span>
      <span className="logo-text">재취업 길잡이</span>
    </span>
  );
}

// 히어로 이정표. 판을 누르면 그 영역으로 간다.
export function Signpost({ onPick }) {
  return (
    <div className="scene">
    <div className="signpost">
      <span className="pole" aria-hidden="true" />
      {SIGNS.map((s, i) => (
        <button
          key={s.tab}
          type="button"
          className={`plate plate-${s.tone}`}
          style={{ "--i": i }}
          onClick={() => onPick(s.tab)}
        >
          <span className="plate-body">
            <span className="plate-word">{s.word}</span>
            <span className="plate-label">{s.label}</span>
            <span className="plate-sub">{s.sub}</span>
          </span>
          <Arrow />
        </button>
      ))}
    </div>
    </div>
  );
}
