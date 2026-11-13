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
          {d.always && <p className="hint">상시 시험이라 거의 매주 시험이 있어요. 지금 접수할 수 있는 회차를 가까운 순으로 보여드려요.</p>}
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
        <p className="hint">시험장은 원서를 접수할 때 직접 고를 수 있어요. 종목마다 열리는 곳이 달라요.</p>
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

      <a className="btn btn-primary btn-md" href={d.qnet_url} target="_blank" rel="noreferrer">
        Q-Net에서 자세히 보고 접수하기 <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

export function ExamTab({ data, sido, preset }) {
  const [open, setOpen] = useState(null);
  const { ranking, featured, external, year, grade } = data;
  const max = ranking[0]?.count || 1;
  const toggle = (code) => setOpen(open === code ? null : code);

  return (
    <div>
      {ranking.length > 0 && (
        <>
          <h3 className="tab-title">{sido}에서 많이 응시한 {preset} 자격증</h3>
          <p className="tab-note">
            {year}년 {grade} 접수자 수 기준이에요. 나이별 통계는 공개되지 않아 전체 접수자 기준으로 보여드려요.
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
                    </span>
                    <span className="bar" aria-hidden="true"><span style={{ width: `${(r.count / max) * 100}%` }} /></span>
                  </span>
                  <span className="rank-count">{num(r.count)}명</span>
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
          <h3 className="tab-title">{preset} 분야 주요 자격</h3>
          <ol className="rank plain">
            {featured.map((f) => (
              <li key={f.jmcd} className={open === f.jmcd ? "open" : ""}>
                <button type="button" className="rank-btn" onClick={() => toggle(f.jmcd)} aria-expanded={open === f.jmcd}>
                  <span className="rank-main"><span className="rank-name">{f.name}</span></span>
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
      <p className="tab-note">국민내일배움카드로 들을 수 있는 과정이에요. 만족도와 개강일, 훈련비를 보고 순서를 정했어요.</p>
      {items.length === 0 && <p className="empty">지금은 시작 예정인 과정이 없어요. 다른 분야도 골라 보세요.</p>}
      <div className="cards">
        {items.slice(0, shown).map((t) => <TrainingCard key={t.id + t.round} t={t} />)}
      </div>
      <More total={items.length} shown={shown} onMore={() => setShown(shown + PAGE)} />
    </div>
  );
}

// ================================================================ 취업 / 알바
function LinkGrid({ items }) {
  return (
    <ul className="links">
      {items.map((l) => (
        <li key={l.site}>
          <a href={l.url} target="_blank" rel="noreferrer">
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

export function JobsTab({ events, links, sido }) {
  const items = events.items || [];
  return (
    <div>
      <h3 className="tab-title">가까운 채용행사·현장면접</h3>
      <p className="tab-note">
        고용센터가 여는 현장면접, 일자리 수요데이, 취업박람회예요{events.area ? ` (${events.area})` : ""}. 이력서를 들고 가면 그 자리에서 면접을 볼 수 있어요.
      </p>
      {events.error && <Alert title="채용행사를 불러오지 못했어요.">아래 사이트에서 바로 찾아보세요.</Alert>}
      {!events.error && items.length === 0 && <p className="empty">지금 예정된 행사가 없어요.</p>}
      <div className="events">{items.map((e) => <EventCard key={e.id} e={e} />)}</div>

      <h3 className="tab-title">같은 조건으로 공고 찾아보기</h3>
      <p className="tab-note">‘{sido}’와 고르신 분야로 검색한 화면이 바로 열려요.</p>
      <LinkGrid items={links.jobs} />
    </div>
  );
}

export function AlbaTab({ links, sido }) {
  return (
    <div>
      <h3 className="tab-title">{sido} 알바 찾아보기</h3>
      <p className="tab-note">
        알바 사이트는 공개 데이터가 없어서 공고를 직접 보여드리지는 못해요. 대신 고르신 지역과 분야로 검색한 화면을 바로 열어 드려요.
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
