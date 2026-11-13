import { useEffect, useRef, useState } from "react";
import { Arrow, Logo, SIGNS, Signpost } from "./art.jsx";
import { AlbaTab, ExamTab, JobsTab, TrainingTab } from "./sections.jsx";

const FALLBACK_SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const FALLBACK_PRESETS = ["조리·제과제빵", "운전·중장비", "전기·설비·시설관리", "건축·인테리어", "조경·농업·산림",
  "용접·기계·자동차", "미용", "요양·돌봄", "경비·청소", "사무·부동산·상담"];

const FAQ = [
  ["무료인가요?", "네. 회원가입 없이 무료로 씁니다."],
  ["제 정보를 저장하나요?", "아니요. 이름이나 연락처를 묻지 않고, 고른 지역과 분야도 저장하지 않습니다."],
  ["자격증 순위는 무엇으로 정하나요?",
    "한국산업인력공단이 공개한 지역별 시험 접수자 수(2025년 기능사)로 정합니다. 나이별 숫자는 공개되지 않아 전체 접수자로 셉니다."],
  ["상시 시험이 뭔가요?",
    "지게차, 굴착기, 조리, 제과제빵, 미용 같은 일부 기능사는 거의 매주 시험이 있어서 원하는 날을 골라 접수할 수 있습니다."],
  ["내일배움카드는 누가 받나요?",
    "구직자와 재직자 대부분이 신청할 수 있고 예외가 조금 있습니다. 자격과 본인 부담금은 고용24에서 확인하세요."],
  ["채용공고는 어디서 오나요?",
    "한국노인인력개발원의 중장년·노인 구인정보와 고용센터 채용행사입니다. 알바와 그 밖의 공고는 각 사이트에서 같은 조건으로 검색한 화면을 열어 줍니다."],
];

// 이정표 순서(배우고 → 취득하고 → 다시 일하기)와 같은 순서, 같은 색
const TABS = [
  ["trainings", "국비 교육", "blue"],
  ["exams", "자격증 시험", "green"],
  ["jobs", "취업", "orange"],
  ["alba", "알바", "orange"],
];

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  return { sido: q.get("sido") || "", preset: q.get("preset") || "", tab: q.get("tab") || "" };
}

function tabCount(key, data) {
  if (key === "exams") return (data.exams.ranking?.length || 0) + (data.exams.featured?.length || 0) + (data.exams.external?.length || 0);
  if (key === "trainings") return data.trainings.count;
  if (key === "jobs") return (data.senior_jobs?.count || 0) + (data.events.items?.length || 0);
  return null;
}

