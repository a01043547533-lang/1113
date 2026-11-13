import { useCallback, useEffect, useState } from "react";
import { Arrow, Logo } from "./art.jsx";

// 운영 정보는 아직 정해지지 않아 임의의 값이다. 실제 주소·메일로 바꿔서 쓴다.
const OPERATOR = {
  team: "재취업 길잡이 운영팀",
  email: "hello@example.com",
  blog: { label: "운영 블로그", url: "https://blog.example.com" },
};

const OFFICIAL = [
  ["고용24", "https://www.work24.go.kr", "국비 교육 · 채용", "work24"],
  ["Q-Net", "https://www.q-net.or.kr", "자격증 시험 접수", "qnet"],
  ["노인일자리 여기", "https://www.seniorro.or.kr", "시니어 구인", "seniorro"],
  ["한국보건의료인국가시험원", "https://www.kuksiwon.or.kr", "요양보호사 시험", "kuksiwon"],
];

const PHONES = [
  ["고용노동부 고객상담센터", "1350", "내일배움카드 · 실업급여"],
  ["한국산업인력공단 고객센터", "1644-8000", "자격증 시험"],
];

const kst = (iso, opts) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", ...opts });

function ago(iso, now) {
  const m = Math.max(0, Math.round((now - new Date(iso)) / 60000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d}일 전` : kst(iso, { year: "numeric", month: "long", day: "numeric" });
}

function state(item, now) {
  if (!item.updated_at) return item.note ? "off" : "wait";
  const m = (now - new Date(item.updated_at)) / 60000;
  return m <= (item.ttl_min || 60) * 1.5 ? "fresh" : "old";
}

const STATE_LABEL = { fresh: "최신", old: "다시 받을 차례", wait: "아직 안 받음", off: "꺼짐" };

function Freshness({ status, loading, onRefresh }) {
  const now = Date.now();
  const items = status?.items || [];
  const fresh = items.filter((it) => state(it, now) === "fresh").length;
  const latest = items.map((it) => it.updated_at).filter(Boolean).sort().pop();
  return (
    <details className="fresh">
      <summary className="fresh-sum">
        <i className={`st st-${items.length && fresh === items.length ? "fresh" : fresh ? "old" : "wait"}`} aria-hidden="true" />
        <span className="fresh-line">
          <strong>데이터 갱신</strong>
          {status ? (
            <>
              <span>최신 {fresh}/{items.length}</span>
              {latest && <span>마지막 {ago(latest, now)}</span>}
            </>
          ) : (
            <span>{loading ? "확인 중…" : "정보 없음"}</span>
          )}
        </span>
        <span className="fresh-more">자세히</span>
      </summary>

      <div className="fresh-body">
        <div className="fresh-tools">
          <span>
            각 기관 공공데이터를 받아 온 시각
            {status?.now && ` · ${kst(status.now, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 기준`}
          </span>
          <button type="button" className="link-btn sm" onClick={onRefresh} disabled={loading}>
            {loading ? "확인 중…" : "다시 확인"}
          </button>
        </div>
        {!status && !loading && <p className="fresh-empty">갱신 정보를 불러오지 못했습니다.</p>}
        {status && (
          <ul className="fresh-list" aria-label="자료별 마지막 갱신 시각">
            {items.map((it) => {
              const st = state(it, now);
              return (
                <li key={it.key}>
                  <i className={`st st-${st}`} title={STATE_LABEL[st]} aria-hidden="true" />
                  <span className="fl-name">{it.name}<em>{it.org} · {it.cycle}</em></span>
                  <span className="fl-time">
                    {it.updated_at ? (
                      <time dateTime={it.updated_at} title={kst(it.updated_at, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}>
                        {ago(it.updated_at, now)}
                      </time>
                    ) : (st === "off" ? "받지 않음" : "아직 안 받음")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

export function useStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { status, loading, refresh };
}

export default function Footer({ onSearch, onArea, statusApi }) {
  const { status, loading, refresh } = statusApi;
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-hero">
          <div className="foot-brand">
            <Logo />
            <p>50세 이상을 위한 무료 재취업 정보. 배우고, 취득하고, 다시 일하기까지 한 화면에서.</p>
          </div>
          <button type="button" className="pill-btn dark lg" onClick={onSearch}>내 조건으로 찾기 <Arrow size={20} /></button>
        </div>

        <Freshness status={status} loading={loading} onRefresh={refresh} />

        <div className="foot-cols">
          <nav aria-labelledby="fc-1">
            <h3 id="fc-1">둘러보기</h3>
            <ul>
              <li><button type="button" onClick={() => onArea("trainings")}>국비 교육</button></li>
              <li><button type="button" onClick={() => onArea("exams")}>자격증 시험</button></li>
              <li><button type="button" onClick={() => onArea("jobs")}>채용 · 알바</button></li>
              <li><a href="#faq">자주 묻는 질문</a></li>
            </ul>
          </nav>
          <nav aria-labelledby="fc-2">
            <h3 id="fc-2">공식 사이트</h3>
            <ul>
              {OFFICIAL.map(([n, url, s, icon]) => (
                <li key={n}>
                  <a href={url} target="_blank" rel="noreferrer" className="foot-site">
                    <img src={`/favicons/${icon}.png`} alt="" width="22" height="22" loading="lazy" />
                    <span>{n}<span className="foot-sub">{s}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div aria-labelledby="fc-3">
            <h3 id="fc-3">전화 상담</h3>
            <ul>
              {PHONES.map(([n, num, s]) => (
                <li key={n} className="foot-phone">
                  <span className="foot-num">{num}</span>
                  <span>{n}</span>
                  <span className="foot-sub">{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div aria-labelledby="fc-4">
            <h3 id="fc-4">운영</h3>
            <ul>
              <li>{OPERATOR.team}</li>
              <li><span className="foot-sub">문의</span> <span className="foot-mail">{OPERATOR.email}</span></li>
              <li><a href={OPERATOR.blog.url} target="_blank" rel="noreferrer">{OPERATOR.blog.label}</a></li>
            </ul>
          </div>
        </div>

        <div className="foot-bottom">
          <p>© 2026 50+ 재취업 길잡이</p>
          <p>이름·연락처 같은 개인정보를 모으거나 저장하지 않습니다.</p>
          <p>자료 출처: 한국산업인력공단, 고용24, 한국노인인력개발원 공공데이터(OPEN-API). 최신 내용은 각 기관에서 확인하세요.</p>
        </div>
      </div>
    </footer>
  );
}
