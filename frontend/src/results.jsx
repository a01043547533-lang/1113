import { useState } from "react";

const PAGE = 6;
const WORK24_JOBS = "https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchList.do";

const won = (n) => (n == null ? "-" : n.toLocaleString("ko-KR") + "원");

function deadlineText(j) {
  if (j.until_filled) return "채용 시까지";
  if (!j.close_date) return "마감일 미정";
  if (j.days_left === 0) return "오늘 마감";
  return `${j.days_left}일 남음 · ${j.close_date} 마감`;
}

function salaryText(s) {
  if (!s) return "급여 미기재";
  if (s.type === "negotiable") return "면접 후 결정";
  if (s.type === "unknown" || s.monthly_min == null) return s.text || "급여 미기재";
  const lo = s.monthly_min, hi = s.monthly_max;
  return hi ? `월 ${won(lo)} ~ ${won(hi)}` : `월 ${won(lo)} 이상`;
}

const FLAG_LABELS = {
  title_truncated: "제목 일부 생략",
  salary_missing: "급여 미기재",
  salary_suspiciously_low: "급여 확인 필요",
  region_unparsed: "근무지 확인 필요",
  cost_zero_check: "훈련비 0원 · 확인 필요",
  cost_missing: "훈련비 미기재",
};

function Flags({ flags }) {
  const shown = flags.filter((f) => FLAG_LABELS[f]);
  if (!shown.length) return null;
  return (
    <ul className="flags" aria-label="확인이 필요한 정보">
      {shown.map((f) => <li key={f}>{FLAG_LABELS[f]}</li>)}
    </ul>
  );
}

function Row({ label, children }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function JobCard({ j }) {
  const urgent = j.days_left != null && j.days_left <= 3;
  return (
    <article className="card">
      <div className="card-head">
        <span className="pill">적합도 {j.senior_score}점</span>
        <span className={"due" + (urgent ? " urgent" : "")}>{deadlineText(j)}</span>
      </div>
      <h3>{j.title}{j.title_truncated && "…"}</h3>
      <p className="org">{j.company}</p>
      <dl>
        <Row label="급여">
          {salaryText(j.salary)}
          {j.salary?.estimated && (
            <span className="sub"> ({j.salary.type_label} {won(j.salary.min_raw)} 기준 환산)</span>
          )}
        </Row>
        <Row label="근무지">{j.regions.map((r) => r.raw).join(", ") || "-"}</Row>
        <Row label="조건">
          {[j.career.text || "경력무관", j.education_min || "학력무관", j.work_type].filter(Boolean).join(" · ")}
        </Row>
      </dl>
      {j.senior_reasons.length > 0 && <p className="why">{j.senior_reasons.join(" · ")}</p>}
      <Flags flags={j.quality_flags} />
      {j.url && (
        <a className="card-link" href={j.url} target="_blank" rel="noreferrer">
          공고 자세히 보기 <span aria-hidden="true">→</span>
        </a>
      )}
    </article>
  );
}

function TrainingCard({ t }) {
  const rate = t.employment_rate_6m ?? t.employment_rate_3m;
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
          {t.start_date} ~ {t.end_date || "-"}
          {t.duration_weeks && <span className="sub"> ({t.duration_weeks}주 · {t.weekend || "-"})</span>}
        </Row>
        <Row label="훈련비">
          {won(t.total_cost)}
          <span className="sub"> 자부담은 카드 종류·소득에 따라 달라요</span>
        </Row>
        <Row label="장소">{t.address || "-"}</Row>
        <Row label="평가">
          {t.satisfaction != null ? `만족도 ${t.satisfaction}점` : "만족도 평가 없음"}
          {rate != null && ` · 취업률 ${rate}%`}
        </Row>
      </dl>
      <Flags flags={t.quality_flags} />
      {t.url && (
        <a className="card-link" href={t.url} target="_blank" rel="noreferrer">
          과정 자세히 보기 <span aria-hidden="true">→</span>
        </a>
      )}
    </article>
  );
}

function Column({ title, block, before, render, empty }) {
  const [shown, setShown] = useState(PAGE);
  const items = block.items || [];
  const rest = items.length - shown;
  return (
    <section className="col" aria-label={title}>
      <h2 className="col-title">
        {title} {!block.error && <span>{items.length}건</span>}
      </h2>
      {before}
      {items.slice(0, shown).map(render)}
      {rest > 0 && (
        <button type="button" className="btn btn-ghost more" onClick={() => setShown(shown + PAGE)}>
          더 보기 <span className="sub">({rest}건 남음)</span>
        </button>
      )}
      {!block.error && items.length === 0 && <p className="empty">{empty}</p>}
    </section>
  );
}

export default function Results({ data }) {
  const { jobs, trainings } = data;
  return (
    <div className="results">
      {data.notes && (
        <ul className="notes">
          {data.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      <div className="cols" key={JSON.stringify(data.query)}>
        <Column
          title="채용공고"
          block={jobs}
          empty="조건에 맞는 공고가 없어요. 다른 직종도 골라 보세요."
          render={(j) => <JobCard key={j.id} j={j} />}
          before={jobs.error && (
            <div className="alert">
              <p><strong>지금은 채용공고를 불러오지 못했어요.</strong></p>
              <p>고용24에서 같은 조건으로 바로 찾아볼 수 있어요.</p>
              <a className="btn btn-ghost" href={WORK24_JOBS} target="_blank" rel="noreferrer">
                고용24에서 찾아보기 <span aria-hidden="true">→</span>
              </a>
            </div>
          )}
        />
        <Column
          title="국비 훈련과정"
          block={trainings}
          empty="앞으로 3개월 안에 시작하는 과정이 없어요."
          render={(t) => <TrainingCard key={t.id + t.round} t={t} />}
          before={<>
            {trainings.notice && <p className="notice">{trainings.notice}</p>}
            {trainings.error && (
              <div className="alert">
                <p><strong>국비 훈련과정을 불러오지 못했어요.</strong></p>
                <p>잠시 후 다시 시도해 주세요.</p>
              </div>
            )}
          </>}
        />
      </div>
    </div>
  );
}
