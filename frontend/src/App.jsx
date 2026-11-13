import { useEffect, useRef, useState } from "react";
import { Arrow, HeroTiles, Icon, Logo, SIGNS } from "./art.jsx";
import Footer, { useStatus } from "./footer.jsx";
import { AlbaTab, ExamTab, JobsTab, TrainingTab } from "./sections.jsx";

const FALLBACK_SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const FALLBACK_PRESETS = ["조리·제과제빵", "운전·중장비", "전기·설비·시설관리", "건축·인테리어", "조경·농업·산림",
  "용접·기계·자동차", "미용", "요양·돌봄", "경비·청소", "사무·부동산·상담"];

// 관심 분야 카드: 아이콘과 대표 자격·일자리(실제 데이터에서 많이 나온 것)
const FIELDS = {
  "조리·제과제빵": ["cook", "한식조리기능사 · 제빵기능사 · 급식 조리원"],
  "운전·중장비": ["truck", "지게차 · 굴착기 · 승합차 운전원"],
  "전기·설비·시설관리": ["bolt", "전기기능사 · 위험물기능사 · 건물 관리원"],
  "건축·인테리어": ["home", "도배 · 실내건축 · 건축도장"],
  "조경·농업·산림": ["leaf", "조경기능사 · 산림기능사 · 화훼장식"],
  "용접·기계·자동차": ["wrench", "용접 · 자동차정비 · 생산직"],
  "미용": ["scissors", "미용사(일반) · 네일 · 피부"],
  "요양·돌봄": ["heart", "요양보호사 · 간병 · 아이돌봄"],
  "경비·청소": ["shield", "경비지도사 · 아파트 미화원 · 건물 청소"],
  "사무·부동산·상담": ["brief", "공인중개사 · 주택관리사보 · 직업상담사"],
};

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

