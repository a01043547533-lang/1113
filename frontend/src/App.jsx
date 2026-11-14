import { useEffect, useRef, useState } from "react";
import { Arrow, HeroTiles, Icon, Logo, SIGNS, agoText } from "./art.jsx";
import Footer, { useStatus } from "./footer.jsx";
import { AlbaTab, ExamTab, JobsTab, LinkGrid, TrainingTab } from "./sections.jsx";

// 신청·접수 바로 가기. 주소는 2026-11-14에 직접 열어 확인했다(각 기관이 주소를 바꾸면 여기만 고친다).
// - 고용24 발급안내 페이지 안에 '발급신청' 버튼이 있다. 훈련 통합검색 = '훈련 찾기·신청' 메뉴.
// - Q-Net 원서접수 신청(rcv202)은 로그인 화면으로 먼저 열리고, 로그인하면 접수 화면으로 이어진다.
// - 국시원은 메뉴를 스크립트로 그려 요양보호사 접수 화면 주소를 확인하지 못해 첫 화면으로 보낸다.
const APPLY = [
  {
    title: "국비 교육 신청",
    steps: ["내일배움카드가 없으면 먼저 발급 신청", "카드가 나오면 과정을 골라 수강 신청"],
    links: [
      { site: "내일배움카드 발급 신청", icon: "work24", note: "고용24 · 발급 안내와 신청",
        url: "https://www.work24.go.kr/hr/h/a/1100/selectIssuGudn.do" },
      { site: "훈련 과정 찾기·신청", icon: "work24", note: "고용24 · 지역·분야로 찾아 신청",
        url: "https://www.work24.go.kr/hr/a/a/1100/trnnCrsInf.do" },
    ],
    phone: ["1350", "고용노동부 고객상담센터"],
  },
  {
    title: "자격증 시험 접수",
    steps: ["Q-Net에 로그인하고 원서접수 신청", "종목·시험장을 고르고 응시료 결제"],
    links: [
      { site: "원서접수 신청", icon: "qnet", note: "Q-Net · 로그인 후 접수",
        url: "https://www.q-net.or.kr/rcv202.do?id=rcv20210&gSite=Q&gId=" },
      { site: "이번 달 시험 일정", icon: "qnet", note: "Q-Net · 월간 시험일정",
        url: "https://www.q-net.or.kr/crf021.do?id=crf02103&gSite=Q&gId=&CST_ID=CRF_Stns_06" },
      { site: "요양보호사 시험", icon: "kuksiwon", note: "국시원 · 첫 화면으로 이동",
        url: "https://www.kuksiwon.or.kr/index.do" },
    ],
    phone: ["1644-8000", "한국산업인력공단 고객센터"],
  },
];

const FALLBACK_SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const FALLBACK_PRESETS = ["조리·제과제빵", "운전·중장비", "전기·설비·시설관리", "건축·인테리어", "조경·농업·산림",
  "용접·기계·자동차", "미용", "요양·돌봄", "경비·청소", "사무·부동산·상담"];

// 관심 분야 카드: 아이콘과 대표 자격·일자리(실제 데이터에서 많이 나온 것)
// 관심 분야 예시. 조건 고르기에서 고른 분야 아래에 보여 준다(예전 '어떤 일을 찾으세요?' 카드에 있던 내용).
const FIELD_EX = {
  "조리·제과제빵": "한식조리기능사 · 제빵기능사 · 급식 조리원",
  "운전·중장비": "지게차 · 굴착기 · 승합차 운전원",
  "전기·설비·시설관리": "전기기능사 · 위험물기능사 · 건물 관리원",
  "건축·인테리어": "도배 · 실내건축 · 건축도장",
  "조경·농업·산림": "조경기능사 · 산림기능사 · 화훼장식",
  "용접·기계·자동차": "용접 · 자동차정비 · 생산직",
  "미용": "미용사(일반) · 네일 · 피부",
  "요양·돌봄": "요양보호사 · 간병 · 아이돌봄",
  "경비·청소": "경비지도사 · 아파트 미화원 · 건물 청소",
  "사무·부동산·상담": "공인중개사 · 주택관리사보 · 직업상담사",
};

