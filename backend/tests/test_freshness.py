from fastapi.testclient import TestClient

from app import freshness
from app.main import app


def test_status_lists_sources_and_marks():
    freshness.reset()
    freshness.mark("training")
    freshness.set_note("senior_jobs", "가장 최근 공고 11월 5일 등록")
    d = TestClient(app).get("/api/status").json()   # with 없이: 서버 시작 시 미리 받기를 돌리지 않음
    items = {i["key"]: i for i in d["items"]}
    assert items["qnet_stats"]["updated_at"] and "접수" in items["qnet_stats"]["note"]
    assert items["training"]["updated_at"] is not None
    assert items["training"]["cycle"] == "30분마다"
    assert {"qnet_schedule", "qnet_venues", "events", "senior_jobs", "agencies"} <= set(items)
    assert "qnet_list" not in items
