import json
import sys
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pandas as pd
import pytest

from src.core.datasets import DatasetStore
from src.data.tools import get_index_performance, get_price_history, get_sector_history


def test_csi300_name_and_renamed_history_interface(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    provider = SimpleNamespace(index_zh_hist_em=Mock(return_value=pd.DataFrame({
        '日期': ['2025-01-02', '2025-01-03'], '收盘': [100., 102.]})))
    with patch.dict(sys.modules, {'akshare': provider}):
        result = json.loads(get_price_history.invoke({'query': '沪深300指数', 'start_date': '2025-01-02',
            'end_date': '2025-01-03', 'asset_type': 'index', 'adjustment': 'none'},
            config={'configurable': {'dataset_store': DatasetStore()}}))
    assert result['status'] == 'available'
    assert result['dataset_ref']['symbol'] == '000300'
    assert result['dataset_ref']['security_name'] == '沪深300'


def test_latest_indices_include_shenzhen_volume_and_date(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    provider = SimpleNamespace(index_zh_hist_em=Mock(return_value=pd.DataFrame({
        '日期': ['2025-01-03'], '收盘': [100.], '涨跌幅': [2.], '成交量': [1234.]})))
    with patch.dict(sys.modules, {'akshare': provider}):
        result = get_index_performance.invoke({})
    assert '深证成指' in result and '成交量' in result and '2025-01-03' in result


def sector_provider():
    return SimpleNamespace(stock_board_industry_hist_em=Mock(return_value=pd.DataFrame({
        '日期': ['2024-12-31', '2025-01-02', '2025-01-03'], '收盘': [100., 110., 121.],
        '成交额': [999., 1000., 2000.]})),
        stock_fund_flow_sector_hist_em=Mock(return_value=pd.DataFrame({
            '日期': ['2025-01-02', '2025-01-03'], '主力净流入-净额': [20., -5.]})))


def test_sector_interval_return_amount_and_net_flow(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    with patch.dict(sys.modules, {'akshare': sector_provider()}):
        result = json.loads(get_sector_history.invoke({'sector': '半导体', 'start_date': '2025-01-02', 'end_date': '2025-01-03'}))
    assert result['period_return'] == .21
    assert result['turnover_amount_cny'] == 3000.
    assert result['main_net_inflow_cny'] == 15.


def test_incomplete_sector_flow_does_not_publish_partial_sum_as_full_period(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    provider = sector_provider()
    provider.stock_fund_flow_sector_hist_em.return_value = provider.stock_fund_flow_sector_hist_em.return_value.iloc[1:]
    with patch.dict(sys.modules, {'akshare': provider}):
        result = json.loads(get_sector_history.invoke({'sector': '半导体', 'start_date': '2025-01-02', 'end_date': '2025-01-03'}))
    assert result['main_net_inflow_cny'] is None
    assert result['status'] == 'partial' and result['limitations']


def test_sector_flow_failure_preserves_price_and_turnover(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    provider = sector_provider()
    provider.stock_fund_flow_sector_hist_em.side_effect = ConnectionError('offline')
    with patch.dict(sys.modules, {'akshare': provider}):
        result = json.loads(get_sector_history.invoke({'sector': '半导体', 'start_date': '2025-01-02', 'end_date': '2025-01-03'}))
    assert result['status'] == 'partial'
    assert result['period_return'] == .21 and result['turnover_amount_cny'] == 3000.
    assert result['main_net_inflow_cny'] is None


def test_sector_missing_base_and_amount_do_not_invent_metrics(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    provider = sector_provider()
    provider.stock_board_industry_hist_em.return_value = provider.stock_board_industry_hist_em.return_value.iloc[1:].drop(columns=['成交额'])
    with patch.dict(sys.modules, {'akshare': provider}):
        result = json.loads(get_sector_history.invoke({'sector': '半导体', 'start_date': '2025-01-02', 'end_date': '2025-01-03'}))
    assert result['period_return'] is None and result['turnover_amount_cny'] is None
    assert result['main_net_inflow_cny'] == 15.


def test_sector_invalid_range_never_calls_provider(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    provider = sector_provider()
    with patch.dict(sys.modules, {'akshare': provider}):
        result = json.loads(get_sector_history.invoke({'sector': '半导体', 'start_date': '2025-02-01', 'end_date': '2025-01-03'}))
    assert result['status'] == 'unavailable'
    provider.stock_board_industry_hist_em.assert_not_called()


@pytest.mark.parametrize("query", ["沪深300指数", "沪深300(000300)", "沪深300指数（000300）"])
def test_known_index_uses_direct_history_without_fetching_all_index_mappings(monkeypatch, query):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    direct = Mock(return_value=pd.DataFrame({'date': ['2025-01-02', '2025-01-03'], 'close': [100., 102.]}))
    broad = Mock(side_effect=AssertionError('must not crawl all index pages'))
    provider = SimpleNamespace(index_zh_daily_em=direct, index_zh_hist_em=broad)
    with patch.dict(sys.modules, {'akshare': provider}):
        result = json.loads(get_price_history.invoke({'query': query, 'start_date': '2025-01-02',
            'end_date': '2025-01-03'}, config={'configurable': {'dataset_store': DatasetStore()}}))
    assert result['status'] == 'available'
    assert result['dataset_ref']['symbol'] == '000300'
    direct.assert_called_once_with(symbol='sh000300', start_date='20250102', end_date='20250103')
    broad.assert_not_called()


def test_index_name_code_conflict_is_rejected_before_network(monkeypatch):
    monkeypatch.setenv('USE_REAL_DATA', 'true')
    provider = SimpleNamespace(index_zh_daily_em=Mock())
    with patch.dict(sys.modules, {'akshare': provider}):
        result = json.loads(get_price_history.invoke({'query': '沪深300(000001)', 'start_date': '2025-01-02',
            'end_date': '2025-01-03'}, config={'configurable': {'dataset_store': DatasetStore()}}))
    assert result['error']['type'] == 'symbol_mismatch'
    provider.index_zh_daily_em.assert_not_called()
