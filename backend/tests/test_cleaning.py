import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

from app.cleaning.common import split_sido, to_date, to_int
from app.cleaning.jobs import clean_job, dedupe_jobs, parse_career, parse_salary
from app.cleaning.training import clean_training, dedupe_trainings
import pytest

from app.clients.work24 import Work24Error, check_error, parse_jobs_xml, parse_trainings_xml

FIX = Path(__file__).parent / "fixtures"
TODAY = date(2025, 11, 13)


def load_jobs():
    _, raw = parse_jobs_xml(ET.parse(FIX / "jobs_sample.xml").getroot())
    return [clean_job(r, TODAY) for r in raw]


def load_trainings():
    _, raw = parse_trainings_xml(ET.parse(FIX / "training_sample.xml").getroot())
    return [clean_training(r, TODAY) for r in raw]


# ---------------------------------------------------------------- common
def test_to_int_and_date_variants():
    assert to_int("2,200,000원") == 2_200_000
    assert to_int(" - ") is None
    assert to_int("0") == 0
    assert to_date("25-11-13") == date(2025, 11, 13)
    assert to_date("20251113") == date(2025, 11, 13)
    assert to_date("2025.12.01 18:00") == date(2025, 12, 1)
    assert to_date("채용시까지") is None


def test_split_sido():
    assert split_sido("대구광역시 달서구 월배로 100")[:2] == ("대구", "달서구")
    assert split_sido("경기 성남시 분당구")[:2] == ("경기", "성남시 분당구")
    assert split_sido("전국")[:2] == (None, None)


# ---------------------------------------------------------------- salary / career
def test_salary_monthly_hourly_yearly_negotiable():
    m = parse_salary("월급", "월급 2,200,000원 이상", "2,200,000", "")
    assert m.type == "monthly" and m.monthly_min == 2_200_000 and not m.estimated

    h = parse_salary("시급", "시급 10,030원", "10030", "0")
    assert h.type == "hourly" and h.monthly_min == 10030 * 209 and h.estimated and h.max_raw is None

    y = parse_salary("연봉", "연봉 3,000만원 ~ 3,600만원", "", "")
    assert y.type == "yearly" and y.min_raw == 30_000_000 and y.max_raw == 36_000_000
    assert y.monthly_min == 2_500_000 and y.monthly_max == 3_000_000

    n = parse_salary("", "면접후 결정", "0", "0")
    assert n.type == "negotiable" and n.monthly_min is None


def test_career_parsing():
    assert parse_career("관계없음").type == "any"
    assert parse_career("신입").type == "new"
    c = parse_career("경력 3년이상")
    assert c.type == "experienced" and c.min_years == 3 and c.max_years is None
    c2 = parse_career("신입/경력 1년 ~ 3년")
    assert c2.type == "new_or_experienced" and c2.min_years == 1 and c2.max_years == 3


# ---------------------------------------------------------------- jobs end-to-end
def test_jobs_cleaned_fields():
    jobs = {j.id: j for j in load_jobs()}

    j1 = jobs["K120012511130001"]
    assert j1.title_truncated and "title_truncated" in j1.quality_flags
    assert "&" in j1.title                      # &amp; → &
    assert j1.sido == "대구" and j1.regions[0]["sigungu"] == "달서구"
    assert j1.education_rank == 0 and j1.career.type == "any"
    assert j1.close_date == date(2025, 12, 31) and j1.days_left == 48
    assert j1.address == "대구광역시 달서구 성당로 10 2층"
    assert j1.senior_score >= 80                 # 중장년 + 경력무관 + 학력무관

    j2 = jobs["K120012511130002"]
    assert [r["sigungu"] for r in j2.regions] == ["북구", "동구"]
    assert j2.until_filled and j2.close_date is None
    assert j2.emp_type and "시간선택제" in j2.emp_type

    j3 = jobs["K120012511130003"]
    assert j3.sido == "경북" and "expired" in j3.quality_flags and j3.days_left == -8
    assert j3.education_min == "대졸(2~3년)" and j3.education_rank == 4

    j4 = jobs["K120012511130004"]
    assert "salary_missing" in j4.quality_flags and j4.senior_score < 50

    j6 = jobs["K120012511130006"]
    assert "salary_suspiciously_low" in j6.quality_flags
    assert "region_unparsed" in j6.quality_flags
    assert j6.reg_date == date(2025, 11, 13) and j6.close_date == date(2025, 12, 1)
    assert j6.emp_type is None                   # 모르는 코드는 None, 크래시 없음


