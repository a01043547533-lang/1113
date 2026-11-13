import { useEffect, useRef, useState } from "react";
import { HeroSun, Horizon, Logo, Reflection, StripeDefs, StripeIcon } from "./art.jsx";
import Results from "./results.jsx";

const FALLBACK_SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const FALLBACK_PRESETS = ["요양보호사", "간호조무사", "사회복지", "경비·보안", "청소·미화", "조리·주방",
  "바리스타·제과", "운전·배송", "사무보조", "회계·세무", "생산·제조", "전기·설비", "공인중개",
  "IT·사무자동화", "돌봄·보육"];

const CLEANING_STEPS = [
  "시급·일급·연봉을 모두 월급으로 바꿔 보여드려요",
  "마감된 공고는 미리 빼 드려요",
  "여러 지역에 올라온 같은 공고는 하나로 합쳐요",
  "이미 시작한 훈련과정은 목록에서 뺐어요",
  "회차만 다른 같은 과정은 가장 빠른 회차만 남겨요",
  "중장년에게 맞는 공고부터 위에 보여드려요",
];

const FAQ = [
  ["정말 무료인가요?", "네, 무료입니다. 회원가입도 없고, 지역과 직종만 고르면 바로 볼 수 있어요."],
  ["제 정보를 저장하나요?",
    "아니요. 이름·연락처 같은 개인정보는 받지 않아요. 고르신 지역과 직종도 검색할 때만 쓰고 저장하지 않아요."],
  ["‘적합도’ 점수는 무엇인가요?",
    "공고 제목에 ‘중장년 우대’, ‘연령무관’ 같은 말이 있는지, 경력·학력 조건이 까다롭지 않은지를 보고 매긴 참고 점수예요. 채용 공고에는 나이 조건을 적을 수 없어서, 이런 신호로 50대 이상에게 맞을 만한 공고를 위로 올려 드려요."],
  ["국민내일배움카드는 누가 받을 수 있나요?",
    "대부분의 구직자와 재직자가 신청할 수 있지만 일부 예외가 있어요. 정확한 자격과 자부담 비율은 고용24에서 확인해 주세요."],
  ["공고 내용이 실제와 달라요.",
    "공고와 과정 정보는 고용24에서 가져와요. 지원하거나 등록하기 전에 ‘자세히 보기’를 눌러 원래 페이지에서 꼭 확인해 주세요."],
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
  return { sido: q.get("sido") || "", preset: q.get("preset") || "", keyword: q.get("keyword") || "" };
}

