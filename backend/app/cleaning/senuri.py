"""노인 구인정보·노인일자리 수행기관 정제.

실측(2026-11-13)에서 본 문제와 처리:
- 근무지 코드 workPlc('040150')의 앞 두 자리가 시·도(가나다순 번호). 단, '회사 소재지' 기준이라
  서울 용역회사가 경기 아파트 미화원을 뽑으면 01(서울)로 온다 → 화면에 '근무지는 공고에서 확인' 안내
- 데이터상 전남과 광주는 '전남광주통합특별시'(12)로 오고, 06(광주)은 거의 없다 → 광주·전남 선택 시 둘 다
- 목록 누적 76만 건 중 대부분 마감 → deadline '접수중' 이고 종료접수일(toDd)이 오늘 이후인 것만
- 그래도 고용24에서 먼저 마감된 공고가 남아 있다(피드가 약 1주 늦음) → 화면에 '먼저 마감됐을 수 있음' 안내
- 상세 주소(plDetAddr) 앞에 우편번호 '07591 ' → 제거
- 상세 etcItm '(준)고령자(50세이상), 장애인' → 50세 이상 우대 표시
- 상세 담당자·대표자 이름(clerk, repr)은 개인정보라 쓰지 않는다
- 제목 앞 '[진접읍]', '[논현동]' 같은 대괄호는 실제 근무 동네인 경우가 많다 → place_hint 로 분리
- 수행기관 전화번호는 '******'로 가려져 온다 → 이름·주소만
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import date
from urllib.parse import quote

from app.cleaning.common import clean_text, split_sido, to_date

WORKPLC_SIDO = {
    "01": "서울", "02": "강원", "03": "경기", "04": "경남", "05": "경북", "06": "광주", "07": "대구",
    "08": "대전", "09": "부산", "10": "울산", "11": "인천", "12": "전남", "13": "전북", "14": "제주",
    "15": "충남", "16": "충북", "17": "세종",
}
EMP_SHAPE = {"CM0101": "정규직", "CM0102": "계약직", "CM0103": "시간제", "CM0104": "일당직", "CM0105": None}
WORK24_DETAIL = ("https://www.work24.go.kr/wk/a/b/1500/empDetailAuthView.do"
                 "?wantedAuthNo={}&infoTypeCd=VALIDATION&infoTypeGroup=tb_workinfoworknet")
_HINT = re.compile(r"^\s*[\[【(]([^\[\]【】()]{1,12})[\]】)]\s*")   # 짧은 동네·건물 이름만


def sido_prefixes(sido: str) -> set[str]:
    codes = {p for p, s in WORKPLC_SIDO.items() if s == sido}
    if sido in ("광주", "전남"):
        codes |= {"06", "12"}
    return codes


def is_open(row: dict, today: date) -> bool:
    end = to_date(row.get("toDd"))
    return row.get("deadline") == "접수중" and end is not None and end >= today


@dataclass
class SeniorJob:
    id: str
    title: str
    place_hint: str | None
    company: str
    emp_type: str | None
    start: date | None
    end: date | None
    days_left: int | None
    headcount: int | None
    senior_pref: bool        # 50세 이상(준고령자) 우대
    region: str | None       # 회사 소재지 시·도
    address: str | None      # 회사(사업장) 주소
    url: str | None
    source: str | None

    def to_dict(self) -> dict:
        d = asdict(self)
        for k in ("start", "end"):
            d[k] = d[k].isoformat() if d[k] else None
        return d


def clean_job(row: dict, detail: dict | None, today: date) -> SeniorJob:
    d = detail or {}
    title = clean_text(d.get("wantedTitle") or row.get("recrtTitle"))
    hint = None
    m = _HINT.match(title)
    if m:
        rest = clean_text(title[m.end():])
        if rest:                     # '[서면아이파크 미화원 채용]'처럼 전체가 괄호면 그대로 제목
            hint, title = clean_text(m.group(1)), rest
        else:
            title = clean_text(m.group(1))
    elif re.fullmatch(r"[\[【(][^\]】)]+[\]】)]", title):   # 제목 전체가 괄호
        title = clean_text(title[1:-1])
    end = to_date(row.get("toDd") or d.get("toAcptDd"))
    addr = re.sub(r"^\d{5,6}\s*", "", clean_text(d.get("plDetAddr"))) or None
    cnt = clean_text(d.get("clltPrnnum"))
    auth = clean_text(d.get("wantedAuthNo") or row.get("jobId"))
    etc = clean_text(d.get("etcItm"))
    return SeniorJob(
        id=clean_text(row.get("jobId")),
        title=title,
        place_hint=hint,
        company=clean_text(row.get("oranNm") or d.get("plbizNm")),
        emp_type=EMP_SHAPE.get(clean_text(row.get("emplymShp"))),
        start=to_date(row.get("frDd")),
        end=end,
        days_left=(end - today).days if end else None,
        headcount=int(cnt) if cnt.isdigit() and int(cnt) > 0 else None,
        senior_pref=("고령자" in etc) or ("50세" in etc),
        region=WORKPLC_SIDO.get(clean_text(row.get("workPlc"))[:2]),
        address=addr,
        url=WORK24_DETAIL.format(auth) if auth.startswith("K") else None,
        source=clean_text(row.get("stmNm")) or None,
    )


def pick(rows: list[dict], sido: str, today: date) -> list[dict]:
    """지역·접수중 필터 + jobId 중복 제거, 최신 접수 시작 순."""
    pre = sido_prefixes(sido)
    seen, out = set(), []
    for r in rows:
        if r.get("jobId") in seen or not is_open(r, today):
            continue
        if clean_text(r.get("workPlc"))[:2] not in pre:
            continue
        seen.add(r.get("jobId"))
        out.append(r)
    return sorted(out, key=lambda r: r.get("frDd", ""), reverse=True)


# ------------------------------------------------------------------ 수행기관
@dataclass
class Agency:
    name: str
    address: str
    sigungu: str | None
    map_url: str


def clean_agencies(rows: list[dict], sido: str) -> list[Agency]:
    out = []
    for r in rows:
        addr = clean_text(" ".join([r.get("zipAddr", ""), r.get("dtlAddr", "")]))
        s, sgg, _ = split_sido(addr)
        if s != sido:
            continue
        name = clean_text(r.get("orgName"))
        out.append(Agency(name=name, address=addr, sigungu=sgg,
                          map_url=f"https://map.naver.com/p/search/{quote(name)}"))
    return sorted(out, key=lambda a: (a.sigungu or "", a.name))