export default function App() {
  const init = readUrl();
  const [meta, setMeta] = useState({ sido: FALLBACK_SIDO, presets: FALLBACK_PRESETS });
  const [sido, setSido] = useState(init.sido || "서울");
  const [preset, setPreset] = useState(init.preset || FALLBACK_PRESETS[0]);
  const [tab, setTab] = useState(TABS.some(([k]) => k === init.tab) ? init.tab : "exams");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resultsRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m) => setMeta({ sido: m.sido, presets: m.presets }))
      .catch(() => {});
    if (init.sido && init.preset) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncUrl(extra = {}) {
    const p = new URLSearchParams({ sido, preset, tab, ...extra });
    window.history.replaceState(null, "", "?" + p.toString());
  }

  async function search(e) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    syncUrl();
    try {
      const r = await fetch("/api/hub?" + new URLSearchParams({ sido, preset }).toString());
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setData(null);
      setError("정보를 불러오지 못했습니다. 잠시 뒤에 다시 눌러 주세요.");
    } finally {
      setLoading(false);
    }
  }

  function toSearch() {
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => document.getElementById("sido")?.focus({ preventScroll: true }), 450);
  }

  function pickTab(k) {
    setTab(k);
    syncUrl({ tab: k });
  }

  // 이정표를 누르면: 결과가 있으면 그 탭으로, 없으면 조건 고르는 곳으로
  function pickSign(k) {
    pickTab(k);
    if (data) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else toSearch();
  }

  const signFor = (k) => SIGNS.find((s) => s.tab === k);

  return (
    <>
      <a className="skip" href="#search">조건 고르기로 바로 가기</a>

      <header className="nav">
        <div className="wrap nav-in">
          <a href="/" className="nav-logo" aria-label="50+ 재취업 길잡이 처음 화면"><Logo /></a>
          <nav className="nav-links" aria-label="주요 메뉴">
            <a href="#faq">자주 묻는 질문</a>
          </nav>
          <button type="button" className="btn btn-primary btn-sm" onClick={toSearch}>바로 찾기</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-in">
            <div className="hero-copy">
              <h1 className="hero-title">
                <span>배우고,</span>
                <span>취득하고,</span>
                <span className="hl">다시 일하기</span>
              </h1>
              <p className="hero-sub">
                사는 곳과 관심 분야를 고르면 국비 교육, 자격증 시험, 채용공고를 한 화면에서 볼 수 있어요.
              </p>
              <ul className="facts" aria-label="이용 안내">
                <li>무료</li>
                <li>회원가입 없음</li>
                <li>개인정보 저장 안 함</li>
              </ul>
            </div>
            <div className="hero-sign">
              <Signpost onPick={pickSign} />
              <p className="sign-cap">표지판을 누르면 그 내용부터 보여 줍니다.</p>
            </div>
          </div>
        </section>

        <section className="finder" id="search" ref={searchRef} aria-labelledby="finder-title">
          <div className="wrap">
            <form className="board" onSubmit={search}>
              <div className="board-head">
                <h2 id="finder-title">내 조건으로 찾기</h2>
                {signFor(tab) && (
                  <p className="board-goal">
                    <span className={`dot dot-${signFor(tab).tone}`} aria-hidden="true" />
                    {signFor(tab).label}부터 보여 줍니다
                  </p>
                )}
              </div>

              <div className="board-grid">
                <div className="field">
                  <label className="field-label" htmlFor="sido"><span className="step">1</span>사는 곳</label>
                  <div className="select">
                    <select id="sido" value={sido} onChange={(e) => setSido(e.target.value)}>
                      {meta.sido.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <fieldset className="field">
                  <legend className="field-label"><span className="step">2</span>관심 분야</legend>
                  <div className="chips">
                    {meta.presets.map((p) => (
                      <button
                        type="button"
                        key={p}
                        id={`preset-${p}`}
                        className={"chip" + (preset === p ? " on" : "")}
                        aria-pressed={preset === p}
                        onClick={() => setPreset(p)}
                      >
                        {preset === p && (
                          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                            <path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {p}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="board-foot">
                <button className="btn btn-primary btn-lg" disabled={loading}>
                  {loading ? <><span className="spin" aria-hidden="true" />찾는 중…</> : <>결과 보기 <Arrow size={26} /></>}
                </button>
              </div>
              {error && <p className="alert" role="alert">{error}</p>}
            </form>
          </div>
        </section>

        <div ref={resultsRef} className="results-anchor" aria-live="polite">
          {data && (
            <section className="results wrap" aria-label="찾은 결과">
              <div className="results-head">
                <p className="results-q">
                  <strong>{data.query.sido}</strong>
                  <span aria-hidden="true">·</span>
                  <strong>{data.query.preset}</strong>
                </p>
                <button type="button" className="link-btn" onClick={toSearch}>조건 바꾸기</button>
              </div>
              <div className="tabs" role="tablist" aria-label="결과 종류">
                {TABS.map(([k, label, tone]) => {
                  const c = tabCount(k, data);
                  return (
                    <button
                      key={k}
                      role="tab"
                      type="button"
                      aria-selected={tab === k}
                      className={`tab tab-${tone}` + (tab === k ? " on" : "")}
                      onClick={() => pickTab(k)}
                    >
                      {label}
                      {c != null && <span className="tab-count">{c}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="tab-panel" role="tabpanel">
                {tab === "exams" && <ExamTab data={data.exams} sido={data.query.sido} preset={data.query.preset} />}
                {tab === "trainings" && <TrainingTab data={data.trainings} sido={data.query.sido} />}
                {tab === "jobs" && <JobsTab senior={data.senior_jobs} agencies={data.agencies} events={data.events} links={data.links} sido={data.query.sido} />}
                {tab === "alba" && <AlbaTab links={data.links} sido={data.query.sido} />}
              </div>
            </section>
          )}
        </div>

        <section id="faq" className="faq" aria-labelledby="faq-title">
          <div className="wrap faq-in">
            <h2 id="faq-title" className="faq-title">자주 묻는 질문</h2>
            <div className="faq-list">
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}<span className="plus" aria-hidden="true" /></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <Logo />
          <dl className="foot-src">
            <div><dt>자격증 시험</dt><dd>한국산업인력공단 Q-Net</dd></div>
            <div><dt>국비 교육 · 채용행사</dt><dd>고용24</dd></div>
            <div><dt>중장년 채용공고</dt><dd>한국노인인력개발원</dd></div>
          </dl>
          <p>시험·과정·공고의 최신 내용은 각 기관 페이지에서 확인하세요. 이 사이트는 개인정보를 모으거나 저장하지 않습니다.</p>
          <p className="copy">© 2026 50+ 재취업 길잡이</p>
        </div>
      </footer>
    </>
  );
}
