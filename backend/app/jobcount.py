"""자격증 → 시·도별 채용공고 수.

지금 출처: 한국노인인력개발원 노인 구인정보(SenuriService, 고용24·노인일자리 여기 연계).
- 50세 이상 구직자 대상 공고만 들어 있어 jobmatch50 사용자층과 맞지만, 전체 채용시장보다 훨씬 적다.
- 자격증 이름 그대로는 거의 안 걸린다('한식조리' 2년 0건). 공고 제목에 실제로 쓰이는 말로 바꿔 찾는다(KEYWORDS).
- 검색(search)은 제목 속 글자를 그대로 찾는다. '전기'로 찾으면 택시 '운전기사'가, '목공'으로 찾으면 '토목공사'가
  섞여 온다(2026-11-14 확인) → 받아 온 제목을 TITLE_RULES로 한 번 더 거른다.
- 같은 회사가 같은 공고를 여러 번 다시 올린다(굴삭기 4건이 모두 한 회사) → 회사+제목이 같으면 한 건.
- 목록은 최신순. 검색어 하나당 1,000건씩 받아 2년 전까지 내려가면 멈춘다(경비는 1,000건이 약 1년 5개월).
- 지역은 workPlc 앞 두 자리 = 회사 소재지 시·도(근무지와 다를 수 있음). 광주·전남은 한 권역으로 센다.

나중에 고용24 채용정보 API(210L01, 기업회원 키)를 받으면 job_counts()의 데이터 부분만 바꾼다.
그 API는 자격면허·근무지역 필터와 총건수를 주므로 시·도마다 총건수를 받으면 된다.
화면이 쓰는 반환 모양(summarize 결과)은 그대로 둔다.
"""
from __future__ import annotations

import asyncio
import calendar
import re
from datetime import date
from urllib.parse import quote

from app.cleaning.common import clean_text, to_date
from app.cleaning.qnet import training_keyword
from app.cleaning.senuri import WORKPLC_SIDO, is_open
from app.clients.senuri import fetch_jobs
from app.codes import SIDO
from app.config import get_settings

MONTHS = 24
PAGE_ROWS = 1000
MAX_PAGES = 5
SOURCE = {
    "name": "한국노인인력개발원 노인 구인정보",
    "basis": "50세 이상 구직자 대상 공고, 고용24·노인일자리 여기 연계",
    "region_basis": "회사 주소 기준",          # 취업 탭과 같은 말. 일하는 곳과 다를 수 있다
}
GWANGJU_JEONNAM = "광주·전남"

# 등급·급수·'운전'을 뗀 자격증 이름(정규식) → 공고 제목에서 찾을 말. 위에서부터 처음 맞는 것 하나만 쓴다.
# 뗀 이름에 맞추는 이유: '로더운전기능사'처럼 원래 이름엔 '전기'가 끼어 있다.
# '기계'(2년 82건)처럼 뜻이 넓은 말은 부풀려지니 쓰지 않는다. 공고가 없으면 화면이 고용24 검색으로 안내한다.
KEYWORDS: list[tuple[str, list[str]]] = [
    (r"조리", ["조리"]),
    (r"제과|제빵", ["제과", "제빵"]),
    (r"떡", ["떡"]),
    (r"미용사", ["미용"]),
    (r"^이용사$", ["이발", "이용사"]),
    (r"지게차", ["지게차"]),
    (r"굴착기", ["굴착기", "굴삭기", "포크레인"]),
    (r"기중기|크레인", ["크레인"]),
    (r"신재생에너지발전설비", ["태양광"]),
    (r"선반|밀링", ["선반", "CNC"]),
    (r"설비보전", ["설비"]),
    (r"공조냉동", ["공조", "냉동기"]),       # '냉동'만 찾으면 '냉동만두 생산직'이 섞인다
    (r"에너지관리", ["보일러"]),
    (r"승강기", ["승강기"]),
    (r"소방", ["소방"]),
    (r"전기", ["전기"]),
    (r"용접", ["용접"]),
    (r"조경", ["조경"]),
    (r"도배", ["도배"]),
    (r"목공", ["목공"]),
    (r"위험물", ["위험물"]),
    (r"자동차정비", ["자동차정비"]),
    (r"주택관리사", ["관리소장", "주택관리"]),
    (r"공인중개사", ["중개"]),
    (r"세무사", ["세무사"]),
    (r"직업상담사", ["직업상담"]),
    (r"사회복지사", ["사회복지사"]),
    (r"경비지도사", ["경비"]),
]

# 제목에 이 모양으로 들어 있어야 센다. 없으면 검색어가 그대로 들어 있으면 된다(대소문자 무시).
TITLE_RULES = {
    # 택시·버스 '운전기사', '건설안전기사', 가전 '전기렌지 조립'
    "전기": re.compile(r"(?<![운안])전기(?!렌지|레인지|밥솥|매트|장판|자전거|차)"),
    "조리": re.compile(r"(?<!산후)조리"),      # '산후조리원'
    "목공": re.compile(r"(?<!토)목공"),        # '토목공사'
    "선반": re.compile(r"(?<!영)선반"),        # 시설관리 '영선반'
    "떡": re.compile(r"떡(?!갈비|볶이)"),     # '떡갈비 가공', '떡볶이'
}


