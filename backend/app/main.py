import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import hub



async def _warm():
    """첫 사용자가 오래 기다리지 않게 자주 쓰는 목록을 미리 받아 둔다(실패해도 무시)."""
    from app.clients.qnet import fetch_jm_list
    from app.clients.senuri import fetch_agencies, fetch_jobs
    for coro in (fetch_jm_list(), fetch_jobs(None, 1000), fetch_agencies()):
        try:
            await coro
        except Exception:
            pass


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_warm())
    yield
    task.cancel()


app = FastAPI(title="50+ 재취업 길잡이 API", version="0.3.0", lifespan=lifespan)

s = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in s.CORS_ORIGINS.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hub.router)


@app.get("/health")
def health():
    return {"ok": True}
