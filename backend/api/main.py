"""FastAPI application factory. `uvicorn api.main:app --reload` for development."""
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import conversations, runs
from api.runs import RunManager, RunStore
from api.settings import Settings, load_settings


def _langfuse_config():
    try:
        from src.evaluation.langfuse_tracing import get_langfuse_handler
        handler = get_langfuse_handler()
        return {"callbacks": [handler]} if handler else {}
    except Exception:  # noqa: BLE001 - tracing is optional and must never block a run.
        return {}


def _open_graph(settings: Settings):
    from langgraph.checkpoint.sqlite import SqliteSaver

    from src.agent import create_invest_agent
    Path(settings.checkpoint_db).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.checkpoint_db, check_same_thread=False)
    saver = SqliteSaver(conn)
    saver.setup()
    return create_invest_agent(checkpointer=saver), conn


def create_app(*, graph=None, settings: Settings | None = None, max_workers: int | None = None) -> FastAPI:
    """Tests inject a scripted `graph`; production opens the checkpointed parent graph on startup."""
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        conn = None
        runtime_graph = graph
        if runtime_graph is None:
            runtime_graph, conn = _open_graph(settings)
        app.state.run_manager = RunManager(runtime_graph, RunStore(),
                                           max_workers=max_workers or settings.max_concurrent_runs,
                                           config_factory=_langfuse_config)
        try:
            yield
        finally:
            app.state.run_manager.shutdown()
            if conn is not None:
                conn.close()

    app = FastAPI(title="InvestAgent API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
    app.include_router(runs.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
