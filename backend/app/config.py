"""환경 설정. .env 파일에서 읽는다 (.env.example 참고)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 고용24 Open API 인증키 (work24.go.kr > 고객센터 > OPEN-API > 서비스 소개 및 신청)
    # 채용정보(210L01)와 훈련과정(310L01)은 각각 활용신청해야 하며 키가 다를 수 있다.
    WORK24_JOB_KEY: str = ""
    WORK24_TRAINING_KEY: str = ""

    WORK24_BASE: str = "https://www.work24.go.kr/cm/openApi/call"
    HTTP_TIMEOUT: float = 15.0

    # 간단한 메모리 캐시 TTL(초). 일일 호출량 제한 때문에 반드시 캐시한다.
    CACHE_TTL: int = 60 * 30

    CORS_ORIGINS: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