def posting_keywords(jm_name: str) -> list[str]:
    base = clean_text(re.sub(r"\d급", "", jm_name))      # '사회조사분석사1급', '1급 청소년지도사'
    base = training_keyword(base)                          # 괄호·등급·'운전' 제거
    for pattern, words in KEYWORDS:
        if re.search(pattern, base):
            return words
    return [base]


def title_matches(title: str, keywords: list[str]) -> bool:
    t = clean_text(title)
    for k in keywords:
        rule = TITLE_RULES.get(k)
        if (rule.search(t) if rule else k.lower() in t.lower()):
            return True
    return False


def region_of(row: dict) -> str | None:
    s = WORKPLC_SIDO.get(clean_text(row.get("workPlc"))[:2])
    return GWANGJU_JEONNAM if s in ("광주", "전남") else s


def months_ago(today: date, months: int) -> date:
    y, m = divmod(today.year * 12 + today.month - 1 - months, 12)
    m += 1
    return date(y, m, min(today.day, calendar.monthrange(y, m)[1]))   # 5월 31일의 한 달 전 = 4월 30일


def _same_posting_key(row: dict) -> tuple[str, str, str]:
    """다시 올린 같은 공고를 한 건으로: 회사 이름 + 근무지 코드 + 글자만 남긴 제목.
    근무지 코드까지 보는 이유: 같은 회사가 부산·대구에 각각 낸 '조리원 모집'은 다른 일자리다."""
    return (clean_text(row.get("oranNm")), clean_text(row.get("workPlc")),
            re.sub(r"[^0-9A-Za-z가-힣]", "", clean_text(row.get("recrtTitle"))))


def summarize(rows: list[dict], sido: str, keywords: list[str], today: date,
              months: int = MONTHS, complete: bool = True) -> dict:
    """검색어별 결과를 합친 원본 행 → 시·도별 공고 수."""
    since = months_ago(today, months)
    counts: dict[str, list[int]] = {}           # 지역 → [공고 수, 지금 접수 중]
    seen_ids: set[str] = set()
    seen_posts: set[tuple[str, str]] = set()
    # 최신순으로 보면 다시 올린 공고 중 가장 최근 것의 '접수 중' 여부가 남는다
    for r in sorted(rows, key=lambda r: r.get("frDd", ""), reverse=True):
        jid = r.get("jobId")
        start = to_date(r.get("frDd"))
        if not jid or jid in seen_ids or start is None or start < since:
            continue
        seen_ids.add(jid)
        if not title_matches(r.get("recrtTitle", ""), keywords):
            continue
        reg = region_of(r)
        if reg is None:
            continue
        key = _same_posting_key(r)
        if key in seen_posts:
            continue
        seen_posts.add(key)
        c = counts.setdefault(reg, [0, 0])
        c[0] += 1
        c[1] += is_open(r, today)

    names = list(dict.fromkeys(GWANGJU_JEONNAM if s in ("광주", "전남") else s for s in SIDO))
    local_name = GWANGJU_JEONNAM if sido in ("광주", "전남") else sido
    regions = [{"name": n, "count": counts.get(n, [0, 0])[0], "open": counts.get(n, [0, 0])[1],
                "is_local": n == local_name} for n in names]
    # 건수가 같으면 내 지역을 먼저: '대구 2건 · 7위'인데 같은 2건인 부산 아래 8번째 줄에 나오지 않게
    regions.sort(key=lambda x: (-x["count"], not x["is_local"], names.index(x["name"])))
    local = next(x for x in regions if x["is_local"])
    rank = 1 + sum(1 for x in regions if x["count"] > local["count"]) if local["count"] else None
    return {
        "source": SOURCE,
        "keywords": keywords,
        "months": months,
        "since": since.isoformat(),
        "complete": complete,
        "national": sum(x["count"] for x in regions),
        "open_now": sum(x["open"] for x in regions),
        "regions": regions,
        "local": {**local, "rank": rank},
        "search_url": "https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchList.do?srcKeyword="
                      + quote(f"{sido} {keywords[0]}"),
    }


async def _rows_since(keyword: str, since: date) -> tuple[list[dict], bool]:
    """최신순 목록을 since 이전까지 받는다. (행, 기간을 다 덮었는지)."""
    out: list[dict] = []
    for page in range(1, MAX_PAGES + 1):
        rows = await fetch_jobs(keyword, PAGE_ROWS, page)
        out += rows
        dates = [d for d in (to_date(r.get("frDd")) for r in rows) if d]
        if len(rows) < PAGE_ROWS or not dates or min(dates) < since:
            return out, True
    return out, False


async def job_counts(jm_name: str, sido: str, today: date) -> dict:
    if not get_settings().DATA_GO_KR_KEY:
        return {"error": "DATA_GO_KR_KEY 미설정"}
    keywords = posting_keywords(jm_name)
    since = months_ago(today, MONTHS)
    results = await asyncio.gather(*(_rows_since(k, since) for k in keywords))
    rows = [r for rs, _ in results for r in rs]
    return summarize(rows, sido, keywords, today, complete=all(ok for _, ok in results))
