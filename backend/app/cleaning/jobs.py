"""채용정보(210L01) 원본 dict → 정규화된 Job.

실제 API에서 자주 보이는 '들쭉날쭉'한 값들:
- sal: '월급 2,200,000원 이상' / '연봉 3,000만원 ~ 3,600만원' / '시급 10,030원' / '면접후 결정' / '회사내규에 따름'
- minSal/maxSal: '2200000' / '2,200,000' / '' / '0'
- region: '대구 달서구' / '대구광역시 달서구' / '서울 강남구,경기 성남시 분당구' / '전국'
- career: '관계없음' / '신입' / '경력 3년이상' / '경력 1년 ~ 3년' / '신입/경력'
- minEdubg: '학력무관' / '고졸' / '대졸(2~3년)' / '대졸(4년)이상'
- regDt/closeDt: '25-11-13' / '2025-11-13' / '채용시까지' / ''
- title: 100자 넘으면 '...'로 잘림, HTML 엔티티(&amp;) 섞임
- 같은 공고가 지역별로 여러 건 중복
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import date

from app.cleaning.common import clean_text, is_null, split_multi, split_sido, to_date, to_int
from app.codes import EDU_RANK, EMP_TYPE

# 급여를 '월 환산'할 때 쓰는 계수. 법정 기준(주 40시간, 월 209시간)과 평균 근무일.
HOURS_PER_MONTH = 209
DAYS_PER_MONTH = 21.75

SENIOR_POSITIVE = ("중장년", "시니어", "50대", "60대", "장년", "연령무관", "나이무관", "연령 무관", "나이 무관",
                   "고령자", "노인일자리", "경력단절", "재취업", "퇴직자")
SENIOR_NEGATIVE = ("청년", "20대", "30대", "신입공채", "병역", "군필")


@dataclass
class Salary:
    type: str | None = None          # hourly / daily / monthly / yearly / negotiable / unknown
    type_label: str | None = None    # 시급/일급/월급/연봉
    min_raw: int | None = None       # 원본 단위(시급이면 시간당)
    max_raw: int | None = None
    monthly_min: int | None = None   # 월 환산(원)
    monthly_max: int | None = None
    estimated: bool = False          # 시급/일급을 월로 환산했으면 True
    text: str = ""                   # 원문


@dataclass
class Career:
    type: str = "any"                # any / new / experienced / new_or_experienced
    min_years: float | None = None
    max_years: float | None = None
    text: str = ""


@dataclass
class Job:
    id: str
    title: str
    title_truncated: bool
    company: str
    industry: str | None
    salary: Salary
    regions: list[dict]              # [{sido, sigungu, raw}]
    sido: str | None                 # 첫 근무지 시도
    work_type: str | None            # 주5일 등
    emp_type_code: str | None
    emp_type: str | None
    education_min: str | None
    education_rank: int | None
    career: Career
    reg_date: date | None
    close_date: date | None
    until_filled: bool               # '채용시까지'
    days_left: int | None
    url: str | None
    source: str | None
    address: str | None
    job_code: str | None
    senior_score: int                # 50대 적합도 0~100 (휴리스틱)
    senior_reasons: list[str] = field(default_factory=list)
    quality_flags: list[str] = field(default_factory=list)  # 정제 중 발견한 이상 징후

    def to_dict(self) -> dict:
        d = asdict(self)
        for k in ("reg_date", "close_date"):
            d[k] = d[k].isoformat() if d[k] else None
        return d


# ------------------------------------------------------------------ 급여
_SAL_TYPE = {"시급": "hourly", "일급": "daily", "월급": "monthly", "연봉": "yearly"}
_NEGOTIABLE = ("면접", "협의", "내규", "추후", "결정")


def _won(num: str, unit: str) -> int:
    n = int(num.replace(",", ""))
    if unit.startswith("만"):
        n *= 10_000
    return n


def parse_salary(sal_tp_nm: str | None, sal: str | None, min_sal: str | None, max_sal: str | None) -> Salary:
    s = Salary(text=clean_text(sal))
    label = clean_text(sal_tp_nm)
    # 임금형태명이 비어 있으면 급여 문장 앞머리에서 추출
    if not label:
        for k in _SAL_TYPE:
            if s.text.startswith(k):
                label = k
                break
    s.type_label = label or None
    s.type = _SAL_TYPE.get(label, None)

    lo = to_int(min_sal)
    hi = to_int(max_sal)
    if (lo is None or lo == 0) and s.text:
        # '연봉 3,000만원 ~ 3,600만원' / '월급 220만원 이상' 같은 문장에서 숫자 추출
        nums = re.findall(r"(\d[\d,]*)\s*(만원|만|원)?", s.text)
        vals = [_won(n, u or "원") for n, u in nums if n.replace(",", "").isdigit()]
        if vals:
            lo = vals[0]
            hi = vals[1] if len(vals) > 1 else None
    if hi == 0:
        hi = None
    if lo == 0:
        lo = None

    if lo is None and any(t in s.text for t in _NEGOTIABLE):
        s.type = "negotiable"
    elif lo is None and s.type is None:
        s.type = "unknown"

    s.min_raw, s.max_raw = lo, hi
    if lo is not None:
        if s.type == "hourly":
            s.monthly_min, s.estimated = int(lo * HOURS_PER_MONTH), True
            s.monthly_max = int(hi * HOURS_PER_MONTH) if hi else None
        elif s.type == "daily":
            s.monthly_min, s.estimated = int(lo * DAYS_PER_MONTH), True
            s.monthly_max = int(hi * DAYS_PER_MONTH) if hi else None
        elif s.type == "yearly":
            s.monthly_min = lo // 12
            s.monthly_max = hi // 12 if hi else None
        else:  # monthly 또는 형태 불명(월급으로 간주)
            s.monthly_min, s.monthly_max = lo, hi
    return s


# ------------------------------------------------------------------ 경력
_YEARS = re.compile(r"(\d+(?:\.\d+)?)\s*년")
_MONTHS = re.compile(r"(\d+)\s*개월")


def parse_career(v: str | None) -> Career:
    c = Career(text=clean_text(v))
    t = c.text
    if not t or "관계없음" in t or "무관" in t:
        c.type = "any"
        return c
    has_new = "신입" in t
    has_exp = "경력" in t
    if has_new and has_exp:
        c.type = "new_or_experienced"
    elif has_new:
        c.type = "new"
    elif has_exp:
        c.type = "experienced"
    yrs = [float(x) for x in _YEARS.findall(t)]
    mos = [int(x) for x in _MONTHS.findall(t)]
    vals = yrs + [m / 12 for m in mos]
    if vals:
        c.min_years = min(vals)
        if len(vals) > 1:
            c.max_years = max(vals)
        elif "이상" not in t and "이하" in t:
            c.min_years, c.max_years = None, vals[0]
    return c


# ------------------------------------------------------------------ 학력
def parse_education(v: str | None) -> tuple[str | None, int | None]:
    t = clean_text(v).replace(" ", "")
    if not t:
        return None, None
    t = re.sub(r"(이상|이하)$", "", t)
    rank = EDU_RANK.get(t)
    if rank is None:
        for k, r in EDU_RANK.items():
            if t.startswith(k):
                rank = r
                break
    return (t or None), rank


# ------------------------------------------------------------------ 메인
def clean_job(raw: dict[str, str], today: date | None = None) -> Job:
    today = today or date.today()
    flags: list[str] = []

    title = clean_text(raw.get("title"))
    truncated = title.endswith("...") or title.endswith("…")
    if truncated:
        title = title.rstrip(".…").strip()
        flags.append("title_truncated")

    salary = parse_salary(raw.get("salTpNm"), raw.get("sal"), raw.get("minSal"), raw.get("maxSal"))
    if salary.type in ("negotiable", "unknown"):
        flags.append("salary_missing")
    if salary.monthly_min and salary.monthly_min < 1_500_000 and salary.type == "monthly":
        flags.append("salary_suspiciously_low")  # 월급인데 150만 미만 → 시급 오기재 의심

    regions = []
    for part in split_multi(raw.get("region")):
        sido, sgg, raw_r = split_sido(part)
        regions.append({"sido": sido, "sigungu": sgg, "raw": raw_r})
    if not regions:
        flags.append("region_missing")
    elif all(r["sido"] is None for r in regions):
        flags.append("region_unparsed")

    edu_min, edu_rank = parse_education(raw.get("minEdubg"))
    career = parse_career(raw.get("career"))

    close_raw = clean_text(raw.get("closeDt"))
    until_filled = "채용시" in close_raw or "상시" in close_raw
    close_date = None if until_filled else to_date(close_raw)
    reg_date = to_date(raw.get("regDt"))
    if close_raw and not until_filled and close_date is None:
        flags.append("close_date_unparsed")
    days_left = (close_date - today).days if close_date else None
    if days_left is not None and days_left < 0:
        flags.append("expired")

    emp_code = clean_text(raw.get("empTpCd")) or None
    emp_type = EMP_TYPE.get(emp_code) if emp_code else None

    addr = " ".join(x for x in (clean_text(raw.get("basicAddr")), clean_text(raw.get("detailAddr"))) if x) or None

    score, reasons = senior_score(title, career, edu_rank, salary, emp_code, raw)

    return Job(
        id=clean_text(raw.get("wantedAuthNo")) or f"{raw.get('company','')}-{title}"[:60],
        title=title,
        title_truncated=truncated,
        company=clean_text(raw.get("company")),
        industry=clean_text(raw.get("indTpNm")) or None,
        salary=salary,
        regions=regions,
        sido=regions[0]["sido"] if regions else None,
        work_type=clean_text(raw.get("holidayTpNm")) or None,
        emp_type_code=emp_code,
        emp_type=emp_type,
        education_min=edu_min,
        education_rank=edu_rank,
        career=career,
        reg_date=reg_date,
        close_date=close_date,
        until_filled=until_filled,
        days_left=days_left,
        url=clean_text(raw.get("wantedInfoUrl")) or None,
        source=clean_text(raw.get("infoSvc")) or None,
        address=addr,
        job_code=clean_text(raw.get("jobsCd")) or None,
        senior_score=score,
        senior_reasons=reasons,
        quality_flags=flags,
    )


def senior_score(title: str, career: Career, edu_rank: int | None, salary: Salary,
                 emp_code: str | None, raw: dict) -> tuple[int, list[str]]:
    """50대 구직자 관점의 적합도 휴리스틱. 고용24 API에는 연령 조건이 없어서 간접 신호로 추정한다."""
    score, why = 50, []
    t = title
    if any(k in t for k in SENIOR_POSITIVE):
        score += 30
        why.append("제목에 중장년/연령무관 표기")
    if any(k in t for k in SENIOR_NEGATIVE):
        score -= 30
        why.append("제목에 청년/신입공채 표기")
    if career.type == "any":
        score += 10
        why.append("경력 무관")
    elif career.type == "experienced":
        score += 5
        why.append("경력자 우대")
    if edu_rank is not None and edu_rank <= 3:
        score += 10
        why.append("학력 고졸 이하/무관")
    if emp_code in ("11", "21"):
        score += 5
        why.append("시간선택제")
    if salary.type == "negotiable":
        score -= 5
    return max(0, min(100, score)), why


def dedupe_jobs(jobs: list[Job]) -> list[Job]:
    """구인인증번호 중복 제거 + (회사, 제목, 시도)가 같은 사실상 동일 공고 제거."""
    seen_id: set[str] = set()
    seen_sig: set[tuple] = set()
    out = []
    for j in jobs:
        if j.id in seen_id:
            continue
        sig = (j.company, j.title, j.sido)
        if sig in seen_sig:
            j.quality_flags.append("duplicate_of_other_region")
            continue
        seen_id.add(j.id)
        seen_sig.add(sig)
        out.append(j)
    return out
