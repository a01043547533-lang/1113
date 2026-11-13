from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import hub

app = FastAPI(title="50+ 재취업 길잡이 API", version="0.2.0")

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