// 어두운 띠의 세 줄. 오른쪽 작은 화면 조각은 실제 결과 화면에 나오는 내용 그대로.
const STEPS = [
  {
    tab: "trainings", step: "배우고", title: "내일배움카드로 들을 수 있는 과정부터",
    text: "3개월 안에 시작하는 국비 과정을 만족도와 개강일 순서로 보여 줍니다. 훈련비와 장소, 기간을 한 장에서 비교하세요.",
    ui: { head: "대구 · 국비 교육 31개", rows: [["book", "한식조리기능사 실기 (단기속성반)", "11월 16일 개강"], ["won", "훈련비 554,800원", "만족도 99점"], ["pin", "대구 달서구", "3주 · 주중"]] },
  },
  {
    tab: "exams", step: "취득하고", title: "우리 지역에서 많이 따는 자격증과 다음 시험",
    text: "지역별 응시자 순위를 보고, 누르면 다음 접수일까지 남은 날, 응시료, 가까운 상설 시험장이 바로 나옵니다.",
    ui: { head: "대구 · 조리·제과제빵 1위", rows: [["cert", "한식조리기능사", "540명 응시"], ["cal", "실기 원서접수", "마감까지 2일"], ["won", "응시료", "필기 14,500 · 실기 26,900원"]] },
  },
  {
    tab: "jobs", step: "다시 일하기", title: "지금 접수 중인 중장년 공고와 현장면접",
    text: "50세 이상 우대 공고를 위로 올려 보여 주고, 고용센터 현장면접 날짜와 장소, 알바 사이트 검색까지 한 번에 엽니다.",
    ui: { head: "부산 · 경비·청소 17건", rows: [["work", "병원건물 청소원 · 연산역", "50세 이상 우대"], ["work", "더샵신문그리니티 미화원", "마감까지 5일"], ["work", "서면아이파크 커뮤니티 미화원", "마감까지 19일"]] },
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

  function pickField(p) {
    setPreset(p);
    toSearch();
  }

  const goal = SIGNS.find((s) => s.tab === tab) || SIGNS[2];

  return (
    <>
      <a className="skip" href="#search">조건 고르기로 바로 가기</a>

      <header className="nav">
        <div className="wrap nav-in">
          <a href="/" className="nav-logo" aria-label="50+ 재취업 길잡이 처음 화면"><Logo /></a>
          <nav className="nav-links" aria-label="주요 메뉴">
            <button type="button" onClick={() => openArea("trainings")}>국비 교육</button>
            <button type="button" onClick={() => openArea("exams")}>자격증 시험</button>
            <button type="button" onClick={() => openArea("jobs")}>채용 · 알바</button>
            <a href="#faq">자주 묻는 질문</a>
          </nav>
          <button type="button" className="btn-x dark sm" onClick={toSearch}>바로 찾기</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-copy">
            <h1 className="hero-title">배우고, 취득하고, 다시 일하기</h1>
            <p className="hero-sub">
              사는 곳과 관심 분야만 고르면 국비 교육 과정, 자격증 시험 일정, 지금 접수 중인 중장년 채용공고를 한 화면에서 볼 수 있습니다.
            </p>
            <div className="hero-cta">
              <button type="button" className="btn-x dark lg" onClick={toSearch}>내 조건으로 찾기</button>
              <button type="button" className="btn-x line lg" onClick={() => openArea("exams")}>자격증 순위 보기</button>
            </div>
          </div>
          <HeroTiles onOpen={openArea} />
          <p className="wrap tiles-cap">대구 · 조리·제과제빵으로 찾은 예시와 전국 공고 수입니다. 카드를 누르면 그 내용부터 열립니다.</p>
        </section>

        <section className="finder" id="search" ref={searchRef} aria-labelledby="finder-title">
          <div className="wrap finder-in">
            <div className="finder-intro">
              <p className="kicker">2단계면 끝</p>
              <h2 id="finder-title">내 조건으로 찾기</h2>
              <p>사는 곳과 관심 분야를 고르고 ‘결과 보기’를 누르세요. 회원가입도, 개인정보 입력도 없습니다.</p>
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
                <button className="btn-x dark lg" disabled={loading}>
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

        <section className="band" id="three" aria-labelledby="band-title">
          <span className="band-curve" aria-hidden="true" />
          <div className="wrap">
            <h2 id="band-title" className="band-title">한 번 고르면 세 가지를 같이 봅니다</h2>
            <div className="steps">
              {STEPS.map((s, i) => (
                <article key={s.tab} className={"step-row" + (i % 2 ? " flip" : "")}>
                  <div className="step-copy">
                    <p className="kicker mint">{s.step}</p>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    <button type="button" className="btn-x mint" onClick={() => openArea(s.tab)}>
                      {SIGNS.find((g) => g.tab === s.tab).label} 열기 <Arrow size={18} />
                    </button>
                  </div>
                  <div className="step-visual" aria-hidden="true">
                    <span className="frame-bar" />
                    <div className="mock">
                      <p className="mock-head"><i className="d-sky" />{s.ui.head}</p>
                      {s.ui.rows.map(([icon, a, b]) => (
                        <div key={a} className="mock-row">
                          <span className="mock-icon"><Icon name={icon} size={18} /></span>
                          <span className="mock-a">{a}</span>
                          <span className="mock-b">{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fields" aria-labelledby="fields-title">
          <div className="wrap fields-in">
            <div className="fields-intro">
              <h2 id="fields-title">어떤 일을 찾으세요?</h2>
              <p>분야를 누르면 그 분야로 골라 둔 채 조건 고르기로 이동합니다.</p>
              <button type="button" className="btn-x dark" onClick={toSearch}>내 조건으로 찾기</button>
            </div>
            <div className="field-grid">
              {meta.presets.map((p) => {
                const [icon, ex] = FIELDS[p] || ["work", ""];
                return (
                  <button key={p} type="button" className={"field-card" + (preset === p ? " on" : "")} onClick={() => pickField(p)}>
                    <span className="fc-icon"><Icon name={icon} size={20} /></span>
                    <span className="fc-name">{p}</span>
                    <span className="fc-ex">{ex}</span>
                  </button>
                );
              })}
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

        <section className="cta" aria-labelledby="cta-title">
          <div className="wrap cta-in">
            <h2 id="cta-title">우리 동네에서 배우고, 취득하고,<br />다시 일할 곳을 찾아보세요</h2>
            <div className="cta-btns">
              <button type="button" className="btn-x mint lg" onClick={toSearch}>내 조건으로 찾기</button>
              <a className="btn-x ghost lg" href="#faq">자주 묻는 질문</a>
            </div>
          </div>
        </section>
      </main>

      <Footer onSearch={toSearch} onArea={openArea} statusApi={statusApi} />
    </>
  );
}
