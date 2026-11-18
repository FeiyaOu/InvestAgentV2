"""Recent means five observed trading sessions, not five calendar days."""
import json
import sys
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pandas as pd

from src.data.tools import get_sector_performance


def provider():
    dates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16']
    return SimpleNamespace(
        stock_board_industry_hist_em=Mock(return_value=pd.DataFrame({'日期': dates,
            '收盘': [100., 102., 104., 106., 108., 110.], '成交额': [999., 10., 20., 30., 40., 50.]})),
        stock_fund_flow_sector_hist_em=Mock(return_value=pd.DataFrame({'日期': dates[1:],
            '主力净流入-净额': [1., 2., -3., 4., 5.]})))


def invoke(source, **args):
    with patch('src.data.tools._sector_https_flow', side_effect=ValueError('isolated')), patch('src.data.tools._sector_https_history', side_effect=ValueError('isolated')), patch.dict(sys.modules, {'akshare': source}), patch('src.data.tools._sector_end_date', return_value=date(2026, 11, 16)):
        return json.loads(get_sector_performance.invoke({'sector': '半导体', **args}))


def test_default_recent_uses_five_trading_sessions_and_preceding_close(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    result = invoke(provider())
    assert result['requested_trading_days'] == 5
    assert result['observations'] == 5
    assert result['start_date'] == '2026-11-10' and result['end_date'] == '2026-11-16'
    assert result['period_return'] == .1
    assert result['turnover_amount_cny'] == 150.
    assert result['main_net_inflow_cny'] == 9.
    assert result['return_base_date'] == '2026-11-09'
    assert result['source_url'] and result['retrieved_at']


def test_explicit_one_trading_day(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    result = invoke(provider(), trading_days=1)
    assert result['observations'] == 1
    assert result['start_date'] == result['end_date'] == '2026-11-16'
    assert result['period_return'] == round(110 / 108 - 1, 12)
    assert result['turnover_amount_cny'] == 50.
    assert result['main_net_inflow_cny'] == 5.


def test_missing_flow_does_not_fabricate_zero_or_change_price_window(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    source = provider()
    source.stock_fund_flow_sector_hist_em.return_value = source.stock_fund_flow_sector_hist_em.return_value.iloc[1:]
    result = invoke(source)
    assert result['status'] == 'partial'
    assert result['main_net_inflow_cny'] is None and result['period_return'] == .1


def test_insufficient_trading_days_cannot_be_presented_as_five_days(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    source = provider()
    source.stock_board_industry_hist_em.return_value = source.stock_board_industry_hist_em.return_value.iloc[-3:]
    result = invoke(source)
    assert result['status'] == 'partial'
    assert result['observations'] == 3
    assert result['period_return'] is None and result['turnover_amount_cny'] is None


def test_incomplete_current_session_is_excluded(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    source = provider()
    source.stock_board_industry_hist_em.return_value.loc[6] = ['2026-11-17', 999., 999.]
    result = invoke(source)
    assert result['end_date'] == '2026-11-16' and result['period_return'] == .1


def test_https_source_reads_only_known_sector_and_uses_same_window_for_flow(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    frame = provider().stock_board_industry_hist_em.return_value
    prices = {'data': {'klines': [f'{r.日期},0,{r.收盘},0,0,0,{r.成交额}' for r in frame.itertuples()]}}
    flow = {'data': {'klines': [f'{r[0]},{r[1]}' for r in provider().stock_fund_flow_sector_hist_em.return_value.itertuples(index=False, name=None)]}}
    with patch('src.data.tools._sector_json_get', side_effect=[prices, flow]) as fetch, \
         patch('src.data.tools._sector_end_date', return_value=date(2026, 11, 16)), \
         patch.dict(sys.modules, {'akshare': SimpleNamespace()}):
        result = json.loads(get_sector_performance.invoke({'sector': '半导体'}))
    assert result['status'] == 'available' and result['main_net_inflow_cny'] == 9.
    assert fetch.call_count == 2
    assert all(call.args[1]['secid'] == '90.BK1036' for call in fetch.call_args_list)


def test_ths_fallback_restores_verified_amount_and_separates_eastmoney_flow(monkeypatch):
    from types import ModuleType
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    source = ModuleType('akshare')
    source.stock_board_industry_hist_em = Mock(side_effect=ConnectionError())
    source.stock_board_industry_index_ths = Mock()
    source.stock_fund_flow_sector_hist_em = Mock(return_value=provider().stock_fund_flow_sector_hist_em.return_value)
    frame = provider().stock_board_industry_hist_em.return_value
    with patch('src.data.tools._sector_https_history', side_effect=ConnectionError()), \
         patch('src.data.tools._call_sector_ths', return_value=frame), \
         patch('src.data.tools._sector_https_flow', side_effect=ValueError('isolated')), \
         patch('src.data.tools._sector_end_date', return_value=date(2026, 11, 16)), \
         patch.dict(sys.modules, {'akshare': source}):
        result = json.loads(get_sector_performance.invoke({'sector': '半导体'}))
    assert result['status'] == 'partial' and result['provider'] == 'akshare/ths'
    assert result['period_return'] == .1
    assert result['main_net_inflow_cny'] is None and result['turnover_amount_cny'] == 150.
    assert result['independent_fund_flow']['main_net_inflow_cny'] == 9.


def test_backup_industry_prices_and_amount_are_not_merged_with_other_source_flow(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    source = provider()
    frame = source.stock_board_industry_hist_em.return_value.copy()
    source.stock_board_industry_hist_em.side_effect = ValueError('source unavailable')
    source.stock_board_industry_index_ths = Mock()
    with patch('src.data.tools._call_sector_ths', return_value=frame):
        result = invoke(source)
    assert result['provider'] == 'akshare/ths'
    assert result['period_return'] == .1
    assert result['turnover_amount_cny'] == 150. and result['main_net_inflow_cny'] is None
    assert result['status'] == 'partial'
    assert result['independent_fund_flow']['main_net_inflow_cny'] == 9.


def test_fund_flow_is_returned_separately_when_price_source_fails(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    frame = provider().stock_fund_flow_sector_hist_em.return_value
    with patch('src.data.tools._sector_price_data', side_effect=ValueError('price unavailable')), \
         patch('src.data.tools._sector_https_flow', return_value=frame), \
         patch('src.data.tools._sector_end_date', return_value=date(2026, 11, 16)), \
         patch.dict(sys.modules, {'akshare': SimpleNamespace()}):
        result = json.loads(get_sector_performance.invoke({'sector': '半导体'}))
    assert result['status'] == 'partial'
    assert result['independent_fund_flow']['main_net_inflow_cny'] == 9.
    assert result['independent_fund_flow']['start_date'] == '2026-11-10'
    assert result['period_return'] is None


def test_ths_price_and_eastmoney_flow_are_both_shown_with_separate_scopes(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    source = provider()
    source.stock_board_industry_hist_em.side_effect = ValueError('price unavailable')
    source.stock_board_industry_index_ths = Mock()
    prices = provider().stock_board_industry_hist_em.return_value
    flows = provider().stock_fund_flow_sector_hist_em.return_value
    with patch('src.data.tools._sector_https_history', side_effect=ValueError('offline')), \
         patch('src.data.tools._call_sector_ths', return_value=prices), \
         patch('src.data.tools._sector_https_flow', return_value=flows), \
         patch('src.data.tools._sector_end_date', return_value=date(2026, 11, 16)), \
         patch.dict(sys.modules, {'akshare': source}):
        result = json.loads(get_sector_performance.invoke({'sector': '半导体'}))
    assert result['provider'] == 'akshare/ths'
    assert result['main_net_inflow_cny'] is None
    assert result['independent_fund_flow']['main_net_inflow_cny'] == 9.
    assert result['independent_fund_flow']['classification'] == '东方财富行业'
    assert result['independent_fund_flow']['source_url']


def test_different_latest_dates_keep_flow_window_separate(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    source = provider()
    flows = pd.DataFrame({'日期': ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17'],
                          '主力净流入-净额': [1., 2., -3., 4., 5.]})
    with patch('src.data.tools._sector_https_history', side_effect=ValueError('isolated')), \
         patch('src.data.tools._sector_https_flow', return_value=flows), \
         patch('src.data.tools._sector_end_date', return_value=date(2026, 11, 17)), \
         patch.dict(sys.modules, {'akshare': source}):
        result = json.loads(get_sector_performance.invoke({'sector': '半导体'}))
    assert result['end_date'] == '2026-11-16'
    assert result['independent_fund_flow']['end_date'] == '2026-11-17'
    assert result['independent_fund_flow']['main_net_inflow_cny'] == 9.
    assert result['main_net_inflow_cny'] is None
