import { useEffect, useRef, useState } from "react";
import { HeroSun, Horizon, Logo, Reflection, StripeDefs, StripeIcon } from "./art.jsx";
import { AlbaTab, ExamTab, JobsTab, TrainingTab } from "./sections.jsx";

const FALLBACK_SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const FALLBACK_PRESETS = ["조리·제과제빵", "운전·중장비", "전기·설비·시설관리", "건축·인테리어", "조경·농업·산림",
  "용접·기계·자동차", "미용", "요양·돌봄", "경비·청소", "사무·부동산·상담"];

const CLEANING_STEPS = [
  "6만 줄이 넘는 시험 접수 통계를 우리 지역 순위로 바꿨어요",
  "1년에 40번 넘게 있는 상시 시험은 남은 회차만 골라요",
  "방마다 따로 적힌 시험장을 건물 하나로 합쳤어요",
  "응시료 문장은 필기·실기 금액으로 나눠 보여드려요",
  "지난 채용행사는 빼고 가까운 날짜부터 보여드려요",
  "회차만 다른 같은 국비 과정은 하나로 합쳐요",
];

const FAQ = [
  ["정말 무료인가요?", "네, 무료입니다. 회원가입도 없고, 지역과 관심 분야만 고르면 바로 볼 수 있어요."],
  ["제 정보를 저장하나요?",
    "아니요. 이름·연락처 같은 개인정보는 받지 않아요. 고르신 지역과 분야도 검색할 때만 쓰고 저장하지 않아요."],
  ["자격증 순위는 어떻게 정했나요?",
    "한국산업인력공단이 공개한 거주지별 시험 접수자 수를 지역별로 더해서 정했어요. 나이별 통계는 공개되지 않아 전체 접수자 기준이에요."],
  ["‘상시 시험’은 무엇인가요?",
    "지게차·굴착기·조리·제과제빵·미용 같은 일부 기능사는 정해진 날이 아니라 거의 매주 시험이 있어요. 원하는 날짜를 골라 접수할 수 있어요."],
  ["국민내일배움카드는 누가 받을 수 있나요?",
    "대부분의 구직자와 재직자가 신청할 수 있지만 일부 예외가 있어요. 정확한 자격과 자부담 비율은 고용24에서 확인해 주세요."],
  ["채용공고는 어디에서 가져오나요?",
    "한국노인인력개발원이 공개한 중장년·노인 구인정보와 고용센터 채용행사는 직접 보여드려요. 그 밖의 일반 공고와 알바는 민간 사이트가 공개 데이터를 주지 않아서, 같은 조건으로 검색한 화면을 바로 열어 드려요."],
];

