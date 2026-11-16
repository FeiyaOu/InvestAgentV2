"""Cooperative stop checks inherited by graph nodes, models, and tools."""
import threading

from langchain_core.callbacks import BaseCallbackHandler


class RunCancelled(BaseException):
    """Control flow, not a provider error: specialist `except Exception` must not retry it."""


class CancellationGuard(BaseCallbackHandler):
    raise_error = True

    def __init__(self, requested: threading.Event):
        self.requested = requested

    def check(self):
        if self.requested.is_set():
            raise RunCancelled()

    def on_chain_start(self, *args, **kwargs):
        self.check()

    def on_llm_start(self, *args, **kwargs):
        self.check()

    def on_chat_model_start(self, *args, **kwargs):
        self.check()

    def on_tool_start(self, *args, **kwargs):
        self.check()
