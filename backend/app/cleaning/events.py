"""고용24 채용행사(210L11 목록 + 210D11 상세) 정제.

실제 값 예:
- eventNm: '★ [춘천고용센터 일자리 수요데이 행사 ] ★테라로사 춘천의암호점 정규직 바리스타 모집'
           '75_(일자리 수요데이) 취업이음+ (주)위드윈앤코스 구인구직만남의 날 행사'
           '[동작취업지원센터  현장면접] 다이소 동작, 관악지역 매장 근무자 채용// ★26년 11월 26일(목) 14:00 ★'
- 목록은 지난 1년치(약 1,800건)가 섞여 온다 → 오늘 이후 행사만
- 상세의 담당자 이름·이메일은 개인정보라 쓰지 않는다(기관 문의 전화만)
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import date

from app.cleaning.common import clean_text, to_date

SENIOR_WORDS = ("중장년", "신중년", "시니어", "장년", "50+", "5060", "안심-잡", "안심잡", "어르신", "고령")
_DECOR = re.compile(r"[★☆♥♡◆◇■□●○▶▷※❍]+")
_NUM_PREFIX = re.compile(r"^\d+\s*_\s*")
_TAG = re.compile(r"^[\[〔(【]([^\]〕)】]+)[\]〕)】]\s*")
_TAIL_DATE = re.compile(r"\s*//.*$")


@dataclass
class Event:
    id: str
    title: str
    host: str | None          # 앞머리 [..] 안의 주최·행사 이름
    date: date | None
    days_left: int | None
    time: str | None          # '14:00 ~ 16:00'
    place: str | None
    companies: str | None
    phone: str | None
    directions: str | None
    senior: bool              # 중장년 대상 행사로 보이는가
    area: str | None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["date"] = self.date.isoformat() if self.date else None
        return d


def clean_title(raw: str) -> tuple[str, str | None]:
    t = _DECOR.sub(" ", clean_text(raw))
    t = _TAIL_DATE.sub("", t)
    t = _NUM_PREFIX.sub("", t.strip())
    host = None
    m = _TAG.match(t)
    if m:
        host = clean_text(m.group(1))
        rest = t[m.end():].strip()
        # '〔송파구 취업성공데이〕 채용행사' 처럼 남는 말이 너무 일반적이면 주최 이름을 제목으로
        t = rest if rest and rest not in GENERIC else host
    return clean_text(t), host


GENERIC = {"채용행사", "행사", "채용", "채용박람회", "취업박람회"}


def clean_place(v: str | None) -> str | None:
    """'❍일 시 : 2026. 11. 19. ❍장 소 : ○○구청' 같은 자유 문장에서 장소만."""
    t = clean_text(_DECOR.sub(" ", (v or "").replace("❍", " ")))
    if not t:
        return None
    m = re.search(r"장\s*소\s*[:：]\s*(.+?)(?=\s*(일\s*시|문\s*의|대\s*상)\s*[:：]|$)", t)
    if m:
        return clean_text(m.group(1))
    if re.match(r"^(일\s*시|일\s*정)\s*[:：]", t):
        return None
    return t


def clean_event(row: dict, detail: dict | None, today: date) -> Event:
    title, host = clean_title(row.get("eventNm", ""))
    start = to_date(row.get("startDt")) or to_date((row.get("eventTerm") or "").split("~")[0])
    term = clean_text((detail or {}).get("eventTerm") or row.get("eventTerm"))
    tm = re.search(r"\((\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2})\)", term)
    d = detail or {}
    text = " ".join([row.get("eventNm", ""), d.get("joinCoWantedInfo", "")])
    return Event(
        id=clean_text(row.get("eventNo")),
        title=title,
        host=host,
        date=start,
        days_left=(start - today).days if start else None,
        time=tm.group(1).replace(" ", "") if tm else None,
        place=clean_place(d.get("eventPlc")),
        companies=clean_text(d.get("joinCoWantedInfo")) or None,
        phone=clean_text(d.get("inqTelNo")) or None,
        directions=clean_text(d.get("visitPath")) or None,
        senior=any(w in text for w in SENIOR_WORDS),
        area=clean_text(row.get("area")) or None,
    )


def upcoming(rows: list[dict], today: date) -> list[dict]:
    """오늘 이후 시작하는 행사만, 가까운 순."""
    out = [r for r in rows if (to_date(r.get("startDt")) or date.min) >= today]
    return sorted(out, key=lambda r: r.get("startDt", ""))
