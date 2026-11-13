"""훈련과정(310L01) 원본 dict → 정규화된 Training.

자주 보이는 문제:
- courseMan/realMan: courseMan=수강비(훈련비), realMan=실제 훈련비. **realMan은 자부담이 아니다.**
  (2026-11 실측: 대구 100건 중 92건이 courseMan과 같고 8건은 더 큼) → 목록 API로는 자부담을 알 수 없다.
- eiEmplRate3/6: 목록 API에서는 대부분 빈값(실측 100건 중 0건). 들어오면 '45.5' / '0.45' 혼재
- stdgScor: 만족도. 100점 만점(예: 92.3), 0은 '평가 없음'. 옛 자료는 5점 만점일 수 있다
- traStartDate: '2025-12-01' / '20251201'
- title: '[K-디지털] 과정명 (3회차)' 처럼 대괄호 태그·회차가 섞임
- subTitle: 보통 훈련기관명이 들어오고, 출력 태그에 기관명 전용 필드가 없다
- titleLink: 상대경로로 오는 경우가 있어 절대 URL로 보정
- 같은 과정(trprId)이 회차(trprDegr)만 다르게 여러 건
- address: '대구 달서구 ...' / '대구광역시 달서구 ...'
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import date

from app.cleaning.common import clean_text, split_sido, to_date, to_float, to_int
from app.codes import NCS1

WORK24 = "https://www.work24.go.kr"
_BRACKET = re.compile(r"\[[^\]]*\]")
_ROUND = re.compile(r"\(\s*\d+\s*회차?\s*\)|\s\d+회차$")


@dataclass
class Training:
    id: str                       # trprId
    round: str | None             # trprDegr(회차)
    title: str
    title_raw: str
    tags: list[str]               # 제목의 [태그]들
    institution: str | None       # subTitle
    institution_id: str | None
    sido: str | None
    sigungu: str | None
    address: str | None
    ncs_code: str | None
    ncs1: str | None              # 대분류 코드(앞 2자리)
    ncs1_name: str | None
    start_date: date | None
    end_date: date | None
    duration_weeks: int | None
    days_until_start: int | None
    total_cost: int | None        # courseMan(수강비)
    real_cost: int | None         # realMan(실제 훈련비) — 자부담 아님
    capacity: int | None          # yardMan
    enrolled: int | None          # regCourseMan
    fill_ratio: float | None
    employment_rate_3m: float | None
    employment_rate_6m: float | None
    satisfaction: float | None    # 100점 만점으로 통일, 평가 없으면 None
    training_type: str | None     # trainTarget
    weekend: str | None           # wkendSe 라벨
    url: str | None
    phone: str | None
    score: int                    # 종합 추천 점수(취업률·만족도·임박도·훈련비)
    quality_flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        for k in ("start_date", "end_date"):
            d[k] = d[k].isoformat() if d[k] else None
        return d


_WKEND = {"1": "주말", "2": "주중+주말", "3": "주중", "9": "해당없음"}


def _abs_url(u: str | None) -> str | None:
    u = clean_text(u)
    if not u:
        return None
    if u.startswith("http"):
        return u
    return WORK24 + (u if u.startswith("/") else "/" + u)


def clean_training(raw: dict[str, str], today: date | None = None) -> Training:
    today = today or date.today()
    flags: list[str] = []

    title_raw = clean_text(raw.get("title"))
    tags = [t.strip("[] ") for t in _BRACKET.findall(title_raw)]
    title = _BRACKET.sub("", title_raw)
    title = _ROUND.sub("", title).strip(" -·")
    if not title:
        title = title_raw

    sido, sgg, addr = split_sido(raw.get("address"))
    if addr and sido is None:
        flags.append("region_unparsed")

    start = to_date(raw.get("traStartDate"))
    end = to_date(raw.get("traEndDate"))
    weeks = None
    if start and end:
        if end < start:
            flags.append("end_before_start")
        else:
            weeks = max(1, round((end - start).days / 7))
    days_until = (start - today).days if start else None
    if days_until is not None and days_until < 0:
        flags.append("already_started")

    total = to_int(raw.get("courseMan"))
    real_cost = to_int(raw.get("realMan"))
    if total is None:
        flags.append("cost_missing")
    elif total == 0:
        flags.append("cost_zero_check")  # 무료 과정일 수도, 미입력일 수도

    cap = to_int(raw.get("yardMan"))
    enrolled = to_int(raw.get("regCourseMan"))
    fill = round(enrolled / cap, 2) if cap and enrolled is not None else None

    r3 = to_float(raw.get("eiEmplRate3"))
    r6 = to_float(raw.get("eiEmplRate6"))
    if r3 is None and r6 is None:
        flags.append("employment_rate_missing")
    # 소수(0.45) 표기로 오는 경우 % 로 통일
    r3 = round(r3 * 100, 1) if r3 is not None and 0 < r3 < 1 else r3
    r6 = round(r6 * 100, 1) if r6 is not None and 0 < r6 < 1 else r6

    ncs = clean_text(raw.get("ncsCd")) or None
    ncs1 = ncs[:2] if ncs and len(ncs) >= 2 else None

    sat = to_float(raw.get("stdgScor"))
    if sat is not None:
        if sat == 0:
            sat = None                       # 0 = 아직 평가 없음
        elif sat <= 5:
            sat = round(sat * 20, 1)         # 5점 만점 표기 → 100점 만점
        else:
            sat = min(sat, 100.0)

    score = recommend_score(r3, r6, sat, days_until, total)

    return Training(
        id=clean_text(raw.get("trprId")) or title_raw[:40],
        round=clean_text(raw.get("trprDegr")) or None,
        title=title,
        title_raw=title_raw,
        tags=tags,
        institution=clean_text(raw.get("subTitle")) or None,
        institution_id=clean_text(raw.get("trainstCstId")) or None,
        sido=sido,
        sigungu=sgg,
        address=addr or None,
        ncs_code=ncs,
        ncs1=ncs1,
        ncs1_name=NCS1.get(ncs1) if ncs1 else None,
        start_date=start,
        end_date=end,
        duration_weeks=weeks,
        days_until_start=days_until,
        total_cost=total,
        real_cost=real_cost,
        capacity=cap,
        enrolled=enrolled,
        fill_ratio=fill,
        employment_rate_3m=r3,
        employment_rate_6m=r6,
        satisfaction=sat,
        training_type=clean_text(raw.get("trainTarget")) or None,
        weekend=_WKEND.get(clean_text(raw.get("wkendSe"))),
        url=_abs_url(raw.get("titleLink")),
        phone=clean_text(raw.get("telNo")) or None,
        score=score,
        quality_flags=flags,
    )


def recommend_score(r3, r6, sat, days_until, total_cost) -> int:
    """취업률(있을 때) + 만족도 + 곧 시작할수록 + 훈련비 낮을수록. 0~100.

    목록 API에 취업률이 거의 없어서, 취업률이 없으면 만족도·임박도·훈련비만으로 매긴다.
    자부담은 보통 훈련비에 비례하므로 훈련비가 낮을수록 가산한다.
    """
    s = 0.0
    rate = r6 if r6 is not None else r3
    if rate is not None:
        s += min(rate, 100) * 0.4                      # 최대 40
    if sat is not None:
        s += sat / 100 * 30                            # 최대 30
    if days_until is not None and days_until >= 0:
        s += max(0.0, 15 - days_until / 7)             # 15주 이내 가산, 최대 15
    if total_cost is not None and total_cost > 0:
        s += max(0.0, 15 * (1 - total_cost / 8_000_000))  # 800만 원 이상이면 0, 최대 15
    return int(round(min(s, 100)))


def dedupe_trainings(items: list[Training]) -> list[Training]:
    """같은 과정ID는 가장 빨리 시작하는 회차 하나만 남긴다."""
    best: dict[str, Training] = {}
    for t in items:
        cur = best.get(t.id)
        if cur is None:
            best[t.id] = t
            continue
        a = t.start_date or date.max
        b = cur.start_date or date.max
        if a < b:
            best[t.id] = t
    return list(best.values())
