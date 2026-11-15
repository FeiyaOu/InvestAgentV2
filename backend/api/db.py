"""Engine, schema creation and the checkpointer that shares the database."""
from contextlib import contextmanager

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from api import models  # noqa: F401  # Register tables on the metadata.


def make_engine(database_url: str):
    if database_url.startswith("sqlite"):
        engine = create_engine(database_url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()
    else:
        engine = create_engine(database_url, pool_pre_ping=True)
    return engine


def init_db(engine) -> None:
    SQLModel.metadata.create_all(engine)


@contextmanager
def session_scope(engine):
    with Session(engine) as session:
        yield session
        session.commit()


def open_checkpointer(database_url: str):
    """SqliteSaver on the same SQLite file, PostgresSaver on the same Postgres database.

    Returns (saver, closer). LangGraph owns the checkpoint tables; `setup()` creates them.
    """
    if database_url.startswith("sqlite"):
        import sqlite3

        from langgraph.checkpoint.sqlite import SqliteSaver
        path = database_url.split("///", 1)[1] if "///" in database_url else ":memory:"
        conn = sqlite3.connect(path or ":memory:", check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        saver = SqliteSaver(conn)
        saver.setup()
        return saver, conn.close
    # Runs execute on a thread pool, so the saver needs a pool, not one shared psycopg connection.
    from langgraph.checkpoint.postgres import PostgresSaver
    from psycopg.rows import dict_row
    from psycopg_pool import ConnectionPool
    pool = ConnectionPool(database_url.replace("postgresql+psycopg://", "postgresql://"), min_size=1, max_size=8,
                          open=True, kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row})
    saver = PostgresSaver(pool)
    saver.setup()
    return saver, pool.close
