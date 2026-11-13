import { useEffect, useState } from "react";

const WORK24_JOBS = "https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchList.do";

function deadlineText(j) {
  if (j.until_filled) return "채용 시까지";
  if (!j.close_date) return "마감일 미정";
  if (j.days_left === 0) return `오늘 마감 (${j.close_date})`;
  return `마감 ${j.close_date} (D-${j.days_left})`;
}

const won = (n) => (n == null ? "-" : n.toLocaleString("ko-KR") + "원");

function salaryText(s) {
  if (!s) return "-";
  if (s.type === "negotiable") return "면접 후 결정";
  if (s.type === "unknown") return s.text || "급여 미기재";
  const lo = s.monthly_min, hi = s.monthly_max;
  let t = hi ? `월 ${won(lo)} ~ ${won(hi)}` : `월 ${won(lo)} 이상`;
  if (s.estimated) t += ` (${s.type_label} ${won(s.min_raw)} 환산)`;
  return t;
}

function Flags({ flags }) {
  const labels = {
    title_truncated: "제목 잘림",
    salary_missing: "급여 미기재",
    salary_suspiciously_low: "급여 확인 필요",
    region_unparsed: "지역 확인",
    cost_zero_check: "훈련비 0원(확인)",
    cost_missing: "훈련비 미기재",
  };
  const shown = flags.filter((f) => labels[f]);
  if (!shown.length) return null;
  return (
    <div className="flags">
      {shown.map((f) => (
        <span key={f} className="flag">{labels[f]}</span>
      ))}
    </div>
  );
}

function JobCard({ j }) {
  return (
    <a className="card" href={j.url || "#"} target="_blank" rel="noreferrer">
      <div className="card-top">
        <span className={"score s" + Math.floor(j.senior_score / 25)}>{j.senior_score}</span>
        <h3>{j.title}{j.title_truncated && "…"}</h3>
      </div>
      <p className="muted">{j.company} · {j.regions.map((r) => r.raw).join(", ")}</p>
      <p>{salaryText(j.salary)}</p>
      <p className="muted small">
        {j.career.text || "경력무관"} · {j.education_min || "학력무관"} · {j.work_type || ""}
        {j.emp_type ? ` · ${j.emp_type}` : ""}
      </p>
      <p className="small">{deadlineText(j)}</p>
      {j.senior_reasons.length > 0 && <p className="small why">{j.senior_reasons.join(" / ")}</p>}
      <Flags flags={j.quality_flags} />
    </a>
  );
}

function TrainingCard({ t }) {
  return (
    <a className="card" href={t.url || "#"} target="_blank" rel="noreferrer">
      <div className="card-top">
        <span className="score t">{t.score}</span>
        <h3>{t.title}</h3>
      </div>
      <p className="muted">{t.institution || "기관 미상"} · {t.address || "-"}</p>
      <p>
        {t.start_date} 시작 · {t.duration_weeks ? `${t.duration_weeks}주` : "-"} · {t.weekend || ""}
        {t.days_until_start != null && ` · D-${t.days_until_start}`}
      </p>
      <p className="small">
        훈련비 {won(t.total_cost)} <span className="muted">(자부담은 카드 종류·소득에 따라 달라요)</span>
      </p>
      <p className="small">
        {t.satisfaction != null ? `만족도 ${t.satisfaction}점` : "만족도 평가 없음"}
        {(t.employment_rate_6m ?? t.employment_rate_3m) != null &&
          ` · 취업률 ${t.employment_rate_6m ?? t.employment_rate_3m}%`}
        {t.capacity ? ` · 정원 ${t.capacity}명` : ""}
      </p>
      {t.training_type && <p className="small muted">{t.training_type}</p>}
      <Flags flags={t.quality_flags} />
    </a>
  );
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({ sido: "대구", preset: "요양보호사", keyword: "", age: 55 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta).catch(() => {});
  }, []);

  const search = async (e) => {
    e?.preventDefault();
    if (!form.preset && !form.keyword.trim()) {
      setError("희망 직종을 고르거나 검색어를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams({ sido: form.sido });
      if (form.age) p.set("age", form.age);
      if (form.preset) p.set("preset", form.preset);
      else p.set("keyword", form.keyword.trim());
      const r = await fetch("/api/match?" + p.toString());
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      setData(await r.json());
    } catch (err) {
      setError("정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <header>
        <h1>50+ 재취업 길잡이</h1>
        <p className="muted">지역과 희망 직종을 고르면 채용공고와 국비 훈련과정을 한 화면에 보여드려요.</p>
      </header>

      <form className="search" onSubmit={search}>
        <label>지역
          <select value={form.sido} onChange={(e) => setForm({ ...form, sido: e.target.value })}>
            {(meta?.sido || ["대구"]).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>희망 직종
          <select value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })}>
            <option value="">직접 입력</option>
            {(meta?.presets || []).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        {!form.preset && (
          <label>검색어
            <input value={form.keyword} placeholder="예: 급식" onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
          </label>
        )}
        <label>나이 (선택)
          <input type="number" min="15" max="99" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        </label>
        <button disabled={loading}>{loading ? "찾는 중…" : "찾기"}</button>
      </form>

      {error && <p className="error">{error}</p>}
      {data?.notes && <ul className="notes">{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>}

      {data && (
        <div className="columns">
          <section>
            <h2>채용공고 <small>{data.jobs.count ?? 0}건 (전체 {data.jobs.total})</small></h2>
            {data.jobs.error && (
              <div className="error">
                <p>지금은 채용공고를 불러오지 못했어요.</p>
                <p><a href={WORK24_JOBS} target="_blank" rel="noreferrer">고용24에서 직접 찾아보기 →</a></p>
                <p className="small muted">{data.jobs.error}</p>
              </div>
            )}
            {!data.jobs.error && data.jobs.items?.length === 0 && <p className="empty">조건에 맞는 공고가 없어요.</p>}
            {data.jobs.items?.map((j) => <JobCard key={j.id} j={j} />)}
          </section>
          <section>
            <h2>국비 훈련과정 <small>{data.trainings.count ?? 0}건 (전체 {data.trainings.total})</small></h2>
            {data.trainings.notice && <p className="notice">{data.trainings.notice}</p>}
            {data.trainings.error && <p className="error">국비 훈련과정을 불러오지 못했어요. ({data.trainings.error})</p>}
            {!data.trainings.error && data.trainings.items?.length === 0 && (
              <p className="empty">앞으로 3개월 안에 시작하는 과정이 없어요.</p>
            )}
            {data.trainings.items?.map((t) => <TrainingCard key={t.id + t.round} t={t} />)}
          </section>
        </div>
      )}

      <footer>
        <p>자료 출처: 고용24 채용정보 · 국민내일배움카드 훈련과정 OPEN-API. 공고와 과정의 최신 내용은 각 상세 페이지에서 꼭 확인해 주세요.</p>
        <p>이 서비스는 이름·연락처 등 개인정보를 수집하거나 저장하지 않습니다.</p>
      </footer>
    </main>
  );
}
