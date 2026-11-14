import { useEffect, useState } from "react";

export const won = (n) => (n == null ? "-" : n.toLocaleString("ko-KR") + "원");
const num = (n) => (n == null ? "-" : n.toLocaleString("ko-KR"));
const PAGE = 6;

function md(iso) {
  if (!iso) return "-";
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}
function dday(days, status, key = "") {
  if (days == null) return "";
  if (status === "ongoing") {
    if (key.endsWith("_reg")) return days === 0 ? "오늘 마감" : `마감까지 ${days}일`;
    if (key.endsWith("_exam")) return "시험 기간";
    return "발표 중";
  }
  return days === 0 ? "오늘" : `${days}일 뒤`;
}

function Row({ label, children }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function More({ total, shown, onMore }) {
  const rest = total - shown;
  if (rest <= 0) return null;
  return (
    <button type="button" className="btn btn-ghost more" onClick={onMore}>
      더 보기 <span className="sub">({rest}건 남음)</span>
    </button>
  );
}

function Alert({ title, children }) {
  return (
    <div className="alert">
      <p><strong>{title}</strong></p>
      {children}
    </div>
  );
}

// ================================================================ 시험·자격증
function CertDetail({ jmcd, sido }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  const [venueShown, setVenueShown] = useState(4);

  useEffect(() => {
    let alive = true;
    setD(null);
    setErr(false);
    fetch(`/api/cert/${jmcd}?sido=${encodeURIComponent(sido)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x) => alive && setD(x))
      .catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [jmcd, sido]);

  if (err) return <div className="detail"><Alert title="자세한 정보를 불러오지 못했어요.">잠시 후 다시 눌러 주세요.</Alert></div>;
  if (!d) return <div className="detail loading"><span className="spin dark" aria-hidden="true" />시험 일정과 시험장을 불러오는 중이에요…</div>;

  const rounds = Array.isArray(d.rounds) ? d.rounds : [];
  const venues = Array.isArray(d.venues) ? d.venues : [];
  const tr = d.trainings || {};

  return (
    <div className="detail">
      <div className="detail-grid">
        <section className="box">
          <h4>다음 일정</h4>
          {d.always && <p className="hint">상시 시험이라 거의 매주 있어요. 지금 접수할 수 있는 회차입니다.</p>}
          {rounds.length === 0 && <p className="muted">올해 남은 시험이 없어요. 다음 해 일정은 Q-Net에 공고되면 나와요.</p>}
          <ul className="rounds">
            {rounds.map((r) => (
              <li key={r.name}>
                <span className={"tag " + r.next_step.status}>{dday(r.next_step.days, r.next_step.status, r.next_step.key)}</span>
                <div>
                  <strong>{r.next_step.label}</strong> <span className="muted">· {md(r.next_step.date)}</span>
                  <p className="sub">{r.name}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="box">
          <h4>응시료</h4>
          {d.fee && !d.fee.error ? (
            <dl className="fee">
              <Row label={d.series === "기능사" || d.kind === "국가기술자격" ? "필기" : "1차"}>{won(d.fee.written)}</Row>
              {d.fee.practical != null && (
                <Row label={d.series === "기능사" || d.kind === "국가기술자격" ? "실기" : "2차"}>{won(d.fee.practical)}</Row>
              )}
            </dl>
          ) : <p className="muted">응시료 정보가 없어요.</p>}
          {d.stats?.count != null && (
            <p className="hint">
              {d.stats.year}년 {sido}에서 {num(d.stats.count)}명이 접수했어요 (지역 {d.stats.rank}위)
            </p>
          )}
        </section>
      </div>

      <section className="box">
        <h4>{sido} 상설 시험장 <span className="count">{venues.length}곳</span></h4>
        <p className="hint">원서 접수 때 시험장을 직접 고릅니다. 종목마다 열리는 곳이 달라요.</p>
        <ul className="venues">
          {venues.slice(0, venueShown).map((v) => (
            <li key={v.address}>
              <strong>{v.name}</strong>
              <span className="pillsm">{v.type}</span>
              {v.parking && <span className="pillsm warn">{v.parking}</span>}
              <p className="sub">{v.address}</p>
            </li>
          ))}
        </ul>
        <More total={venues.length} shown={venueShown} onMore={() => setVenueShown(venueShown + 6)} />
      </section>

      <section className="box">
        <h4>국비로 배우기 <span className="count">{tr.count ?? 0}건</span></h4>
        {tr.error && <p className="muted">국비 과정을 불러오지 못했어요.</p>}
        {!tr.error && !tr.count && <p className="muted">앞으로 3개월 안에 시작하는 ‘{tr.keyword}’ 과정이 없어요.</p>}
        <ul className="mini">
          {(tr.items || []).slice(0, 3).map((t) => (
            <li key={t.id + t.round}>
              <a href={t.url || "#"} target="_blank" rel="noreferrer">{t.title}</a>
              <p className="sub">{t.institution} · {md(t.start_date)} 개강 · 훈련비 {won(t.total_cost)}</p>
            </li>
          ))}
        </ul>
      </section>

      <JobCounts jc={d.job_counts} sido={sido} />

      <a className="btn btn-primary btn-md" href={d.qnet_url} target="_blank" rel="noreferrer">
        Q-Net에서 자세히 보고 접수하기 <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

// 자격증 → 시·도별 채용공고 수. 지금은 노인 구인정보(50세 이상 대상) 기준, 나중에 고용24 채용정보로 바뀐다.
function JobCounts({ jc, sido }) {
  if (!jc || jc.error) return null;
  const last = jc.keywords[jc.keywords.length - 1];
  const code = last.charCodeAt(last.length - 1) - 0xac00;
  const josa = code >= 0 && code <= 11171 && code % 28 !== 0 ? "이" : "가";   // 받침 있으면 '이'
  const kw = jc.keywords.map((k) => `‘${k}’`).join("·") + josa;
  const years = jc.months % 12 === 0 ? `${jc.months / 12}년` : `${jc.months}개월`;
  const local = jc.local;
  const shown = jc.regions.filter((r) => r.count > 0).slice(0, 8);
  if (local.count > 0 && !shown.some((r) => r.is_local)) shown.push(local);
  const max = Math.max(1, ...shown.map((r) => r.count));

  // '전국 96건'을 지금 지원할 수 있는 공고로 읽지 않게: 기간을 제목에 넣고, 지금 접수 중인 수를 따로 보여 준다
  return (
    <section className="box">
      <h4>최근 {years} 채용공고 <span className="count">전국 {num(jc.national)}건</span></h4>
      <p className="hint">
        제목에 {kw} 들어간 50세 이상 대상 공고를 지역별로 셌어요. 대부분 이미 마감된 공고라,
        어느 지역에서 자주 뽑는지 보는 자료예요. 지역은 {jc.source.region_basis}이에요.
      </p>
      <p className="jc-open">
        {jc.open_now > 0
          ? <>지금 접수 중인 공고는 <strong>전국 {num(jc.open_now)}건</strong>{local.open > 0 && <>, {local.name} {num(local.open)}건</>}이에요.</>
          : "지금 접수 중인 공고는 없어요."}
      </p>

      {local.count > 0 ? (
        <p className="jc-local">
          <strong>{local.name} {num(local.count)}건</strong>
          <span className="muted"> · {jc.regions.length}개 지역 중 {local.rank}위</span>
        </p>
      ) : (
        <p className="jc-local muted">최근 {years} 동안 {local.name}에는 이 자료에 잡힌 공고가 없어요.</p>
      )}

      {shown.length > 0 && (
        <ul className="jc-bars">
          {shown.map((r) => (
            <li key={r.name} className={r.is_local ? "on" : ""}>
              <span className="jc-name">{r.name}</span>
              <span className="jc-track" aria-hidden="true">
                <span className="jc-bar" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="jc-num">{num(r.count)}</span>
            </li>
          ))}
        </ul>
      )}

      {jc.national < 10 && (
        <p className="hint">이 자료에는 공고가 적어요. 전체 채용공고는 고용24에서 확인해 보세요.</p>
      )}
      <ul className="mini">
        <li>
          <a href={jc.search_url} target="_blank" rel="noreferrer">
            고용24에서 ‘{sido} {jc.keywords[0]}’ 공고 찾아보기 <span aria-hidden="true">→</span>
          </a>
        </li>
      </ul>
      <p className="jc-source">
        출처: {jc.source.name} · {jc.source.basis} · 같은 회사가 다시 올린 같은 공고는 1건
        {!jc.complete && " · 공고가 많아 최근 일부만 셌어요"}
      </p>
    </section>
  );
}

// 50·60대 순위에 있는 자격증 이름 → 배지 설명(예: "50대 1위 · 60대 1위")
function ageBadges(info) {
  const m = new Map();
  if (!info) return m;
  for (const [age, rows] of Object.entries(info.groups)) {
    for (const r of rows) {
      const t = `${age.replace(" 이상", "+")} ${r.rank ? r.rank + "위" : "인기"}`;
      m.set(r.name, m.has(r.name) ? `${m.get(r.name)} · ${t}` : t);
    }
  }
  return m;
}

function AgeTop({ info, open, toggle, sido, startOpen }) {
  const ages = Object.keys(info.groups);
  const [age, setAge] = useState(ages[0]);
  const rows = info.groups[age] || [];
  const main = rows.filter((r) => r.grade === "기능사");
  const others = rows.filter((r) => r.grade !== "기능사");
  const Item = ({ r, children }) => (
    <li className={open === r.jmcd ? "open" : ""}>
      <button type="button" className="rank-btn" onClick={() => toggle(r.jmcd)} aria-expanded={open === r.jmcd} disabled={!r.jmcd}>
        {children}
        <span className="chev" aria-hidden="true" />
      </button>
      {open === r.jmcd && <CertDetail jmcd={r.jmcd} sido={sido} />}
    </li>
  );
  return (
    <details className="agetop" open={startOpen}>
      <summary className="agetop-sum">
        <span className="ref-tag">참고</span>
        <span className="agetop-sum-text">
          <strong>50대·60대가 많이 응시한 자격증 (전국)</strong>
          <span>50대·60대 모두 지게차운전기능사가 1위예요</span>
        </span>
        <span className="agetop-more">펼치기</span>
      </summary>
      <div className="agetop-head">
        <p className="tab-note">누르면 {sido}의 다음 시험 일정, 응시료, 시험장이 나옵니다.</p>
        <div className="seg" role="tablist" aria-label="나이대">
          {ages.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={age === a} className={age === a ? "on" : ""} onClick={() => setAge(a)}>
              {a}<span>응시자의 {info.shares?.[a]}%</span>
            </button>
          ))}
        </div>
      </div>

      <p className="agetop-sub">기능사</p>
      <ol className="rank plain age">
        {main.map((r) => (
          <Item key={r.name} r={r}>
            <span className={"age-no" + (r.ranked ? "" : " soft")}>{r.ranked ? r.rank : "·"}</span>
            <span className="rank-main"><span className="rank-name">{r.name}</span></span>
            <span className="rank-count sub">{r.ranked ? (r.rank === 1 ? "가장 많이 응시" : `${r.rank}위`) : "많이 응시"}</span>
          </Item>
        ))}
      </ol>

      <p className="agetop-sub">다른 등급 1위</p>
      <ol className="rank plain age compact">
        {others.map((r) => (
          <Item key={r.grade + r.name} r={r}>
            <span className="age-grade">{r.grade}</span>
            <span className="rank-main"><span className="rank-name">{r.name}</span></span>
            <span className="rank-count sub">1위</span>
          </Item>
        ))}
      </ol>
      <p className="agetop-src">
        출처: {info.source} ({info.released.replaceAll("-", ".")} 발표) · {info.population} 기준 순위.
        공단은 나이별 종목 인원을 공개하지 않아 순위만 보여 줍니다.
      </p>
    </details>
  );
}

export function ExamTab({ data, sido, preset }) {
  const [open, setOpen] = useState(null);
  const { ranking, featured, external, year, grade } = data;
  const max = ranking[0]?.count || 1;
  const toggle = (code) => setOpen(open === code ? null : code);
  const badges = ageBadges(data.age_top);
  const AgeBadge = ({ name }) => (badges.has(name)
    ? <span className="pillsm age-badge" title={`전국 ${badges.get(name)} (한국산업인력공단 발표)`}>50·60대 인기</span>
    : null);
  const nothingMain = ranking.length === 0 && featured.length === 0 && external.length === 0;

  return (
    <div>
      {ranking.length > 0 && (
        <>
          <h3 className="tab-title">{preset} 관련 자격증</h3>
          <p className="tab-note">
            {year}년 전국 응시자가 많은 순서예요. 누르면 {sido}의 다음 시험 일정, 응시료, 시험장이 나와요.
            ‘50·60대 인기’는 50대·60대가 전국에서 많이 응시한 자격증이에요.
          </p>
          <ol className="rank">
            {ranking.map((r) => (
              <li key={r.name} className={open === r.jmcd ? "open" : ""}>
                <button type="button" className="rank-btn" onClick={() => toggle(r.jmcd)} aria-expanded={open === r.jmcd} disabled={!r.jmcd}>
                  <span className="rank-no">{r.rank}</span>
                  <span className="rank-main">
                    <span className="rank-name">
                      {r.name}
                      {r.always && <span className="pillsm">상시 시험</span>}
                      <AgeBadge name={r.name} />
                    </span>
                    <span className="bar" aria-hidden="true"><span style={{ width: `${(r.count / max) * 100}%` }} /></span>
                  </span>
                  <span className="rank-count">
                    전국 {num(r.count)}명
                    <span className="rank-local">{sido} {num(r.local_count)}명</span>
                  </span>
                  <span className="chev" aria-hidden="true" />
                </button>
                {open === r.jmcd && <CertDetail jmcd={r.jmcd} sido={sido} />}
              </li>
            ))}
          </ol>
        </>
      )}

      {(featured.length > 0 || external.length > 0) && (
        <>
          <h3 className="tab-title">{ranking.length > 0 ? "함께 보면 좋은 자격증" : `${preset} 관련 자격증`}</h3>
          {ranking.length === 0 && <p className="tab-note">누르면 {sido}의 다음 시험 일정, 응시료, 시험장이 나와요.</p>}
          <ol className="rank plain">
            {featured.map((f) => (
              <li key={f.jmcd} className={open === f.jmcd ? "open" : ""}>
                <button type="button" className="rank-btn" onClick={() => toggle(f.jmcd)} aria-expanded={open === f.jmcd}>
                  <span className="rank-main"><span className="rank-name">{f.name}<AgeBadge name={f.name} /></span></span>
                  <span className="rank-count sub">{f.kind}</span>
                  <span className="chev" aria-hidden="true" />
                </button>
                {open === f.jmcd && <CertDetail jmcd={f.jmcd} sido={sido} />}
              </li>
            ))}
          </ol>
          {external.map((e) => (
            <div key={e.name} className="ext">
              <div>
                <strong>{e.name}</strong> <span className="sub">· {e.org}</span>
                <p className="sub">{e.note}</p>
              </div>
              <a className="btn btn-ghost" href={e.url} target="_blank" rel="noreferrer">시험 일정 보기 →</a>
            </div>
          ))}
        </>
      )}

      {data.age_top && (
        <div className="agetop-wrap">
          <AgeTop info={data.age_top} open={open} toggle={toggle} sido={sido} startOpen={nothingMain} />
        </div>
      )}
    </div>
  );
}

// ================================================================ 국비 교육
function TrainingCard({ t }) {
  return (
    <article className="card">
      <div className="card-head">
        <span className="pill">추천 {t.score}점</span>
        {t.days_until_start != null && (
          <span className="due">{t.days_until_start === 0 ? "오늘 개강" : `${t.days_until_start}일 뒤 개강`}</span>
        )}
      </div>
      <h3>{t.title}</h3>
      <p className="org">{t.institution || "훈련기관 미상"}</p>
      <dl>
        <Row label="기간">
          {md(t.start_date)} ~ {md(t.end_date)}
          {t.duration_weeks && <span className="sub"> ({t.duration_weeks}주 · {t.weekend || "-"})</span>}
        </Row>
        <Row label="훈련비">
          {won(t.total_cost)}
          <span className="sub"> 자부담은 카드 종류·소득에 따라 달라요</span>
        </Row>
        <Row label="장소">{t.address || "-"}</Row>
        <Row label="평가">{t.satisfaction != null ? `만족도 ${t.satisfaction}점` : "만족도 평가 없음"}</Row>
      </dl>
      {t.url && (
        <a className="card-link" href={t.url} target="_blank" rel="noreferrer">
          과정 자세히 보기 <span aria-hidden="true">→</span>
        </a>
      )}
    </article>
  );
}

export function TrainingTab({ data, sido }) {
  const [shown, setShown] = useState(PAGE);
  if (data.error) return <Alert title="국비 교육 과정을 불러오지 못했어요.">잠시 후 다시 시도해 주세요.</Alert>;
  const items = data.items || [];
  return (
    <div>
      <h3 className="tab-title">{sido}에서 3개월 안에 시작하는 ‘{data.keyword}’ 국비 과정</h3>
      <p className="tab-note">내일배움카드로 들을 수 있는 과정입니다. 만족도가 높고 개강이 가까운 과정이 위에 있어요.</p>
      {items.length === 0 && <p className="empty">지금은 시작 예정인 과정이 없어요. 다른 분야를 골라 보세요.</p>}
      <div className="cards">
        {items.slice(0, shown).map((t) => <TrainingCard key={t.id + t.round} t={t} />)}
      </div>
      <More total={items.length} shown={shown} onMore={() => setShown(shown + PAGE)} />
    </div>
  );
}

// ================================================================ 취업 / 알바
export function LinkGrid({ items }) {
  return (
    <ul className="links">
      {items.map((l) => (
        <li key={l.site}>
          <a href={l.url} target="_blank" rel="noreferrer">
            <span className="fav" aria-hidden="true">
              {l.icon ? <img src={`/favicons/${l.icon}.png`} alt="" width="28" height="28" loading="lazy" /> : l.site.slice(0, 1)}
            </span>
            <strong>{l.site}</strong>
            {l.note && <span className="sub">{l.note}</span>}
            <span className="arrow" aria-hidden="true">→</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function EventCard({ e }) {
  const [, m, d] = (e.date || "--").split("-");
  return (
    <article className="event">
      <div className="cal" aria-label={md(e.date)}>
        <span className="cal-m">{Number(m)}월</span>
        <span className="cal-d">{Number(d)}</span>
      </div>
      <div className="event-body">
        <div className="card-head">
          <span className="due">{e.days_left === 0 ? "오늘" : `${e.days_left}일 뒤`}{e.time ? ` · ${e.time}` : ""}</span>
          {e.senior && <span className="pill">중장년 대상</span>}
        </div>
        <h3>{e.title}</h3>
        {e.host && e.host !== e.title && <p className="org">{e.host}</p>}
        <dl>
          {e.companies && <Row label="참여 기업">{e.companies.length > 90 ? e.companies.slice(0, 90).trim() + "…" : e.companies}</Row>}
          {e.place && <Row label="장소">{e.place}</Row>}
          {e.phone && <Row label="문의"><a href={`tel:${e.phone}`}>{e.phone}</a></Row>}
        </dl>
        {e.directions && (
          <details className="dir">
            <summary>오시는 길</summary>
            <p>{e.directions}</p>
          </details>
        )}
      </div>
    </article>
  );
}

function SeniorJobCard({ j }) {
  return (
    <article className="card job">
      <div className="card-head">
        <span className="due">
          {j.days_left === 0 ? "오늘 마감" : `마감까지 ${j.days_left}일`} · {md(j.end)}
        </span>
        <span className="badges">
          {j.match && <span className="pill">관심 분야</span>}
          {j.senior_pref && <span className="pill green">50세 이상 우대</span>}
        </span>
      </div>
      <h3>{j.title}</h3>
      <p className="org">{j.company}</p>
      <dl>
        {j.place_hint && <Row label="근무 동네">{j.place_hint}</Row>}
        {(j.emp_type || j.headcount) && (
          <Row label="조건">{[j.emp_type, j.headcount ? `${j.headcount}명 모집` : null].filter(Boolean).join(" · ")}</Row>
        )}
        {j.address && <Row label="회사 주소">{j.address}</Row>}
      </dl>
      {j.url && (
        <a className="card-link" href={j.url} target="_blank" rel="noreferrer">
          고용24에서 공고 보기 <span aria-hidden="true">→</span>
        </a>
      )}
    </article>
  );
}

export function JobsTab({ senior, agencies, events, links, sido }) {
  const [shown, setShown] = useState(PAGE);
  const [agShown, setAgShown] = useState(6);
  const jobs = senior?.items || [];
  const ags = agencies?.items || [];
  const items = events.items || [];
  return (
    <div>
      <h3 className="tab-title">{sido} 중장년 채용공고 <span className="count">{senior?.count ?? 0}건</span></h3>
      <p className="tab-note">
        지금 접수 중인 공고입니다. 지역은 회사 주소 기준이니 일하는 곳은 공고에서 확인하세요.
        {senior?.newest && ` ${md(senior.newest)}까지 올라온 공고라 그사이 마감된 것이 있을 수 있어요.`}
      </p>
      {senior?.error && <Alert title="중장년 채용공고를 불러오지 못했어요.">아래 사이트에서 바로 찾아보세요.</Alert>}
      {!senior?.error && jobs.length > 0 && senior?.match_count === 0 && (
        <p className="notice">
          {(senior.keywords || []).map((k) => `‘${k}’`).join("·")} 관련 공고가 지금 {sido}에 없어서,
          {" "}{sido}의 다른 중장년 공고를 보여 드려요.
        </p>
      )}
      {!senior?.error && jobs.length === 0 && (
        <p className="empty">지금 {sido}에 접수 중인 공고가 없어요. 아래 채용행사와 다른 사이트를 확인해 보세요.</p>
      )}
      <div className="cards">{jobs.slice(0, shown).map((j) => <SeniorJobCard key={j.id} j={j} />)}</div>
      <More total={jobs.length} shown={shown} onMore={() => setShown(shown + PAGE)} />

      <h3 className="tab-title">가까운 채용행사·현장면접</h3>
      <p className="tab-note">
        고용센터가 여는 현장면접과 취업박람회입니다{events.area ? ` (${events.area})` : ""}. 이력서를 가져가면 그 자리에서 면접을 봅니다.
      </p>
      {events.error && <Alert title="채용행사를 불러오지 못했어요.">아래 사이트에서 바로 찾아보세요.</Alert>}
      {!events.error && items.length === 0 && <p className="empty">지금 예정된 행사가 없어요.</p>}
      <div className="events">{items.map((e) => <EventCard key={e.id} e={e} />)}</div>

      {ags.length > 0 && (
        <>
          <h3 className="tab-title">60세 이상: {sido} 노인일자리 기관 <span className="count">{ags.length}곳</span></h3>
          <p className="tab-note">시니어클럽과 노인복지관처럼 정부 노인일자리를 운영하는 곳입니다. 보통 60세 이상(사업에 따라 65세 이상)이 신청할 수 있어요.</p>
          <ul className="agencies">
            {ags.slice(0, agShown).map((a) => (
              <li key={a.name + a.address}>
                <div>
                  <strong>{a.name}</strong>
                  <p className="sub">{a.address}</p>
                </div>
                <a className="btn btn-ghost" href={a.map_url} target="_blank" rel="noreferrer">지도·전화 보기</a>
              </li>
            ))}
          </ul>
          <More total={ags.length} shown={agShown} onMore={() => setAgShown(agShown + 12)} />
        </>
      )}

      <h3 className="tab-title">다른 사이트에서 더 찾기</h3>
      <p className="tab-note">누르면 ‘{sido}’와 고른 분야로 검색한 화면이 열립니다.</p>
      <LinkGrid items={links.jobs} />
    </div>
  );
}

export function AlbaTab({ links, sido }) {
  return (
    <div>
      <h3 className="tab-title">{sido} 알바 찾아보기</h3>
      <p className="tab-note">
        알바 사이트는 공개 데이터가 없어서 여기서 공고를 보여 줄 수 없어요. 누르면 고른 지역과 분야로 검색한 화면이 열립니다.
      </p>
      <LinkGrid items={links.alba} />
      <div className="tip">
        <strong>알바 구할 때 꼭 확인하세요</strong>
        <ul>
          <li>일하기 전에 <b>근로계약서</b>를 꼭 받으세요. 시급·근무시간·휴게시간이 적혀 있어야 해요.</li>
          <li>교육비·물품 구입비를 먼저 내라고 하면 의심하세요.</li>
          <li>최저임금보다 적게 주는 곳은 신고할 수 있어요 (고용노동부 1350).</li>
        </ul>
      </div>
    </div>
  );
}
