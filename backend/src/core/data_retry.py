"""Bounded retries for transport failures only; never retry missing data or validation."""
import time
from builtins import ConnectionError as BuiltinConnectionError

from requests.exceptions import ConnectionError, HTTPError, Timeout


def is_transient(error):
    return isinstance(error, (BuiltinConnectionError, ConnectionError, Timeout, TimeoutError)) or (
        isinstance(error, HTTPError) and getattr(error.response, 'status_code', None) in {408, 429, 502, 503, 504})


def retry_data_call(call, *args, sleep=time.sleep, check_cancelled=None, **kwargs):
    for attempt in range(3):
        if check_cancelled:
            check_cancelled()
        try:
            return call(*args, **kwargs)
        except Exception as error:
            if attempt == 2 or not is_transient(error):
                raise
            sleep((.3, .9)[attempt])
