"""자격증 → 시·도별 채용공고 수 집계 테스트(키 없이 동작). 제목은 2026-11-14 실제 공고에서 본 모양."""
import asyncio
from datetime import date

import pytest

from app import jobcount
from app.jobcount import months_ago, posting_keywords, summarize, title_matches

TODAY = date(2026, 11, 14)


def row(jid, fr, plc, title="조리원 모집", company="A사", deadline="마감", to="20261001"):
    return {"jobId": jid, "frDd": fr, "workPlc": plc, "recrtTitle": title, "oranNm": company,
            "deadline": deadline, "toDd": to}


def test_keywords_use_words_found_in_job_titles():
    # 2026-11-14 실측: '한식조리' 2년 0건, '조리' 수십 건
    assert posting_keywords("한식조리기능사") == ["조리"]
    assert posting_keywords("제빵기능사") == ["제과", "제빵"]
    assert posting_keywords("굴착기운전기능사") == ["굴착기", "굴삭기", "포크레인"]
    assert posting_keywords("공조냉동기계기능사") == ["공조", "냉동기"]
    assert posting_keywords("지게차운전기능사") == ["지게차"]
    assert posting_keywords("세무사") == ["세무사"]
    assert posting_keywords("일반경비지도사") == ["경비"]
    # '로더운전기능사'에는 '전기'가 끼어 있다 → 등급·'운전'을 뗀 이름으로 맞춘다
    assert posting_keywords("로더운전기능사") == ["로더"]
    assert posting_keywords("타워크레인운전기능사") == ["크레인"]
    assert posting_keywords("전기산업기사") == ["전기"]
    assert posting_keywords("신재생에너지발전설비기능사(태양광)") == ["태양광"]
    assert posting_keywords("미용사(네일)") == ["미용"]
    assert posting_keywords("이용사") == ["이발", "이용사"]
    # 괄호 속 말은 보지 않는다: '(전기안전)' 때문에 전기 공고로 세면 안 된다
    assert posting_keywords("산업안전지도사(전기안전)") == ["산업안전지도사"]
    # 표에 없으면 등급·급수를 뗀 이름
    assert posting_keywords("철도토목기능사") == ["철도토목"]
    assert posting_keywords("사회조사분석사2급") == ["사회조사분석사"]
    assert posting_keywords("1급 청소년지도사") == ["청소년지도사"]


@pytest.mark.parametrize("title, keywords, ok", [
    ("상대원동 아파트형 공장 전기과장 구인", ["전기"], True),
    ("택시운전기사 모집(군포 안양 의왕 과천)", ["전기"], False),
    ("업무용빌딩 기전기사(4교대)/소방1급 필수", ["전기"], True),
    ("공군작전사령부 공무직 근로자 (발전기사 )", ["전기"], True),
    ("건설기초안전보건교육강사(산업위생관리기사+산업/건설안전기사) 모집", ["전기"], False),
    ("[장애인, 시니어 우대] 전기렌지, 인덕션 가전제품 조립", ["전기"], False),
    ("아파트 전기과장 모집", ["전기"], True),
    ("[부천 고강동 공사현장(토목공사현장) 주간제 경비원 채용", ["목공"], False),
    ("비정규직 근로자 채용 (시설관리원-목공)", ["목공"], True),
    ("공무직근로자(시설관리원-영선반) 채용", ["선반", "CNC"], False),
    ("CNC 선반 조작원 (CNC 라인)을 모집합니다.", ["선반", "CNC"], True),
    ("떡갈비 가공 및 포장 업무 생산직원 구인", ["떡"], False),
    ("산후조리원 신생아실 직원", ["조리"], False),
    ("[문막] 정토마을 조리원 채용 공고", ["조리"], True),
    ("자동차 부품 가공 mct, cnc 생산직", ["선반", "CNC"], True),     # 대소문자 무시
])
def test_title_rules_drop_false_matches(title, keywords, ok):
    assert title_matches(title, keywords) is ok


def test_months_ago_handles_month_ends():
    assert months_ago(date(2026, 11, 14), 24) == date(2024, 11, 14)
    assert months_ago(date(2026, 3, 31), 1) == date(2026, 2, 28)
    assert months_ago(date(2026, 5, 31), 1) == date(2026, 4, 30)
    assert months_ago(date(2028, 3, 31), 1) == date(2028, 2, 29)
    assert months_ago(date(2026, 1, 15), 1) == date(2025, 12, 15)