def test_dedupe_jobs_same_posting_other_region():
    jobs = load_jobs()
    assert len(jobs) == 6
    deduped = dedupe_jobs(jobs)
    assert len(deduped) == 5
    assert all(j.id != "K120012511130005" for j in deduped)


# ---------------------------------------------------------------- training end-to-end
def test_training_cleaned_fields():
    ts = {(t.id, t.round): t for t in load_trainings()}

    a = ts[("AIG20250001", "3")]
    assert a.title == "요양보호사 양성과정" and a.tags == ["국민내일배움카드"]
    assert a.institution == "대구행복요양보호사교육원"
    assert a.url.startswith("https://www.work24.go.kr/hr/")
    assert a.sido == "대구" and a.sigungu == "달서구"
    assert a.ncs1 == "07" and a.ncs1_name == "사회복지·종교"
    assert a.duration_weeks == 13 and a.days_until_start == 18
    assert a.total_cost == 1_200_000 and a.real_cost == 180_000
    assert a.satisfaction == 92.0                # 4.6/5 → 92/100
    assert a.fill_ratio == 0.73 and a.weekend == "주중"
    assert a.employment_rate_6m == 70.1

    b = ts[("AIG20250002", "1")]
    assert b.start_date == date(2025, 11, 20) and b.duration_weeks == 4
    assert b.satisfaction is None
    assert "employment_rate_missing" in b.quality_flags
    assert b.enrolled is None and b.fill_ratio is None

    c = ts[("AIG20250003", "1")]
    assert "already_started" in c.quality_flags
    assert c.employment_rate_3m == 45.0 and c.employment_rate_6m == 50.0   # 0.45 → 45%
    assert c.url is None

    d = ts[("AIG20250004", "1")]
    assert "end_before_start" in d.quality_flags
    assert "region_unparsed" in d.quality_flags
    assert d.institution is None


def test_dedupe_trainings_keeps_earliest_round():
    ts = dedupe_trainings(load_trainings())
    ids = [t.id for t in ts]
    assert ids.count("AIG20250001") == 1
    kept = next(t for t in ts if t.id == "AIG20250001")
    assert kept.round == "3"


def test_training_score_ordering():
    ts = dedupe_trainings(load_trainings())
    ts.sort(key=lambda t: -t.score)
    assert ts[0].id == "AIG20250001"   # 취업률 70% + 만족도 92 + 곧 시작


def test_real_api_shape_satisfaction_100_scale_and_zero():
    base = {"trprId": "X", "title": "t", "traStartDate": "2025-11-20", "traEndDate": "2025-12-20",
            "courseMan": "3599360", "realMan": "3599360", "eiEmplRate3": "", "eiEmplRate6": ""}
    t1 = clean_training({**base, "stdgScor": "92.3"}, TODAY)
    t0 = clean_training({**base, "stdgScor": "0"}, TODAY)
    assert t1.satisfaction == 92.3 and t0.satisfaction is None
    assert t1.score > t0.score
    assert t1.real_cost == 3_599_360 and not hasattr(t1, "self_pay")


# ---------------------------------------------------------------- API error detection
def test_check_error_detects_go24_error():
    root = ET.fromstring("<GO24><error>개인회원은 사용할 수 없는 OPEN-API입니다.</error></GO24>")
    with pytest.raises(Work24Error, match="개인회원"):
        check_error(root)
    check_error(ET.fromstring("<HRDNet><scn_cnt>0</scn_cnt></HRDNet>"))  # 정상 0건은 통과
