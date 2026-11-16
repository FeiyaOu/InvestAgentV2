import { useMemo, useState } from "react";
import { Icon, type IconName } from "../../components/Icon";

/** Mirrors backend app/example_queries.py: every card is a journey the current specialists support. */
function examples(today: string) {
  return [
    { title: "查最新估值", hint: "一次查询 · 两只股票", query: "茅台和五粮液最新的PE TTM与PB是多少？" },
    { title: "看历史表现", hint: "价格采集 + 指标与曲线", query: "分析贵州茅台过去一年的收益、波动率和最大回撤，并展示累计收益和回撤曲线。" },
    { title: "和指数比较", hint: "股票与指数采集 + 基准比较", query: "比较茅台过去一年相对沪深300的表现，计算超额收益和Beta。" },
    { title: "比较两家公司", hint: "多类数据 + 多项分析", query: "比较茅台和五粮液最新估值，以及过去一年的收益、波动率和最大回撤。不要生成完整报告。" },
    {
      title: "检查测试组合",
      hint: "假设组合 · 约束检查 + 压力测试",
      query: `测试假设组合：持仓日期为${today}，人民币：茅台60%、五粮液30%、现金10%，单股上限50%。检查限制，并计算两只股票分别下跌20%和10%时的组合收益，不查询行情。`,
    },
    { title: "生成行业报告", hint: "完整报告流程 · 阅读与下载", query: "请生成新能源行业未来一年的投研报告，重点关注光伏。" },
  ];
}

const abilities: { icon: IconName; title: string; text: string; tag: string }[] = [
  { icon: "search", title: "行情与估值查询", text: "获取股票、指数的日线行情与 PE TTM / PB 估值快照，标注来源与日期", tag: "数据" },
  { icon: "compare", title: "多股对比分析", text: "同口径比较估值、收益、波动率与回撤，不做名次与优劣判断", tag: "分析" },
  { icon: "chart", title: "历史表现洞察", text: "累计收益、回撤、相对基准的超额收益与 Beta，图表全部来自结构化计算产物", tag: "洞察" },
  { icon: "shield", title: "组合约束与压力测试", text: "检查用户给定的持仓约束，计算价格冲击与历史情景下的组合结果", tag: "风控" },
  { icon: "report", title: "行业研究报告", text: "感知、建模、推理、决策、校验六节点流程，生成可阅读下载的结构化报告", tag: "报告" },
];

export function HomeView({ onRun, busy, initialQuery }: { onRun: (query: string) => void; busy: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [showExamples, setShowExamples] = useState(true);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  }, []);
  const today = useMemo(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date()), []);
  const cards = useMemo(() => examples(today), [today]);
  const canRun = query.trim().length > 0 && !busy;

  return (
    <div className="content">
      <section className="hero">
        <div className="eyebrow">
          <span></span> 您的智能投研工作台
        </div>
        <h1>{greeting}，想研究什么？</h1>
        <p>查询行情、比较公司、洞察历史表现与风险，或生成一份完整的行业研究报告。</p>
      </section>

      <section className="research-box">
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canRun) onRun(query.trim());
          }}
          placeholder="例如：比较茅台和五粮液最新估值，以及过去一年的收益、波动率和最大回撤"
          maxLength={2000}
          aria-label="研究需求"
        />
        <div className="box-footer">
          <div className="input-meta">
            <span className="model-dot"></span>深度研究模式<span className="divider"></span>
            <span>{query.length}/2000</span>
          </div>
          <button className="run-button" disabled={!canRun} onClick={() => onRun(query.trim())}>
            <Icon name="send" size={16} /> {busy ? "正在提交…" : "运行研究任务"}
          </button>
        </div>
      </section>

      <section className="examples">
        <button className="examples-toggle" onClick={() => setShowExamples(!showExamples)} aria-expanded={showExamples}>
          <span>
            <span className="mini-spark">
              <Icon name="spark" size={15} />
            </span>{" "}
            不知道从哪里开始？试试这些问题
          </span>
          <span className={showExamples ? "chevron open" : "chevron"}>
            <Icon name="chevron" size={16} />
          </span>
        </button>
        {showExamples && (
          <div className="example-grid">
            {cards.map((example, index) => (
              <button key={example.title} onClick={() => setQuery(example.query)} title={example.hint}>
                <span className="example-index">0{index + 1}</span>
                <span>
                  <b className="zh-example-title">{example.title}</b>
                  <span className="zh-example-hint">{example.hint}</span>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="capabilities">
        <div className="section-heading">
          <div>
            <h2>从数据到结论，一站完成</h2>
          </div>
        </div>
        <div className="ability-grid">
          {abilities.map((item) => (
            <article key={item.title}>
              <div className="ability-top">
                <div className="ability-icon">
                  <Icon name={item.icon} size={21} />
                </div>
                <span>{item.tag}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <footer>
        <span>AI 生成内容仅供研究参考，不构成任何投资建议</span>
        <span>数据来自公开行情源，模拟数据会明确标注</span>
      </footer>
    </div>
  );
}
