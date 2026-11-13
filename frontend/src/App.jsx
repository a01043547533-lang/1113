import { useEffect, useRef, useState } from "react";
import { Arrow, HeroArt, Icon, Logo, PreviewCard, SIGNS } from "./art.jsx";
import Footer, { useStatus } from "./footer.jsx";
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

const TABS = [
  ["trainings", "국비 교육", "sky"],
  ["exams", "자격증 시험", "leaf"],
  ["jobs", "취업", "sun"],
  ["alba", "알바", "sun"],
];

// 아래 '세 가지' 카드: 각 카드 안의 작은 화면 조각은 실제 결과 화면에 나오는 모양 그대로
const THREE = [
  {
    tab: "trainings", tone: "sky", step: "배우고", title: "국비 교육",
    text: "3개월 안에 시작하는 내일배움카드 과정을 개강이 가까운 순으로 봅니다.",
    chips: [["book", "한식조리기능사 실기 · 11월 16일 개강"], ["won", "훈련비 554,800원"]],
  },
  {
    tab: "exams", tone: "leaf", step: "취득하고", title: "자격증 시험",
    text: "우리 지역에서 많이 응시한 자격증과 다음 시험 날짜, 응시료, 시험장을 봅니다.",
    chips: [["cal", "실기 원서접수 · 마감까지 2일"], ["pin", "대구 상설 시험장 25곳"]],
  },
  {
    tab: "jobs", tone: "sun", step: "다시 일하기", title: "채용 · 알바",
    text: "지금 접수 중인 중장년 공고와 고용센터 현장면접, 알바 사이트 검색을 한 곳에서 엽니다.",
    chips: [["work", "아파트 미화원 · 50세 이상 우대"], ["cal", "현장면접 · 11월 26일 14:00"]],
  },
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
  const statusApi = useStatus();

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
      statusApi.refresh();   // 방금 받은 자료의 갱신 시각 반영
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

  function openArea(k) {
    pickTab(k);
    if (data) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else toSearch();
  }

  const goal = SIGNS.find((s) => s.tab === tab) || SIGNS.find((s) => s.tab === "jobs");

  return (
    <>
      <a className="skip" href="#search">조건 고르기로 바로 가기</a>

      <header className="nav">
        <div className="wrap nav-in">
          <a href="/" className="nav-logo" aria-label="50+ 재취업 길잡이 처음 화면"><Logo /></a>
          <nav className="nav-links" aria-label="주요 메뉴">
            <a href="#three">무엇을 볼 수 있나요</a>
            <a href="#faq">자주 묻는 질문</a>
          </nav>
          <button type="button" className="pill-btn dark sm" onClick={toSearch}>바로 찾기</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-copy">
            <h1 className="hero-title">배우고, 취득하고,<br />다시 일하기.</h1>
            <p className="hero-sub">
              사는 곳과 관심 분야를 고르면 국비 교육, 자격증 시험, 중장년 채용공고를 한 화면에서 볼 수 있어요.
            </p>
            <div className="hero-cta">
              <button type="button" className="pill-btn dark lg" onClick={toSearch}>내 조건으로 찾기 <Arrow size={20} /></button>
              <span className="hero-note">무료 · 회원가입 없음 · 개인정보 저장 안 함</span>
            </div>
          </div>
          <div className="wrap">
            <HeroArt>
              <PreviewCard onOpen={() => openArea("exams")} />
            </HeroArt>
          </div>
        </section>

        <section className="finder" id="search" ref={searchRef} aria-labelledby="finder-title">
          <div className="wrap">
            <div className="section-head">
              <h2 id="finder-title">내 조건으로 찾기</h2>
              <p>두 가지만 고르면 됩니다.</p>
            </div>
            <form className="board" onSubmit={search}>
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
                      {preset === p && <Icon name="check" size={17} />}
                      {p}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="board-foot">
                <button className="pill-btn dark lg" disabled={loading}>
                  {loading ? <><span className="spin" aria-hidden="true" />찾는 중…</> : <>결과 보기 <Arrow size={20} /></>}
                </button>
                <span className="board-goal"><i className={`d-${goal.tone}`} aria-hidden="true" />{goal.label}부터 보여 줍니다</span>
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
                      className={"tab" + (tab === k ? " on" : "")}
                      onClick={() => pickTab(k)}
                    >
                      <i className={`d-${tone}`} aria-hidden="true" />
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

        <section className="three" id="three" aria-labelledby="three-title">
          <div className="wrap">
            <div className="section-head">
              <h2 id="three-title">한 번 고르면 세 가지를 같이 봅니다</h2>
              <p>카드를 누르면 그 내용부터 열립니다.</p>
            </div>
            <div className="three-grid">
              {THREE.map((c) => (
                <button key={c.tab} type="button" className={`three-card t-${c.tone}`} onClick={() => openArea(c.tab)}>
                  <span className="three-step"><i className={`d-${c.tone}`} />{c.step}</span>
                  <span className="three-title">{c.title}</span>
                  <span className="three-text">{c.text}</span>
                  <span className="three-ui" aria-hidden="true">
                    {c.chips.map(([icon, t]) => (
                      <span key={t} className="ui-chip"><Icon name={icon} size={16} />{t}</span>
                    ))}
                  </span>
                  <span className="three-go">열기 <Arrow size={18} /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

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

      <Footer onSearch={toSearch} onArea={openArea} statusApi={statusApi} />
    </>
  );
}
