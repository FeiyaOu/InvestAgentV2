"""Session-local report reading and portable exports; no execution or persistence."""
import re

import streamlit as st

from services.report_export import prepare_report, report_html, report_markdown  # noqa: F401  # re-exported for tests


def render_report(task_id, record, render_id='final'):
    st.subheader(f'报告 · {task_id}')
    if record.get('status') in {'running','pending'}:
        st.info('报告任务正在排队或生成中，完成后可在这里阅读和下载。')
        return
    if record.get('status') not in {'completed','partial'}:
        st.info('报告尚未成功完成，暂无可下载的成品。请查看节点结果。')
        return
    raw = (record.get('result') or {}).get('final_report')
    if not raw:
        st.info('暂无最终报告，已保留节点输出。')
        return
    try:
        report, errors = prepare_report(raw)
    except ValueError as exc:
        st.warning(str(exc))
        return
    if record['status'] == 'partial' or errors:
        st.warning('这是部分完成的报告／草稿，请检查限制和节点结果。')
    if errors:
        with st.expander(f'报告校验提示 · {task_id}'):
            st.json(errors)
    # Preserve a draft label in exports even for non-validation partial outcomes.
    export_errors = errors or ([{'type':'partial_report'}] if record['status']=='partial' else [])
    markdown = report_markdown(report, export_errors)
    html = report_html(report, export_errors)
    suffix = '-draft' if export_errors else ''
    stem = re.sub(r'[^\w-]', '_', task_id)[:80] or 'report'
    st.caption('报告仅保留在当前会话的最近一轮结果中；新请求或新对话会替换/清空。下载可保留本地副本。')
    left, right = st.columns(2)
    left.download_button('下载 Markdown', markdown, file_name=f'{stem}{suffix}.md', mime='text/markdown',
                         key=f'report_md_{render_id}_{task_id}', on_click='ignore', width='stretch')
    right.download_button('下载 HTML', html, file_name=f'{stem}{suffix}.html', mime='text/html',
                          key=f'report_html_{render_id}_{task_id}', on_click='ignore', width='stretch')
    st.markdown(markdown, unsafe_allow_html=False)