def test_summarize_counts_by_region_and_period():
    rows = [
        row("K1", "20261101", "070100", deadline="접수중", to="20261130"),   # 대구, 접수 중
        row("K2", "20260501", "070200", title="급식 조리사"),                # 대구
        row("K3", "20250101", "030100", title="휴게소 조리보조"),            # 경기
        row("K3", "20250101", "030100", title="휴게소 조리보조"),            # 검색어 두 개에 같은 공고 → 한 번만
        row("K4", "20240101", "030100", title="구내식당 조리원"),            # 2년보다 오래됨 → 제외
        row("K5", "20260301", "120100", title="병원 조리원"),                # 전남광주통합특별시
        row("K6", "20260302", "060100", title="학교 조리실무사"),            # 광주
        row("K7", "20260303", "", title="조리원"),                           # 지역 모름 → 제외
        row("K8", "20260304", "070300", title="산후조리원 청소"),            # 제목 규칙에 걸림 → 제외
    ]
    out = summarize(rows, "대구", ["조리"], TODAY)
    by = {r["name"]: r for r in out["regions"]}
    assert out["since"] == "2024-11-14" and out["months"] == 24 and out["complete"]
    assert by["대구"]["count"] == 2 and by["대구"]["open"] == 1
    assert by["경기"]["count"] == 1
    assert by["광주·전남"]["count"] == 2 and "광주" not in by and "전남" not in by
    assert len(out["regions"]) == 16
    assert out["national"] == 5 and out["open_now"] == 1
    assert out["local"]["name"] == "대구" and out["local"]["rank"] == 1   # 대구·광주전남 2건 공동 1위
    assert [r["name"] for r in out["regions"][:3]] == ["대구", "광주·전남", "경기"]   # 같은 수면 시·도 목록 순
    assert out["search_url"].endswith("srcKeyword=%EB%8C%80%EA%B5%AC%20%EC%A1%B0%EB%A6%AC")


def test_reposted_posting_counts_once_and_keeps_latest_status():
    # 실제로 본 모양: 한 회사가 '굴삭기 운전원 모집합니다.'를 jobId만 바꿔 여러 번 올림
    rows = [
        row("K1", "20250301", "100100", title="송산 굴삭기 운전원 모집합니다.", company="송산"),
        row("K2", "20261101", "100100", title="송산 굴삭기 운전원 모집합니다", company="송산",
            deadline="접수중", to="20261130"),
        row("K3", "20260101", "100100", title="송산 굴삭기 운전원 모집합니다.", company="다른회사"),
    ]
    out = summarize(rows, "울산", ["굴삭기"], TODAY)
    assert out["local"]["count"] == 2 and out["local"]["open"] == 1


def test_same_company_same_title_in_other_region_is_a_different_job():
    rows = [row("K1", "20261101", "090100", company="급식업체"), row("K2", "20261101", "070100", company="급식업체")]
    out = summarize(rows, "대구", ["조리"], TODAY)
    assert out["national"] == 2


def test_local_region_comes_first_among_ties():
    rows = [row("K1", "20261101", "090100"), row("K2", "20261101", "070100"), row("K3", "20261101", "030100"),
            row("K4", "20261102", "030100", title="조리사")]
    out = summarize(rows, "대구", ["조리"], TODAY)
    # 경기 2 > 부산 1 = 대구 1 → 대구(내 지역)가 부산보다 위, 순위는 공동 2위
    assert [r["name"] for r in out["regions"][:3]] == ["경기", "대구", "부산"]
    assert out["local"]["rank"] == 2


def test_summarize_local_with_no_postings_has_no_rank():
    out = summarize([row("K1", "20261101", "030100", title="전기기사")], "광주", ["전기"], TODAY)
    assert out["local"]["name"] == "광주·전남" and out["local"]["count"] == 0 and out["local"]["rank"] is None
    assert out["local"]["is_local"]


def _page(start_day: int, n: int) -> list[dict]:
    """최신순 n건. start_day일 전부터 하루씩 과거로."""
    from datetime import timedelta
    return [row(f"K{start_day + i}", (TODAY - timedelta(days=start_day + i)).strftime("%Y%m%d"), "030100")
            for i in range(n)]


def test_fetches_more_pages_until_period_is_covered(monkeypatch):
    calls = []

    async def fake(search, rows, page):
        calls.append(page)
        # 1쪽: 0~999일 전(2년=730일을 넘김) → 1쪽에서 멈춰야 함
        return _page(0, 1000) if page == 1 else []
    monkeypatch.setattr(jobcount, "fetch_jobs", fake)
    rows, ok = asyncio.run(jobcount._rows_since("조리", months_ago(TODAY, 24)))
    assert calls == [1] and ok and len(rows) == 1000

    calls.clear()

    async def dense(search, rows, page):          # 하루 3건씩: 1쪽이 333일 전까지만 덮는다
        calls.append(page)
        from datetime import timedelta
        base = (page - 1) * 1000
        return [row(f"D{base + i}", (TODAY - timedelta(days=(base + i) // 3)).strftime("%Y%m%d"), "030100")
                for i in range(1000)]
    monkeypatch.setattr(jobcount, "fetch_jobs", dense)
    rows, ok = asyncio.run(jobcount._rows_since("경비", months_ago(TODAY, 24)))
    assert calls == [1, 2, 3] and ok            # 3쪽에서 730일 전을 넘김

    calls.clear()

    async def endless(search, rows, page):       # 아주 촘촘하면 MAX_PAGES에서 멈추고 '일부만'으로 표시
        calls.append(page)
        return [row(f"E{page}-{i}", TODAY.strftime("%Y%m%d"), "030100") for i in range(1000)]
    monkeypatch.setattr(jobcount, "fetch_jobs", endless)
    rows, ok = asyncio.run(jobcount._rows_since("경비", months_ago(TODAY, 24)))
    assert calls == [1, 2, 3, 4, 5] and not ok
