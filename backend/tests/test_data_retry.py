from unittest.mock import Mock

import pytest
from requests.exceptions import ConnectionError, HTTPError, Timeout

from src.core.data_retry import retry_data_call


@pytest.mark.parametrize('error', [ConnectionError(), ConnectionRefusedError(), Timeout(), TimeoutError()])
def test_transient_failures_retry_with_bounded_backoff(error):
    call, sleep = Mock(side_effect=[error, 'ok']), Mock()
    assert retry_data_call(call, sleep=sleep) == 'ok'
    assert call.call_count == 2 and sleep.call_count == 1


def test_rate_limit_retries_but_bad_request_and_empty_data_do_not():
    error = HTTPError(response=Mock(status_code=429))
    call = Mock(side_effect=[error, 'ok'])
    assert retry_data_call(call, sleep=Mock()) == 'ok'
    for error in [ValueError('no data'), AttributeError('renamed'), HTTPError(response=Mock(status_code=400))]:
        call = Mock(side_effect=error)
        with pytest.raises(type(error)):
            retry_data_call(call, sleep=Mock())
        assert call.call_count == 1
    call = Mock(return_value=None)
    assert retry_data_call(call, sleep=Mock()) is None
    assert call.call_count == 1


def test_exhaustion_and_cancellation_do_not_issue_unbounded_requests():
    call = Mock(side_effect=Timeout())
    with pytest.raises(Timeout):
        retry_data_call(call, sleep=Mock())
    assert call.call_count == 3
    class Stop(BaseException):
        pass
    check = Mock(side_effect=[None, Stop()])
    call = Mock(side_effect=Timeout())
    with pytest.raises(Stop):
        retry_data_call(call, sleep=Mock(), check_cancelled=check)
    assert call.call_count == 1
