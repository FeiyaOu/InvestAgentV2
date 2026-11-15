"""Service configuration from environment; the core library keeps its own env handling."""
import os
import secrets
import warnings
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _default_database_url() -> str:
    return os.getenv("INVEST_DATABASE_URL", f"sqlite:///{ROOT / 'runtime' / 'investagent.sqlite'}")


def _jwt_secret() -> str:
    value = os.getenv("INVEST_JWT_SECRET")
    if value:
        return value
    warnings.warn("INVEST_JWT_SECRET is not set; using a per-process secret, sessions reset on restart.", stacklevel=2)
    return secrets.token_urlsafe(32)


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=_default_database_url)
    jwt_secret: str = field(default_factory=_jwt_secret)
    jwt_ttl_hours: int = field(default_factory=lambda: int(os.getenv("INVEST_JWT_TTL_HOURS", "72")))
    allow_registration: bool = field(default_factory=lambda: os.getenv("INVEST_ALLOW_REGISTRATION", "true").lower() in {"1", "true", "yes"})
    max_concurrent_runs: int = field(default_factory=lambda: int(os.getenv("INVEST_MAX_CONCURRENT_RUNS", "2")))
    cors_origins: tuple[str, ...] = field(default_factory=lambda: tuple(
        o.strip() for o in os.getenv("INVEST_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()))
    sse_poll_seconds: float = field(default_factory=lambda: float(os.getenv("INVEST_SSE_POLL_SECONDS", "0.2")))


def load_settings() -> Settings:
    """Load backend/.env first (same as the Streamlit shell) so DASHSCOPE_API_KEY etc. are visible."""
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
    except ImportError:
        pass
    return Settings()