const FAQ = [
  ["무료인가요?", "네. 회원가입 없이 무료로 씁니다."],
  ["제 정보를 저장하나요?", "아니요. 이름이나 연락처를 묻지 않고, 고른 지역과 분야도 저장하지 않습니다."],
  ["관련 자격증은 어떤 순서로 나오나요?",
    "고른 분야의 자격증을 한국산업인력공단이 공개한 2025년 전국 기능사 접수자 수가 많은 순서로 보여 줍니다. 고른 지역의 접수자 수도 함께 나옵니다. ‘50·60대 인기’ 표시는 공단이 발표한 50대·60대 응시 순위에 든 자격증입니다."],
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
    tab: "exams", step: "취득하고", title: "고른 분야의 관련 자격증과 다음 시험",
    text: "고른 분야에서 많이 응시하는 자격증을 보고, 누르면 다음 접수일까지 남은 날, 응시료, 가까운 상설 시험장이 바로 나옵니다.",
    ui: { head: "대구 · 조리·제과제빵 관련 자격증", rows: [["cert", "한식조리기능사", "전국 11,001명 응시"], ["cal", "실기 원서접수", "마감까지 2일"], ["won", "응시료", "필기 14,500 · 실기 26,900원"]] },
  },
  {
    tab: "jobs", step: "다시 일하기", title: "지금 접수 중인 중장년 공고와 현장면접",
    text: "50세 이상 우대 공고를 위로 올려 보여 주고, 고용센터 현장면접 날짜와 장소, 알바 사이트 검색까지 한 번에 엽니다.",
    ui: { head: "부산 · 경비·청소 17건", rows: [["work", "병원건물 청소원 · 연산역", "50세 이상 우대"], ["work", "더샵신문그리니티 미화원", "마감까지 5일"], ["work", "서면아이파크 커뮤니티 미화원", "마감까지 19일"]] },
  },
];