const TABS = [
  ["exams", "시험·자격증"],
  ["trainings", "국비 교육"],
  ["jobs", "취업"],
  ["alba", "알바"],
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function CyclingList({ items }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((a) => (a + 1) % items.length), 2200);
    return () => clearInterval(id);
  }, [items.length]);
  return (
    <ul className="cycle">
      {items.map((t, i) => (
        <li key={t} className={i === active ? "on" : i < active ? "done" : ""}>
          <span className="tick" aria-hidden="true">
            <svg viewBox="0 0 20 20"><path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

function FeatureRow({ title, items }) {
  return (
    <div className="feature" data-reveal>
      <h2 className="feature-title">{title}</h2>
      <div className="feature-items">
        {items.map(([icon, head, body]) => (
          <div key={head} className="feature-item">
            <StripeIcon name={icon} />
            <h3>{head}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  useReveal();

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m) => setMeta({ sido: m.sido, presets: m.presets }))
      .catch(() => {});
    if (init.sido && init.preset) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(e) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    const p = new URLSearchParams({ sido, preset });
    window.history.replaceState(null, "", "?" + p.toString());
    try {
      const r = await fetch("/api/hub?" + p.toString());
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setData(null);
      setError("정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  function goSearch(e) {
    e?.preventDefault();
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => searchRef.current?.querySelector("select")?.focus({ preventScroll: true }), 400);
  }

  function pickTab(k) {
    setTab(k);
    const p = new URLSearchParams(window.location.search);
    p.set("tab", k);
    window.history.replaceState(null, "", "?" + p.toString());
  }

  return (
    <>
      <StripeDefs />
      <a className="skip" href="#search">검색으로 바로 가기</a>

      <header className="nav">
        <div className="wrap nav-in">
          <a href="/" className="nav-logo" aria-label="50+ 재취업 길잡이 처음으로"><Logo /></a>
          <nav className="nav-links" aria-label="주요 메뉴">
            <a href="#how">이용 방법</a>
            <a href="#faq">자주 묻는 질문</a>
          </nav>
          <a href="#search" className="btn btn-primary btn-sm" onClick={goSearch}>바로 찾기</a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap">
            <p className="eyebrow">50세 이상을 위한 무료 재취업 정보</p>
            <h1 className="hero-title">
              <HeroSun className="hero-sun" />
              <span className="hero-line">배우고, 취득하고,</span>
              <span className="hero-line">다시 일하기.</span>
            </h1>
            <p className="hero-sub">
              사는 곳과 관심 분야만 고르세요.{" "}<br />
              자격증 시험, 국비 교육, 채용행사, 알바까지 한 화면에 모아 드려요.
            </p>
          </div>

          <div className="wrap">
            <form id="search" ref={searchRef} className="panel" onSubmit={search} aria-label="자격증·교육·일자리 찾기">
              <div className="panel-step">
                <label className="step-label" htmlFor="sido"><span className="num">1</span>어디에 사세요?</label>
                <div className="select">
                  <select id="sido" value={sido} onChange={(e) => setSido(e.target.value)}>
                    {meta.sido.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <fieldset className="panel-step">
                <legend className="step-label"><span className="num">2</span>어떤 일에 관심 있으세요?</legend>
                <div className="chips">
                  {meta.presets.map((p) => (
                    <button
                      type="button"
                      key={p}
                      className={"chip" + (preset === p ? " on" : "")}
                      aria-pressed={preset === p}
                      onClick={() => setPreset(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="panel-foot">
                <button className="btn btn-primary btn-lg" disabled={loading}>
                  {loading ? <><span className="spin" aria-hidden="true" />모으는 중이에요…</> : "한눈에 보기"}
                </button>
                <p className="panel-note">회원가입 없이 무료 · 개인정보를 저장하지 않아요</p>
              </div>
              {error && <p className="alert" role="alert">{error}</p>}
            </form>
          </div>

          <div ref={resultsRef} className="wrap results-wrap" aria-live="polite">
            {data && (
              <div className="results">
                <div className="tabs" role="tablist" aria-label="결과 종류">
                  {TABS.map(([k, label]) => {
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
              </div>
            )}
          </div>
        </section>

        <section className="band" aria-labelledby="band-title">
          <div className="band-in">
            <p className="eyebrow light">대신 정리해 드려요</p>
            <h2 id="band-title" className="band-title">
              흩어진 공공데이터를{" "}<br />읽기 쉽게 모았어요
            </h2>
            <CyclingList items={CLEANING_STEPS} />
          </div>
        </section>

        <section id="how" className="features wrap">
          <FeatureRow
            title={<>배우고, 취득하고,{" "}<br />일하기까지</>}
            items={[
              ["cert", "자격증 시험", "우리 지역에서 많이 따는 자격증, 다음 시험 날짜, 응시료, 가까운 시험장을 알려드려요."],
              ["book", "국비 교육", "국민내일배움카드로 배울 수 있는 과정을 개강이 가까운 순으로 보여드려요."],
              ["work", "취업·알바", "지금 접수 중인 중장년 채용공고와 고용센터 현장면접을 보여드리고, 알바 사이트 검색도 한 번에 열어 드려요."],
            ]}
          />
          <FeatureRow
            title={<>중장년을 먼저{" "}<br />생각했어요</>}
            items={[
              ["zoom", "큰 글씨, 쉬운 말", "작은 글씨와 어려운 용어를 빼고, 꼭 필요한 정보만 크게 보여드려요."],
              ["calendar", "다음 할 일 하나만", "‘필기 접수 마감까지 3일’처럼 지금 해야 할 일 하나를 먼저 보여드려요."],
              ["shield", "개인정보 저장 안 함", "로그인도, 연락처 입력도 없어요. 보고 바로 닫으셔도 돼요."],
            ]}
          />
        </section>

        <section id="faq" className="faq wrap" data-reveal>
          <h2 className="section-title">자주 묻는 질문</h2>
          <div className="faq-list">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}<span className="plus" aria-hidden="true" /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cta wrap" data-reveal>
          <StripeIcon name="cert" size={64} />
          <h2 className="cta-title">오늘, 다시 시작해 볼까요?</h2>
          <p className="cta-sub">우리 동네에서 배울 수 있는 것, 딸 수 있는 것, 일할 수 있는 곳을 지금 확인해 보세요.</p>
          <a href="#search" className="btn btn-primary btn-lg" onClick={goSearch}>내 지역 정보 보기</a>
        </section>
      </main>

      <footer className="foot">
        <Horizon />
        <div className="foot-blue">
          <Reflection />
          <div className="wrap foot-in">
            <Logo />
            <p>자료 출처: 한국산업인력공단 Q-Net OPEN-API(종목·시험일정·응시료·시험장·접수 통계), 고용24 OPEN-API(국민내일배움카드 훈련과정·채용행사), 한국노인인력개발원(노인 구인정보·노인일자리 수행기관, 공공데이터포털)</p>
            <p>시험·과정·행사의 최신 내용은 각 기관 페이지에서 꼭 확인해 주세요.</p>
            <p>이 서비스는 이름·연락처 등 개인정보를 수집하거나 저장하지 않습니다.</p>
            <p className="copy">© 2026 50+ 재취업 길잡이</p>
          </div>
        </div>
      </footer>
    </>
  );
}