export default function App() {
  const init = readUrl();
  const [meta, setMeta] = useState({ sido: FALLBACK_SIDO, presets: FALLBACK_PRESETS });
  const [sido, setSido] = useState(init.sido || "서울");
  const [preset, setPreset] = useState(init.keyword ? "" : init.preset || "요양보호사");
  const [custom, setCustom] = useState(!!init.keyword && !init.preset);
  const [keyword, setKeyword] = useState(init.keyword);
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
    if (init.sido && (init.preset || init.keyword)) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(e) {
    e?.preventDefault();
    const kw = keyword.trim();
    if (custom && !kw) {
      setError("찾고 싶은 일을 입력해 주세요. 예: 급식, 주차관리");
      return;
    }
    setLoading(true);
    setError("");
    const p = new URLSearchParams({ sido });
    if (custom) p.set("keyword", kw);
    else p.set("preset", preset);
    window.history.replaceState(null, "", "?" + p.toString());
    try {
      const r = await fetch("/api/match?" + p.toString());
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
        {/* ---------------------------------------------------------- 히어로 */}
        <section className="hero">
          <div className="wrap">
            <p className="eyebrow">50세 이상을 위한 무료 재취업 정보</p>
            <h1 className="hero-title">
              <HeroSun className="hero-sun" />
              <span className="hero-line">일자리와 국비교육,</span>
              <span className="hero-line">한 번에.</span>
            </h1>
            <p className="hero-sub">
              사는 곳과 하고 싶은 일만 고르세요.{" "}<br />
              채용공고와 국비 훈련과정을 한 화면에 모아 드려요.
            </p>
          </div>

          {/* 검색 패널 = 서비스 화면 */}
          <div className="wrap">
            <form id="search" ref={searchRef} className="panel" onSubmit={search} aria-label="일자리와 교육 찾기">
              <div className="panel-step">
                <label className="step-label" htmlFor="sido"><span className="num">1</span>어디에 사세요?</label>
                <div className="select">
                  <select id="sido" value={sido} onChange={(e) => setSido(e.target.value)}>
                    {meta.sido.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <fieldset className="panel-step">
                <legend className="step-label"><span className="num">2</span>어떤 일을 찾으세요?</legend>
                <div className="chips">
                  {meta.presets.map((p) => (
                    <button
                      type="button"
                      key={p}
                      className={"chip" + (!custom && preset === p ? " on" : "")}
                      aria-pressed={!custom && preset === p}
                      onClick={() => { setPreset(p); setCustom(false); }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={"chip chip-outline" + (custom ? " on" : "")}
                    aria-pressed={custom}
                    onClick={() => setCustom(true)}
                  >
                    직접 입력
                  </button>
                </div>
                {custom && (
                  <input
                    className="text"
                    autoFocus
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="예: 급식, 주차관리, 택배"
                    aria-label="찾고 싶은 일"
                  />
                )}
              </fieldset>

              <div className="panel-foot">
                <button className="btn btn-primary btn-lg" disabled={loading}>
                  {loading ? <><span className="spin" aria-hidden="true" />찾는 중이에요…</> : "일자리·교육 찾기"}
                </button>
                <p className="panel-note">회원가입 없이 무료 · 개인정보를 저장하지 않아요</p>
              </div>
              {error && <p className="alert" role="alert">{error}</p>}
            </form>
          </div>

          <div ref={resultsRef} className="wrap results-wrap" aria-live="polite">
            {data && <Results data={data} />}
          </div>
        </section>

        {/* ---------------------------------------------------------- 파란 띠 */}
        <section className="band" aria-labelledby="band-title">
          <div className="band-in">
            <p className="eyebrow light">대신 정리해 드려요</p>
            <h2 id="band-title" className="band-title">
              복잡한 공고, 읽기 쉽게{" "}<br />바꿔서 보여드려요
            </h2>
            <CyclingList items={CLEANING_STEPS} />
          </div>
        </section>

        {/* ---------------------------------------------------------- 기능 */}
        <section id="how" className="features wrap">
          <FeatureRow
            title={<>세 번만 누르면{" "}<br />끝나요</>}
            items={[
              ["pin", "지역 고르기", "지금 사는 시·도를 고르세요."],
              ["work", "하고 싶은 일 고르기", "요양보호사, 경비, 조리, 사무보조 등 15가지 중에서 고르거나 직접 적어요."],
              ["list", "한 화면에서 비교", "왼쪽엔 채용공고, 오른쪽엔 배울 수 있는 국비과정이 나와요."],
            ]}
          />
          <FeatureRow
            title={<>중장년을 먼저{" "}<br />생각했어요</>}
            items={[
              ["zoom", "큰 글씨, 쉬운 말", "작은 글씨와 어려운 용어를 빼고, 꼭 필요한 정보만 크게 보여드려요."],
              ["gauge", "적합도 점수", "‘중장년 우대’, ‘경력무관’ 같은 조건을 살펴 맞을 만한 공고부터 보여드려요."],
              ["shield", "개인정보 저장 안 함", "로그인도, 연락처 입력도 없어요. 보고 바로 닫으셔도 돼요."],
            ]}
          />
        </section>

        {/* ---------------------------------------------------------- FAQ */}
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

        {/* ---------------------------------------------------------- CTA */}
        <section className="cta wrap" data-reveal>
          <StripeIcon name="work" size={64} />
          <h2 className="cta-title">오늘, 다시 시작해 볼까요?</h2>
          <p className="cta-sub">우리 동네 일자리와 배울 수 있는 과정을 지금 바로 확인해 보세요.</p>
          <a href="#search" className="btn btn-primary btn-lg" onClick={goSearch}>내 지역 일자리 찾기</a>
        </section>
      </main>

      <footer className="foot">
        <Horizon />
        <div className="foot-blue">
          <Reflection />
          <div className="wrap foot-in">
            <Logo />
            <p>자료 출처: 고용24 채용정보 · 국민내일배움카드 훈련과정 OPEN-API</p>
            <p>공고와 과정의 최신 내용은 각 상세 페이지에서 꼭 확인해 주세요.</p>
            <p>이 서비스는 이름·연락처 등 개인정보를 수집하거나 저장하지 않습니다.</p>
            <p className="copy">© 2026 50+ 재취업 길잡이</p>
          </div>
        </div>
      </footer>
    </>
  );
}
