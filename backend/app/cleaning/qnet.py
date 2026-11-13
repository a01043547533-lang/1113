"""Q-Net 응답 정제.

실제 응답에서 본 문제와 처리:
- 날짜가 'YYYYMMDD' 문자열이고, 해당 없는 단계(필기 면제 등)는 'XXXXXXXX' 또는 빈값 → None
- 같은 회차(implplannm)가 접수기간만 다른 행으로 2번 이상 온다 → 회차 하나로 합치고 나머지는 '추가 접수 기간'
- 상시 시험 종목(지게차·굴착기·한식조리 등)은 1년에 수십 회차 → 앞으로 남은 회차만, 가까운 순으로
- 응시료가 '1차 : 14500, 2차 : 25200 ' 같은 문장 → 필기/실기 정수
- 시험장은 방(호실)마다 한 줄씩 온다(서울 지사 806행) → 학교 등 임시 시험장은 빼고 주소 기준으로 합침
- 시험장 주소 앞에 '(계명대학교 대명캠퍼스 비사관)' 같은 괄호가 붙기도 함 → 떼고 시·군·구 추출
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import date, datetime

from app.cleaning.common import clean_text, split_sido
from app.codes import same_area

GRADE_SUFFIX = re.compile(r"(기능사|산업기사|기사|기능장|기술사)$")


def d8(v: str | None) -> date | None:
    v = clean_text(v)
    if not re.fullmatch(r"\d{8}", v):
        return None  # 'XXXXXXXX', '' 등
    try:
        return datetime.strptime(v, "%Y%m%d").date()
    except ValueError:
        return None


# ------------------------------------------------------------------ 시험 일정
@dataclass
class Step:
    key: str        # written_reg / written_exam / written_pass / practical_reg / practical_exam / practical_pass
    label: str
    start: date | None
    end: date | None


@dataclass
class Round:
    name: str                      # '2026년 상시 기능사 3회'
    always: bool                   # 상시 시험 회차인가
    steps: list[Step]
    extra_reg: list[dict] = field(default_factory=list)   # 같은 회차의 추가 접수 기간
    next_step: dict | None = None  # 오늘 기준 다음 할 일

    def to_dict(self) -> dict:
        d = asdict(self)
        for s in d["steps"]:
            s["start"] = s["start"].isoformat() if s["start"] else None
            s["end"] = s["end"].isoformat() if s["end"] else None
        return d


_STEP_DEFS = [
    ("written_reg", "필기 원서접수", "docregstartdt", "docregenddt"),
    ("written_exam", "필기시험", "docexamstartdt", "docexamenddt"),
    ("written_pass", "필기 합격 발표", "docpassdt", "docpassdt"),
    ("practical_reg", "실기 원서접수", "pracregstartdt", "pracregenddt"),
    ("practical_exam", "실기시험", "pracexamstartdt", "pracexamenddt"),
    ("practical_pass", "최종 합격 발표", "pracpassstartdt", "pracpassenddt"),
]


def _steps(row: dict) -> list[Step]:
    out = []
    for key, label, s, e in _STEP_DEFS:
        start = d8(row.get(s))
        end = d8(row.get(e)) or start
        # 회차 목록(getCList)은 실기 발표가 pracpassdt 한 칸이다
        if key == "practical_pass" and start is None:
            start = end = d8(row.get("pracpassdt"))
        if key == "written_exam" and start is None:
            start = end = d8(row.get("docexamdt"))
        if start or end:
            out.append(Step(key, label, start, end))
    return out


def next_step(steps: list[Step], today: date) -> dict | None:
    """오늘 기준으로 아직 안 끝난 첫 단계. 진행 중이면 '마감까지', 아니면 '시작까지' D-day."""
    for s in steps:
        end = s.end or s.start
        if end is None or end < today:
            continue
        if s.start and s.start <= today <= end:
            return {"key": s.key, "label": s.label, "status": "ongoing",
                    "date": end.isoformat(), "days": (end - today).days}
        return {"key": s.key, "label": s.label, "status": "upcoming",
                "date": s.start.isoformat() if s.start else end.isoformat(),
                "days": ((s.start or end) - today).days}
    return None


def clean_schedule(rows: list[dict], today: date, limit: int = 4) -> list[Round]:
    """종목별 일정 행 → 앞으로 남은 회차(가까운 순)."""
    rounds: dict[str, Round] = {}
    order: list[str] = []
    for row in rows:
        name = clean_text(row.get("implplannm") or row.get("description")) or "회차 미상"
        steps = _steps(row)
        if name not in rounds:
            rounds[name] = Round(name=name, always="상시" in name, steps=steps)
            order.append(name)
        else:
            # 같은 회차의 다른 접수기간 → 추가 접수로 기록
            for s in steps:
                if s.key.endswith("_reg"):
                    main = next((m for m in rounds[name].steps if m.key == s.key), None)
                    if main is None or (main.start, main.end) != (s.start, s.end):
                        rounds[name].extra_reg.append({
                            "label": s.label + " (추가)",
                            "start": s.start.isoformat() if s.start else None,
                            "end": s.end.isoformat() if s.end else None,
                        })
    out = []
    for name in order:
        r = rounds[name]
        if r.always:
            # 상시 시험은 회차가 수십 개라 단계가 제각각이다 → 아직 접수할 수 있는 회차만
            reg = [s for s in r.steps if s.key.endswith("_reg")]
            if not reg or (reg[0].end or reg[0].start) < today:
                continue
            r.next_step = next_step(reg[:1], today)
        else:
            r.next_step = next_step(r.steps, today)
        if r.next_step:
            out.append(r)
    out.sort(key=lambda r: r.next_step["date"])
    return out[:limit]


# ------------------------------------------------------------------ 응시료
def parse_fee(rows: list[dict]) -> dict | None:
    """'1차 : 14500, 2차 : 25200 ' → {'written': 14500, 'practical': 25200}"""
    for row in rows:
        if "수수료" not in row.get("infogb", ""):
            continue
        text = clean_text(row.get("contents"))
        nums = {k: int(v) for k, v in re.findall(r"([12])\s*차\s*:\s*([\d,]+)", text.replace(",", ""))}
        if nums:
            return {"written": nums.get("1"), "practical": nums.get("2"), "text": text}
        n = re.findall(r"\d[\d,]*", text)
        if n:
            return {"written": int(n[0].replace(",", "")), "practical": None, "text": text}
    return None


# ------------------------------------------------------------------ 시험장
PERMANENT_TYPES = ("디지털시험센터", "국가자격시험장")   # 상설 시험장만
_ROOM = re.compile(r"\s*\[[^\]]*\]|\s*\d+\s*층|\s*\d+\s*실(?=\W|$)|\s*\(\s*(유료주차|주차불가|주차협소|주차가능)[^)]*\)|\(\s*\)")


@dataclass
class Venue:
    name: str
    type: str
    address: str
    sido: str | None
    sigungu: str | None
    rooms: int
    parking: str | None     # '주차 불가' / '유료 주차' / None
    directions: str | None
    phone: str | None


def _parking(*texts: str) -> str | None:
    t = " ".join(texts)
    if "주차불가" in t.replace(" ", ""):
        return "주차 불가"
    if "유료주차" in t.replace(" ", ""):
        return "유료 주차"
    if "주차협소" in t.replace(" ", ""):
        return "주차 협소"
    return None


def clean_venues(rows: list[dict], sido: str | None = None) -> list[Venue]:
    merged: dict[str, Venue] = {}
    for row in rows:
        typ = clean_text(row.get("examAreaGbNm"))
        if not any(t in typ for t in PERMANENT_TYPES):
            continue
        addr = clean_text(row.get("address"))
        addr_core = re.sub(r"^\([^)]*\)\s*", "", addr)
        vs, vsgg, _ = split_sido(addr_core)
        if sido and vs and not same_area(sido, vs):
            continue
        raw_name = clean_text(row.get("examAreaNm"))
        name = raw_name
        while True:  # '1실([주차불가])' 처럼 겹친 표기는 한 번에 안 지워진다
            nxt = _ROOM.sub("", name)
            if nxt == name:
                break
            name = nxt
        name = clean_text(name).strip(" -·")
        # 같은 건물이면 한 시험장으로: '…명덕로 104(대명동)' / '…명덕로 104 계명대학교…' → '…명덕로 104'
        m = re.match(r"^(.*?(?:로|길)\s*\d+(?:-\d+)?)", addr_core)
        key = (m.group(1) if m else re.split(r"[,(]", addr_core)[0]).replace(" ", "") or name
        if key in merged:
            merged[key].rooms += 1
            continue
        merged[key] = Venue(
            name=name or raw_name,
            type="디지털시험센터" if "디지털" in typ else "상설 시험장",
            address=addr_core or addr,
            sido=vs,
            sigungu=vsgg,
            rooms=1,
            parking=_parking(raw_name, clean_text(row.get("plceLoctGid"))),
            directions=clean_text(row.get("plceLoctGid")) or None,
            phone=clean_text(row.get("telNo")) or None,
        )
    return sorted(merged.values(), key=lambda v: (v.type != "디지털시험센터", v.sigungu or "", v.name))


# ------------------------------------------------------------------ 종목 → 국비과정 검색어
def training_keyword(jm_name: str) -> str:
    """'지게차운전기능사' → '지게차', '미용사(일반)' → '미용사', '한식조리기능사' → '한식조리'.

    실측(대구, 3개월): '지게차운전기능사' 6건 < '지게차' 9건. 등급·'운전'·괄호를 떼면 더 잘 걸린다.
    """
    name = re.sub(r"\(.*?\)", "", clean_text(jm_name))
    name = GRADE_SUFFIX.sub("", name)
    name = re.sub(r"운전$", "", name)
    return name or jm_name