// 예전에 쓰던 분야 이름(블로그에 이미 걸린 링크)을 새 이름으로
const PRESET_ALIASES = { "경비·보안": "경비·청소" };

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  let sido = q.get("sido") || "";
  let preset = q.get("preset") || "";
  preset = PRESET_ALIASES[preset] || preset;
  if (sido && !FALLBACK_SIDO.includes(sido)) sido = "";
  if (preset && !FALLBACK_PRESETS.includes(preset)) preset = "";
  return { sido, preset, tab: q.get("tab") || "" };
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
  const [pending, setPending] = useState("");   // 찾는 중 표시를 띄울 버튼
  const [menuOpen, setMenuOpen] = useState(false);   // 휴대폰 메뉴
  // 메뉴를 닫은 '뒤에' 이동한다. 같이 하면 펼친 메뉴 높이만큼 덜 내려간 자리를 계산해, 메뉴가 사라질 때 그만큼 지나친다.
  const menuGo = (fn) => {
    setMenuOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(fn));
  };
  const [error, setError] = useState("");
  const resultsRef = useRef(null);
  const searchRef = useRef(null);
  const statusApi = useStatus();
  const [hl, setHl] = useState(null);
  const [hlLoading, setHlLoading] = useState(true);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m) => setMeta({ sido: m.sido, presets: m.presets }))
      .catch(() => {});
    fetch("/api/highlights")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setHl)
      .catch(() => setHl(null))
      .finally(() => setHlLoading(false));
    if (init.sido && init.preset) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncUrl(extra = {}) {
    const p = new URLSearchParams({ sido, preset, tab, ...extra });
    window.history.replaceState(null, "", "?" + p.toString());
  }

  // nextTab: 첫 화면에서 누른 버튼(자격증 시험 / 국비 교육 …). 없으면 지금 탭 그대로(주소로 들어온 경우, Enter).
  async function search(e, nextTab) {
    e?.preventDefault();
    const t = nextTab || tab;
    setTab(t);
    setPending(t);
    setLoading(true);
    setError("");
    syncUrl({ tab: t });
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

  // 결과 보기 버튼: 자격증 시험·국비 교육 중 고른다. 채용·알바 메뉴나 카드로 내려왔으면 그 버튼도 함께.
  const views = [["exams", "자격증 시험"], ["trainings", "국비 교육"]];
  if (tab === "jobs" || tab === "alba") views.push([tab, tab === "jobs" ? "채용 · 알바" : "알바"]);

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
            <a href="#apply">신청·접수</a>
            <a href="#faq">자주 묻는 질문</a>
          </nav>
          {/* 휴대폰(900px 이하)에서는 위 메뉴가 숨겨져서, 같은 메뉴를 펼쳐 보는 버튼 */}
          <button
            type="button"
            className="nav-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className={"burger" + (menuOpen ? " x" : "")} aria-hidden="true"><i /><i /><i /></span>
            <span className="nav-menu-label">{menuOpen ? "닫기" : "메뉴"}</span>
          </button>
          <button type="button" className="btn-x dark sm" onClick={() => menuGo(toSearch)}>바로 찾기</button>
        </div>
        {menuOpen && (
          <nav id="mobile-menu" className="mobile-menu" aria-label="주요 메뉴">
            <div className="wrap mobile-menu-in">
              <button type="button" onClick={() => menuGo(() => openArea("trainings"))}>국비 교육</button>
              <button type="button" onClick={() => menuGo(() => openArea("exams"))}>자격증 시험</button>
              <button type="button" onClick={() => menuGo(() => openArea("jobs"))}>채용 · 알바</button>
              <a href="#apply" onClick={() => setMenuOpen(false)}>신청·접수</a>
              <a href="#faq" onClick={() => setMenuOpen(false)}>자주 묻는 질문</a>
            </div>
          </nav>
        )}
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
              <button type="button" className="btn-x line lg" onClick={() => openArea("exams")}>관련 자격증 찾기</button>
            </div>
          </div>
          <HeroTiles hl={hl} loading={hlLoading} onOpen={openArea} />
          <p className="wrap tiles-swipe" aria-hidden="true">옆으로 밀면 카드가 더 있어요 <Arrow size={16} /></p>
          <p className="wrap tiles-cap">
            {hlLoading ? "전국 숫자를 모으는 중입니다…" : hl ? (
              <>전국 기준 · {agoText(hl.updated_at)} 갱신 · 50·60대 순위는 한국산업인력공단 「2026 국가기술자격 수험자 기초현황」. 카드를 누르면 그 내용부터 열립니다.</>
            ) : "전국 숫자를 불러오지 못했습니다. 아래에서 내 조건으로 찾아보세요."}
          </p>
        </section>

        <section className="finder" id="search" ref={searchRef} aria-labelledby="finder-title">
          <div className="wrap finder-in">
            <div className="finder-intro">
              <p className="kicker">2단계면 끝</p>
              <h2 id="finder-title">내 조건으로 찾기</h2>
              <p>사는 곳과 관심 분야를 고르고 먼저 볼 것(자격증 시험·국비 교육)을 누르세요. 회원가입도, 개인정보 입력도 없습니다.</p>
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
                {FIELD_EX[preset] && (
                  <p className="chip-ex" aria-live="polite"><strong>{preset}</strong> 예: {FIELD_EX[preset]}</p>
                )}
              </fieldset>

              <div className="board-foot">
                {views.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={"btn-x lg " + (k === tab ? "dark" : "line")}
                    disabled={loading}
                    onClick={() => search(null, k)}
                  >
                    {loading && pending === k
                      ? <><span className="spin" aria-hidden="true" />찾는 중…</>
                      : <>{label} 보기 <Arrow size={20} /></>}
                  </button>
                ))}
                <span className="board-goal">누른 내용부터 열려요. 결과에서 다른 탭으로 바꿀 수 있어요.</span>
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

        <section className="apply" id="apply" aria-labelledby="apply-title">
          <div className="wrap apply-in">
            <div className="apply-intro">
              <p className="kicker">바로 신청하기</p>
              <h2 id="apply-title">교육 신청·시험 접수 바로 가기</h2>
              <p>공식 사이트의 신청 화면으로 바로 연결해요. 새 창으로 열립니다.</p>
            </div>
            <div className="apply-grid">
              {APPLY.map((g) => (
                <article key={g.title} className="apply-card">
                  <h3>{g.title}</h3>
                  <ol className="apply-steps">
                    {g.steps.map((s) => <li key={s}>{s}</li>)}
                  </ol>
                  <LinkGrid items={g.links} />
                  <p className="apply-phone">
                    전화 문의 <a href={`tel:${g.phone[0]}`}>{g.phone[0]}</a> {g.phone[1]}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

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
                      <p className="mock-head"><i className="d-sky" />{s.ui.head}<span className="mock-tag">예시</span></p>
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
