import { useMemo, useState } from "react";

type IconName =
  | "spark"
  | "plus"
  | "chat"
  | "file"
  | "clock"
  | "settings"
  | "search"
  | "compare"
  | "chart"
  | "shield"
  | "report"
  | "arrow"
  | "chevron"
  | "send"
  | "more"
  | "download"
  | "copy"
  | "bookmark"
  | "close";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    spark: (
      <>
        <path d="M12 3l1.35 4.65L18 9l-4.65 1.35L12 15l-1.35-4.65L6 9l4.65-1.35L12 3Z" />
        <path d="M5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7L5 15Z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    chat: <path d="M20 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v8Z" />,
    file: (
      <>
        <path d="M6 2h9l4 4v16H6V2Z" />
        <path d="M14 2v5h5M9 12h6M9 16h6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.4v-4h.09A1.7 1.7 0 0 0 4.2 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.6 4.2a1.7 1.7 0 0 0 1-.6A1.7 1.7 0 0 0 10 2.5v-.1h4v.09a1.7 1.7 0 0 0 1 1.71 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8.6a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.09a1.7 1.7 0 0 0-1.71 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </>
    ),
    compare: (
      <>
        <path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    shield: <path d="M12 2 20 5v6c0 5.2-3.4 9.2-8 11-4.6-1.8-8-5.8-8-11V5l8-3Z" />,
    report: (
      <>
        <path d="M5 3h14v18H5V3Z" />
        <path d="M8 15l3-3 2 2 3-4M8 7h8" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    chevron: <path d="m7 10 5 5 5-5" />,
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4 20-7Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5" />
        <path d="M4 19h16" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const examples = [
  "比较贵州茅台和五粮液近三年的营收、利润和估值表现",
  "分析宁德时代过去一年的股价走势与主要风险",
  "生成一份人形机器人行业研究报告",
  "查询沪深300今日行情及领涨、领跌成分股",
];

const abilities = [
  {
    icon: "search" as IconName,
    title: "实时行情查询",
    text: "快速获取股票、指数与市场的最新行情数据",
    tag: "数据",
  },
  {
    icon: "compare" as IconName,
    title: "多股对比分析",
    text: "从业绩、估值、增长与市场表现等维度横向比较",
    tag: "分析",
  },
  {
    icon: "chart" as IconName,
    title: "历史表现洞察",
    text: "追踪长期走势，识别关键节点与变化原因",
    tag: "洞察",
  },
  {
    icon: "shield" as IconName,
    title: "风险评估",
    text: "梳理公司与行业风险，提供结构化风险提示",
    tag: "风控",
  },
  {
    icon: "report" as IconName,
    title: "行业研究报告",
    text: "整合产业链、竞争格局与趋势，生成专业报告",
    tag: "报告",
  },
];

function LoadingResearch({ question }: { question: string }) {
  const steps = [
    "理解问题与确定研究范围",
    "检索市场与公司数据",
    "分析历史表现与估值",
    "生成结论与可视化",
  ];
  return (
    <div className="result-wrap">
      <div className="question-card">
        <span>你的问题</span>
        <h1>{question}</h1>
      </div>
      <section className="loading-panel">
        <div className="research-orbit">
          <span></span>
          <Icon name="spark" size={23} />
        </div>
        <h2>正在进行深度研究</h2>
        <p>知衡正在从多个数据源检索、交叉验证并组织答案，请稍候。</p>
        <div className="research-steps">
          {steps.map((step, index) => (
            <div className={index === 0 ? "research-step active" : "research-step"} key={step}>
              <span>{index === 0 ? <i></i> : index + 1}</span>
              <b>{step}</b>
              {index === 0 && <small>进行中</small>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrendChart() {
  return (
    <div className="chart-area">
      <div className="chart-ylabels">
        <span>60%</span>
        <span>40%</span>
        <span>20%</span>
        <span>0%</span>
        <span>-20%</span>
      </div>
      <svg
        viewBox="0 0 700 220"
        preserveAspectRatio="none"
        role="img"
        aria-label="两家公司近三年股价累计收益走势"
      >
        <defs>
          <linearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4c9270" stopOpacity=".19" />
            <stop offset="1" stopColor="#4c9270" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[22, 66, 110, 154, 198].map((y) => (
          <line key={y} x1="0" y1={y} x2="700" y2={y} className="grid-line" />
        ))}
        <path
          className="chart-fill"
          d="M0,172 C40,157 58,142 95,149 S158,118 198,126 S258,82 298,97 S356,74 397,62 S458,86 498,54 S555,47 596,35 S655,49 700,22 L700,220 L0,220 Z"
        />
        <path
          className="line-a"
          d="M0,172 C40,157 58,142 95,149 S158,118 198,126 S258,82 298,97 S356,74 397,62 S458,86 498,54 S555,47 596,35 S655,49 700,22"
        />
        <path
          className="line-b"
          d="M0,172 C48,185 70,164 110,169 S172,145 215,151 S272,137 317,143 S377,129 420,138 S487,117 532,125 S596,102 640,111 S681,95 700,99"
        />
        <circle cx="700" cy="22" r="4" className="dot-a" />
        <circle cx="700" cy="99" r="4" className="dot-b" />
      </svg>
      <div className="chart-xlabels">
        <span>2022 Q2</span>
        <span>2023 Q1</span>
        <span>2023 Q4</span>
        <span>2024 Q3</span>
        <span>2025 Q1</span>
      </div>
    </div>
  );
}

function CatlTrendChart() {
  return (
    <div className="chart-area catl-chart">
      <div className="chart-ylabels">
        <span>320</span>
        <span>280</span>
        <span>240</span>
        <span>200</span>
        <span>160</span>
      </div>
      <svg
        viewBox="0 0 700 220"
        preserveAspectRatio="none"
        role="img"
        aria-label="宁德时代过去一年股价走势"
      >
        <defs>
          <linearGradient id="catlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#397c67" stopOpacity=".22" />
            <stop offset="1" stopColor="#397c67" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[22, 66, 110, 154, 198].map((y) => (
          <line key={y} x1="0" y1={y} x2="700" y2={y} className="grid-line" />
        ))}
        <path
          className="catl-fill"
          d="M0,170 C35,186 62,164 96,172 S150,148 185,157 S235,120 270,132 S320,101 355,112 S410,72 445,85 S495,55 530,69 S580,39 620,52 S670,30 700,42 L700,220 L0,220 Z"
        />
        <path
          className="catl-line"
          d="M0,170 C35,186 62,164 96,172 S150,148 185,157 S235,120 270,132 S320,101 355,112 S410,72 445,85 S495,55 530,69 S580,39 620,52 S670,30 700,42"
        />
        <line x1="0" y1="110" x2="700" y2="110" className="benchmark-line" />
        <circle cx="700" cy="42" r="4" className="dot-a" />
      </svg>
      <div className="chart-xlabels">
        <span>2024.05</span>
        <span>2024.08</span>
        <span>2024.11</span>
        <span>2025.02</span>
        <span>2025.05</span>
      </div>
    </div>
  );
}

function CatlResearchResult({
  question,
  onOpenReport,
}: {
  question: string;
  onOpenReport: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  return (
    <div className="result-wrap">
      <div className="result-breadcrumb">
        <span>当前对话</span>
        <b>/</b>
        <span>个股走势与风险</span>
      </div>
      <div className="question-card compact">
        <div>
          <span>你的问题</span>
          <h1>{question}</h1>
        </div>
        <button aria-label="更多操作">
          <Icon name="more" size={18} />
        </button>
      </div>

      <section className="answer">
        <div className="answer-head">
          <div className="ai-mark">
            <Icon name="spark" size={18} />
          </div>
          <div>
            <b>知衡研究助手</b>
            <span>已完成 · 用时 38 秒 · 15 个数据源</span>
          </div>
          <div className="answer-actions">
            <button
              onClick={() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            >
              <Icon name="copy" size={15} />
              {copied ? "已复制" : "复制"}
            </button>
            <button className={saved ? "saved" : ""} onClick={() => setSaved(!saved)}>
              <Icon name="bookmark" size={15} />
              {saved ? "已收藏" : "收藏"}
            </button>
          </div>
        </div>

        <div className="summary-card catl-summary">
          <span className="summary-label">核心结论</span>
          <p>
            <strong>宁德时代过去一年股价总体呈震荡上行，累计涨幅约 42%，明显跑赢创业板指。</strong>
            上涨主要由储能需求高增、海外订单兑现和盈利韧性驱动；但当前估值已回到近三年中枢上方，后续表现将更依赖出货增速和单位盈利。需重点关注全球电动车需求、海外政策、价格竞争与技术路线变化。
          </p>
          <div className="confidence">
            <span>
              <i style={{ width: "91%" }}></i>
            </span>
            结论置信度 91%
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>01</span>
            <div>
              <h2>一年市场表现</h2>
              <p>2024年5月20日至2025年5月20日，前复权</p>
            </div>
            <small>数据截至 2025.05.20</small>
          </div>
          <div className="metric-row catl-metrics">
            <div>
              <span>最新收盘价</span>
              <strong>268.40</strong>
              <small>人民币 / 股</small>
            </div>
            <div>
              <span>一年累计涨幅</span>
              <strong className="positive">+42.3%</strong>
              <small>创业板指 +18.7%</small>
            </div>
            <div>
              <span>区间最大回撤</span>
              <strong className="negative">-18.6%</strong>
              <small>发生于 2024 年 8 月</small>
            </div>
            <div>
              <span>滚动市盈率</span>
              <strong>25.8×</strong>
              <small>近三年分位 67%</small>
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-head">
              <div className="legend">
                <span className="legend-a"></span>宁德时代 <b>+42.3%</b>
                <span className="benchmark-key"></span>一年均价
              </div>
              <button>
                近 1 年 <Icon name="chevron" size={13} />
              </button>
            </div>
            <CatlTrendChart />
          </div>
          <div className="chart-insight">
            <Icon name="spark" size={16} />
            <p>
              <b>走势解读</b>
              股价在 2024 年三季度完成筑底，四季度随储能订单和盈利预期改善上行；2025
              年以来涨速放缓，市场开始从估值修复转向验证基本面增速。
            </p>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>02</span>
            <div>
              <h2>关键阶段与驱动因素</h2>
              <p>将股价变化与经营及行业事件对应</p>
            </div>
          </div>
          <div className="event-timeline">
            <article>
              <time>2024.06—08</time>
              <span className="down"></span>
              <div>
                <h3>需求预期承压，股价阶段调整</h3>
                <p>欧洲电动车销量放缓与产业链价格压力引发盈利担忧，区间最大回撤约 18.6%。</p>
              </div>
            </article>
            <article>
              <time>2024.09—12</time>
              <span className="up"></span>
              <div>
                <h3>储能高增长推动估值修复</h3>
                <p>储能出货与海外项目进展超预期，叠加成本改善，市场上调全年盈利预测。</p>
              </div>
            </article>
            <article>
              <time>2025.01—05</time>
              <span className="up"></span>
              <div>
                <h3>盈利韧性确认，进入高位震荡</h3>
                <p>年报和一季报验证利润韧性，但估值提升后，股价对订单和政策变化更敏感。</p>
              </div>
            </article>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>03</span>
            <div>
              <h2>主要风险矩阵</h2>
              <p>按发生概率与潜在影响综合排序</p>
            </div>
          </div>
          <div className="risk-grid catl-risks">
            <article>
              <span className="risk-level high">高影响</span>
              <h3>海外政策与贸易壁垒</h3>
              <p>欧美本地化政策、关税及供应链审查可能影响海外扩张节奏与项目回报。</p>
              <small>发生概率：中高</small>
            </article>
            <article>
              <span className="risk-level high">高影响</span>
              <h3>行业价格竞争</h3>
              <p>电池产能供给充足，若价格降幅超过成本改善，单位盈利可能承压。</p>
              <small>发生概率：高</small>
            </article>
            <article>
              <span className="risk-level mid">中影响</span>
              <h3>终端需求波动</h3>
              <p>全球新能源汽车销量若低于预期，将影响动力电池产能利用率。</p>
              <small>发生概率：中</small>
            </article>
            <article>
              <span className="risk-level mid">中影响</span>
              <h3>技术路线迭代</h3>
              <p>固态电池等新路线若加速商业化，可能提高研发投入和资产更新压力。</p>
              <small>发生概率：中低</small>
            </article>
          </div>
        </div>

        <div className="report-cta catl-report">
          <div className="report-cover">
            <span>ZH</span>
            <small>
              EQUITY
              <br />
              RESEARCH
            </small>
            <b>
              宁德时代
              <br />
              个股研究
            </b>
            <i>2025.05</i>
          </div>
          <div className="report-info">
            <span>已生成完整报告</span>
            <h2>宁德时代：走势复盘、盈利驱动与风险评估</h2>
            <p>共 16 页，包含股价复盘、业绩拆解、行业景气、估值区间与风险情景分析。</p>
            <div>
              <small>PDF · 3.9 MB</small>
              <small>生成于 10:42</small>
            </div>
          </div>
          <div className="report-buttons">
            <button onClick={onOpenReport}>
              阅读报告 <Icon name="arrow" size={15} />
            </button>
            <button aria-label="下载报告" onClick={() => downloadReport("catl")}>
              <Icon name="download" size={17} />
            </button>
          </div>
        </div>

        <div className="sources">
          <button onClick={() => setSourcesOpen(!sourcesOpen)}>
            <Icon name="chevron" size={14} /> 查看 15 个参考数据源
          </button>
          <span>数据更新至 2025年5月20日</span>
        </div>
        {sourcesOpen && (
          <div className="source-list">
            {[
              "宁德时代 2024 年年度报告",
              "宁德时代 2025 年第一季度报告",
              "深圳证券交易所公开行情",
              "中国汽车动力电池产业创新联盟",
            ].map((source, index) => (
              <div key={source}>
                <span>{index + 1}</span>
                <b>{source}</b>
                <small>已交叉验证</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Csi300IntradayChart() {
  return (
    <div className="intraday-chart">
      <div className="intraday-y">
        <span>3,980</span>
        <span>3,950</span>
        <span>3,920</span>
        <span>3,890</span>
      </div>
      <svg
        viewBox="0 0 700 210"
        preserveAspectRatio="none"
        role="img"
        aria-label="沪深300今日分时走势"
      >
        <defs>
          <linearGradient id="indexFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c55b50" stopOpacity=".2" />
            <stop offset="1" stopColor="#c55b50" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 75, 130, 185].map((y) => (
          <line key={y} x1="0" y1={y} x2="700" y2={y} className="grid-line" />
        ))}
        <path
          className="index-fill"
          d="M0,151 C25,143 40,154 62,136 S105,117 128,126 S170,105 192,116 S228,88 252,97 S294,80 318,89 S356,55 382,67 S425,48 450,57 S490,78 515,61 S558,46 585,53 S625,30 650,41 S680,23 700,28 L700,210 L0,210 Z"
        />
        <path
          className="index-line"
          d="M0,151 C25,143 40,154 62,136 S105,117 128,126 S170,105 192,116 S228,88 252,97 S294,80 318,89 S356,55 382,67 S425,48 450,57 S490,78 515,61 S558,46 585,53 S625,30 650,41 S680,23 700,28"
        />
        <line x1="0" y1="151" x2="700" y2="151" className="prev-close-line" />
        <circle cx="700" cy="28" r="4" className="index-dot" />
      </svg>
      <div className="intraday-x">
        <span>09:30</span>
        <span>10:30</span>
        <span>11:30/13:00</span>
        <span>14:00</span>
        <span>15:00</span>
      </div>
    </div>
  );
}

function Csi300ResearchResult({
  question,
  onOpenReport,
}: {
  question: string;
  onOpenReport: () => void;
}) {
  const [activeStockTab, setActiveStockTab] = useState<"gainers" | "losers">("gainers");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const gainers = [
    ["中际旭创", "300308", "168.42", "+8.76%", "142.6亿"],
    ["新易盛", "300502", "126.80", "+7.32%", "98.4亿"],
    ["阳光电源", "300274", "84.51", "+5.69%", "56.2亿"],
    ["工业富联", "601138", "23.96", "+5.18%", "72.8亿"],
    ["北方华创", "002371", "402.10", "+4.86%", "41.5亿"],
  ];
  const losers = [
    ["中国中免", "601888", "65.24", "-4.37%", "18.9亿"],
    ["海天味业", "603288", "39.70", "-3.61%", "12.4亿"],
    ["牧原股份", "002714", "40.18", "-3.22%", "20.7亿"],
    ["伊利股份", "600887", "27.61", "-2.88%", "16.3亿"],
    ["中国国航", "601111", "7.16", "-2.45%", "9.8亿"],
  ];
  const stocks = activeStockTab === "gainers" ? gainers : losers;
  return (
    <div className="result-wrap market-result">
      <div className="result-breadcrumb">
        <span>当前对话</span>
        <b>/</b>
        <span>市场行情快报</span>
      </div>
      <div className="question-card compact">
        <div>
          <span>你的问题</span>
          <h1>{question}</h1>
        </div>
        <div className="market-live">
          <i></i>
          已收盘
        </div>
      </div>

      <section className="answer">
        <div className="answer-head">
          <div className="ai-mark market-mark">
            <Icon name="chart" size={18} />
          </div>
          <div>
            <b>知衡市场快报</b>
            <span>已更新 · 2025年5月20日 15:10 · 实时行情</span>
          </div>
          <div className="answer-actions">
            <button>
              <Icon name="copy" size={15} /> 复制
            </button>
            <button onClick={() => window.print()}>
              <Icon name="download" size={15} /> 导出
            </button>
          </div>
        </div>

        <div className="index-hero">
          <div className="index-main">
            <span>
              沪深300 <small>000300.SH</small>
            </span>
            <strong>3,972.16</strong>
            <p>
              <em>+42.68</em>
              <b>+1.09%</b>
            </p>
          </div>
          <div className="index-stat">
            <span>
              今开<strong>3,931.20</strong>
            </span>
            <span>
              最高<strong>3,978.45</strong>
            </span>
            <span>
              最低<strong>3,918.76</strong>
            </span>
            <span>
              成交额<strong>4,186 亿</strong>
            </span>
          </div>
          <div className="market-tone">
            <span>市场情绪</span>
            <strong>偏强</strong>
            <div>
              <i style={{ width: "72%" }}></i>
            </div>
            <small>72 / 100</small>
          </div>
        </div>

        <div className="market-summary">
          <Icon name="spark" size={17} />
          <p>
            <b>收盘简评</b>
            沪深300 今日低开高走，收涨 1.09%。AI
            算力、半导体设备和光伏设备领涨，食品饮料与出行板块承压。北向及机构资金偏好大市值成长方向，全天成交较前一交易日放大
            8.6%。
          </p>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>01</span>
            <div>
              <h2>今日分时走势</h2>
              <p>沪深300 指数，2025年5月20日</p>
            </div>
            <div className="market-legend">
              <span></span>指数
              <i></i>昨收
            </div>
          </div>
          <div className="chart-card intraday-card">
            <Csi300IntradayChart />
          </div>
          <div className="session-points">
            <div>
              <time>09:30</time>
              <b>低开 -0.28%</b>
              <p>消费权重走弱，指数小幅低开。</p>
            </div>
            <div>
              <time>10:18</time>
              <b>算力板块拉升</b>
              <p>光模块与服务器权重股快速上涨。</p>
            </div>
            <div>
              <time>14:26</time>
              <b>突破日内高点</b>
              <p>半导体与新能源共振，指数扩大涨幅。</p>
            </div>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>02</span>
            <div>
              <h2>市场宽度</h2>
              <p>300 只指数成分股涨跌分布</p>
            </div>
          </div>
          <div className="breadth-card">
            <div className="breadth-numbers">
              <span>
                <strong>198</strong>上涨
              </span>
              <span>
                <strong>9</strong>平盘
              </span>
              <span>
                <strong>93</strong>下跌
              </span>
            </div>
            <div className="breadth-bar">
              <i style={{ width: "66%" }}></i>
              <i style={{ width: "3%" }}></i>
              <i style={{ width: "31%" }}></i>
            </div>
            <div className="breadth-detail">
              <span>
                涨停 <b>3</b>
              </span>
              <span>
                涨幅超 5% <b>14</b>
              </span>
              <span>
                跌幅超 5% <b>2</b>
              </span>
              <span>
                中位数涨幅 <b className="up-text">+0.62%</b>
              </span>
            </div>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title stock-title">
            <span>03</span>
            <div>
              <h2>领涨与领跌成分股</h2>
              <p>按今日涨跌幅排序</p>
            </div>
            <div className="stock-tabs">
              <button
                className={activeStockTab === "gainers" ? "active" : ""}
                onClick={() => setActiveStockTab("gainers")}
              >
                领涨
              </button>
              <button
                className={activeStockTab === "losers" ? "active" : ""}
                onClick={() => setActiveStockTab("losers")}
              >
                领跌
              </button>
            </div>
          </div>
          <div className="stock-table">
            <div className="stock-table-head">
              <span>名称 / 代码</span>
              <span>收盘价</span>
              <span>涨跌幅</span>
              <span>成交额</span>
            </div>
            {stocks.map((stock, index) => (
              <div key={stock[0]}>
                <span>
                  <i>{index + 1}</i>
                  <b>{stock[0]}</b>
                  <small>{stock[1]}</small>
                </span>
                <span>{stock[2]}</span>
                <span className={activeStockTab === "gainers" ? "stock-up" : "stock-down"}>
                  {stock[3]}
                </span>
                <span>{stock[4]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>04</span>
            <div>
              <h2>行业表现</h2>
              <p>沪深300 成分股按申万一级行业聚合</p>
            </div>
          </div>
          <div className="sector-performance">
            {[
              ["通信", "+3.82%", 92, "up"],
              ["电子", "+2.76%", 76, "up"],
              ["电力设备", "+2.14%", 63, "up"],
              ["汽车", "+1.47%", 48, "up"],
              ["食品饮料", "-0.68%", 22, "down"],
              ["交通运输", "-1.12%", 35, "down"],
            ].map(([name, change, width, tone]) => (
              <div key={name}>
                <span>{name}</span>
                <div>
                  <i className={tone} style={{ width: `${width}%` }}></i>
                </div>
                <b className={tone === "up" ? "stock-up" : "stock-down"}>{change}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="report-cta market-report">
          <div className="report-cover">
            <span>ZH</span>
            <small>
              MARKET
              <br />
              DAILY
            </small>
            <b>
              沪深300
              <br />
              每日收盘快报
            </b>
            <i>2025.05.20</i>
          </div>
          <div className="report-info">
            <span>今日市场报告已生成</span>
            <h2>沪深300 收盘快报｜2025年5月20日</h2>
            <p>共 8 页，包含指数复盘、资金特征、成分股排名、行业表现与次日关注。</p>
            <div>
              <small>PDF · 2.1 MB</small>
              <small>生成于 15:10</small>
            </div>
          </div>
          <div className="report-buttons">
            <button onClick={onOpenReport}>
              阅读报告 <Icon name="arrow" size={15} />
            </button>
            <button aria-label="下载报告" onClick={() => downloadReport("csi300")}>
              <Icon name="download" size={17} />
            </button>
          </div>
        </div>

        <div className="sources">
          <button onClick={() => setSourcesOpen(!sourcesOpen)}>
            <Icon name="chevron" size={14} /> 查看 6 个行情数据源
          </button>
          <span>行情延迟不超过 15 分钟</span>
        </div>
        {sourcesOpen && (
          <div className="source-list">
            {[
              "上海证券交易所行情数据",
              "深圳证券交易所行情数据",
              "中证指数有限公司",
              "申万行业分类数据",
            ].map((source, index) => (
              <div key={source}>
                <span>{index + 1}</span>
                <b>{source}</b>
                <small>已交叉验证</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HumanoidResearchResult({
  question,
  onOpenReport,
}: {
  question: string;
  onOpenReport: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  return (
    <div className="result-wrap industry-result">
      <div className="result-breadcrumb">
        <span>当前对话</span>
        <b>/</b>
        <span>行业深度研究</span>
      </div>
      <div className="question-card compact">
        <div>
          <span>你的问题</span>
          <h1>{question}</h1>
        </div>
        <button aria-label="更多操作">
          <Icon name="more" size={18} />
        </button>
      </div>

      <section className="answer">
        <div className="answer-head">
          <div className="ai-mark robot-mark">
            <Icon name="report" size={18} />
          </div>
          <div>
            <b>知衡行业研究</b>
            <span>已完成 · 用时 1分24秒 · 28 个数据源</span>
          </div>
          <div className="answer-actions">
            <button>
              <Icon name="copy" size={15} /> 复制
            </button>
            <button className={saved ? "saved" : ""} onClick={() => setSaved(!saved)}>
              <Icon name="bookmark" size={15} />
              {saved ? "已收藏" : "收藏"}
            </button>
          </div>
        </div>

        <div className="industry-hero-card">
          <div>
            <span>INDUSTRY OUTLOOK · 2025</span>
            <h2>人形机器人正从技术验证走向小规模量产</h2>
            <p>
              2025—2027 年是产业化关键窗口。AI
              模型、灵巧手与执行器成本下降共同推动产品成熟，汽车制造、仓储物流和危险作业将成为首批规模化场景。
            </p>
          </div>
          <div className="industry-score">
            <span>行业景气度</span>
            <strong>8.4</strong>
            <small>/ 10</small>
            <i>积极</i>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>01</span>
            <div>
              <h2>市场空间与增长预测</h2>
              <p>全球人形机器人市场规模预测，单位：亿美元</p>
            </div>
            <small>预测期 2025—2030E</small>
          </div>
          <div className="industry-metrics">
            <div>
              <span>2030E 市场规模</span>
              <strong>1,680</strong>
              <em>亿美元</em>
            </div>
            <div>
              <span>五年复合增速</span>
              <strong>68%</strong>
              <em>CAGR</em>
            </div>
            <div>
              <span>2030E 全球出货</span>
              <strong>82</strong>
              <em>万台</em>
            </div>
          </div>
          <div className="market-forecast">
            <div className="forecast-bars">
              {[
                ["2025E", 8, "42"],
                ["2026E", 16, "86"],
                ["2027E", 29, "210"],
                ["2028E", 46, "480"],
                ["2029E", 68, "920"],
                ["2030E", 100, "1,680"],
              ].map(([year, height, value]) => (
                <div key={year}>
                  <span>{value}</span>
                  <i style={{ height: `${height}%` }}></i>
                  <small>{year}</small>
                </div>
              ))}
            </div>
            <div className="forecast-note">
              <Icon name="spark" size={16} />
              <p>
                <b>核心判断</b>
                量产节奏将呈非线性增长。2027
                年前以工厂试点和数据采集为主，执行器与灵巧手成本下降后，商业化有望明显加速。
              </p>
            </div>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>02</span>
            <div>
              <h2>产业链价值分布</h2>
              <p>核心零部件是当前价值量与技术壁垒最高的环节</p>
            </div>
          </div>
          <div className="value-chain">
            <article>
              <span>上游 · 核心零部件</span>
              <strong>价值占比约 55%</strong>
              <div>
                <b>减速器</b>
                <b>伺服系统</b>
                <b>丝杠</b>
                <b>传感器</b>
                <b>灵巧手</b>
              </div>
              <p>技术壁垒高、验证周期长，是国产供应链最具弹性的环节。</p>
            </article>
            <Icon name="arrow" size={18} />
            <article>
              <span>中游 · 本体制造</span>
              <strong>价值占比约 30%</strong>
              <div>
                <b>结构设计</b>
                <b>运动控制</b>
                <b>系统集成</b>
              </div>
              <p>整机厂负责软硬件协同，量产能力和场景数据构成核心壁垒。</p>
            </article>
            <Icon name="arrow" size={18} />
            <article>
              <span>下游 · 应用场景</span>
              <strong>价值占比约 15%</strong>
              <div>
                <b>汽车制造</b>
                <b>仓储物流</b>
                <b>商业服务</b>
              </div>
              <p>率先落地于结构化场景，长期向家庭和通用服务扩展。</p>
            </article>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>03</span>
            <div>
              <h2>竞争格局与代表企业</h2>
              <p>全球科技公司与中国制造供应链并行推进</p>
            </div>
          </div>
          <div className="company-landscape">
            <div className="landscape-head">
              <span>企业 / 项目</span>
              <span>技术定位</span>
              <span>当前阶段</span>
              <span>核心优势</span>
            </div>
            {[
              ["Tesla Optimus", "通用人形机器人", "工厂试用", "AI 与整车供应链"],
              ["Figure AI", "具身智能平台", "客户试点", "大模型与资本生态"],
              ["宇树科技", "高运动性能本体", "小批量交付", "成本与运动控制"],
              ["优必选", "工业人形机器人", "多工厂实训", "场景落地与集成"],
              ["智元机器人", "通用具身智能", "量产导入", "软硬件全栈能力"],
            ].map((company, index) => (
              <div key={company[0]}>
                <span>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <b>{company[0]}</b>
                </span>
                <span>{company[1]}</span>
                <span>
                  <em>{company[2]}</em>
                </span>
                <span>{company[3]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>04</span>
            <div>
              <h2>关键催化与主要风险</h2>
              <p>未来 12—24 个月产业跟踪框架</p>
            </div>
          </div>
          <div className="catalyst-risk-grid">
            <div className="catalyst-column">
              <h3>
                <span>+</span> 关键催化
              </h3>
              <article>
                <b>头部厂商量产进度超预期</b>
                <p>Tesla、Figure 等企业扩大工厂试用和订单规模。</p>
              </article>
              <article>
                <b>核心零部件成本快速下降</b>
                <p>丝杠、减速器、传感器国产化率提升，整机成本下探。</p>
              </article>
              <article>
                <b>具身智能模型能力突破</b>
                <p>端到端模型提升机器人泛化能力，减少场景训练成本。</p>
              </article>
            </div>
            <div className="risk-column">
              <h3>
                <span>!</span> 主要风险
              </h3>
              <article>
                <b>商业化进度不及预期</b>
                <p>可靠性、安全性和投资回报率可能限制客户采购。</p>
              </article>
              <article>
                <b>技术路线快速迭代</b>
                <p>零部件方案尚未收敛，早期投资存在被替代风险。</p>
              </article>
              <article>
                <b>估值与业绩错配</b>
                <p>部分公司主题估值较高，短期收入贡献仍然有限。</p>
              </article>
            </div>
          </div>
        </div>

        <div className="report-cta robotics-report">
          <div className="report-cover">
            <span>ZH</span>
            <small>
              INDUSTRY
              <br />
              RESEARCH
            </small>
            <b>
              人形机器人
              <br />
              行业深度
            </b>
            <i>2025.05</i>
          </div>
          <div className="report-info">
            <span>行业报告已生成</span>
            <h2>人形机器人：从技术验证到量产前夜</h2>
            <p>共 32 页，包含市场测算、产业链拆解、竞争格局、核心公司与风险情景。</p>
            <div>
              <small>PDF · 7.2 MB</small>
              <small>生成于 16:20</small>
            </div>
          </div>
          <div className="report-buttons">
            <button onClick={onOpenReport}>
              阅读报告 <Icon name="arrow" size={15} />
            </button>
            <button aria-label="下载报告" onClick={() => downloadReport("robotics")}>
              <Icon name="download" size={17} />
            </button>
          </div>
        </div>

        <div className="sources">
          <button onClick={() => setSourcesOpen(!sourcesOpen)}>
            <Icon name="chevron" size={14} /> 查看 28 个参考数据源
          </button>
          <span>数据更新至 2025年5月20日</span>
        </div>
        {sourcesOpen && (
          <div className="source-list">
            {[
              "工信部《人形机器人创新发展指导意见》",
              "高工机器人产业研究所",
              "Tesla 2025 Q1 Earnings Call",
              "IFR World Robotics Report",
            ].map((source, index) => (
              <div key={source}>
                <span>{index + 1}</span>
                <b>{source}</b>
                <small>已交叉验证</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function downloadReport(topic: "comparison" | "catl" | "robotics" | "csi300" = "comparison") {
  const report =
    topic === "csi300"
      ? `知衡研究｜沪深300 收盘快报｜2025年5月20日

今日收盘
沪深300 收于 3,972.16 点，上涨 1.09%。AI 算力、半导体设备与光伏设备领涨，食品饮料和交通运输板块承压。

本报告由知衡研究助手生成，仅供研究参考，不构成投资建议。`
      : topic === "robotics"
        ? `知衡研究｜人形机器人：从技术验证到量产前夜

核心结论
2025—2027 年是人形机器人产业化关键窗口，核心零部件国产化、具身智能模型进步与头部厂商量产将成为主要驱动。

本报告由知衡研究助手生成，仅供研究参考，不构成投资建议。`
        : topic === "catl"
          ? `知衡研究｜宁德时代：走势复盘、盈利驱动与风险评估

核心结论
宁德时代过去一年股价总体呈震荡上行，储能需求、海外订单与盈利韧性是主要驱动。需重点关注海外政策、价格竞争、终端需求及技术路线变化。

本报告由知衡研究助手生成，仅供研究参考，不构成投资建议。`
          : `知衡研究｜贵州茅台与五粮液对比研究

核心结论
贵州茅台在盈利能力、增长稳定性和股东回报方面保持领先，五粮液估值更低，具备更强的修复弹性。

本报告由知衡研究助手生成，仅供研究参考，不构成投资建议。`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
  link.download =
    topic === "csi300"
      ? "沪深300每日收盘快报.txt"
      : topic === "robotics"
        ? "人形机器人行业深度研究.txt"
        : topic === "catl"
          ? "宁德时代走势与风险研究.txt"
          : "贵州茅台与五粮液对比研究.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

function ResearchResult({
  question,
  onOpenReport,
}: {
  question: string;
  onOpenReport: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [period, setPeriod] = useState("近 3 年");
  const copy = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="result-wrap">
      <div className="result-breadcrumb">
        <span>当前对话</span>
        <b>/</b>
        <span>公司对比研究</span>
      </div>
      <div className="question-card compact">
        <div>
          <span>你的问题</span>
          <h1>{question}</h1>
        </div>
        <button aria-label="更多操作">
          <Icon name="more" size={18} />
        </button>
      </div>

      <section className="answer">
        <div className="answer-head">
          <div className="ai-mark">
            <Icon name="spark" size={18} />
          </div>
          <div>
            <b>知衡研究助手</b>
            <span>已完成 · 用时 42 秒 · 12 个数据源</span>
          </div>
          <div className="answer-actions">
            <button onClick={copy}>
              <Icon name="copy" size={15} />
              {copied ? "已复制" : "复制"}
            </button>
            <button className={saved ? "saved" : ""} onClick={() => setSaved(!saved)}>
              <Icon name="bookmark" size={15} />
              {saved ? "已收藏" : "收藏"}
            </button>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-label">核心结论</span>
          <p>
            <strong>贵州茅台在盈利能力、增长稳定性和股东回报方面保持领先，</strong>
            五粮液的估值更低，短期弹性更强。过去三年，两家公司营收均保持增长，但茅台利润增速更快、毛利率更高；若重视经营确定性，茅台更具优势，若关注估值修复空间，五粮液值得跟踪。
          </p>
          <div className="confidence">
            <span>
              <i style={{ width: "88%" }}></i>
            </span>
            结论置信度 88%
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>01</span>
            <div>
              <h2>关键数据对比</h2>
              <p>基于 2024 年度公开财报及最新市场数据</p>
            </div>
            <small>单位：亿元 / 倍</small>
          </div>
          <div className="metric-row">
            <div>
              <span>贵州茅台</span>
              <strong>1,741.4</strong>
              <small>
                营业收入 <em>+15.7%</em>
              </small>
            </div>
            <div>
              <span>贵州茅台</span>
              <strong>862.3</strong>
              <small>
                归母净利润 <em>+15.4%</em>
              </small>
            </div>
            <div>
              <span>五粮液</span>
              <strong>891.8</strong>
              <small>
                营业收入 <em>+7.1%</em>
              </small>
            </div>
            <div>
              <span>五粮液</span>
              <strong>318.5</strong>
              <small>
                归母净利润 <em>+5.8%</em>
              </small>
            </div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>核心指标</th>
                  <th>贵州茅台</th>
                  <th>五粮液</th>
                  <th>领先方</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>三年营收复合增速</td>
                  <td>17.2%</td>
                  <td>10.6%</td>
                  <td>
                    <span className="winner">贵州茅台</span>
                  </td>
                </tr>
                <tr>
                  <td>销售毛利率</td>
                  <td>92.1%</td>
                  <td>75.8%</td>
                  <td>
                    <span className="winner">贵州茅台</span>
                  </td>
                </tr>
                <tr>
                  <td>净资产收益率 ROE</td>
                  <td>36.4%</td>
                  <td>24.8%</td>
                  <td>
                    <span className="winner">贵州茅台</span>
                  </td>
                </tr>
                <tr>
                  <td>滚动市盈率 PE-TTM</td>
                  <td>24.6×</td>
                  <td>17.2×</td>
                  <td>
                    <span className="value-tag">五粮液估值更低</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>02</span>
            <div>
              <h2>市场表现与趋势</h2>
              <p>股价累计收益（前复权），对比基准日 = 0%</p>
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-head">
              <div className="legend">
                <span className="legend-a"></span>贵州茅台 <b>+48.7%</b>
                <span className="legend-b"></span>五粮液 <b>+18.4%</b>
              </div>
              <button onClick={() => setPeriod(period === "近 3 年" ? "近 1 年" : "近 3 年")}>
                {period} <Icon name="chevron" size={13} />
              </button>
            </div>
            <TrendChart />
          </div>
          <div className="chart-insight">
            <Icon name="spark" size={16} />
            <p>
              <b>图表洞察</b> 茅台在 2023
              年后明显跑赢五粮液，主要由更高的业绩增速和确定性溢价驱动。五粮液波动率更高，对消费复苏预期更敏感。
            </p>
          </div>
        </div>

        <div className="result-section">
          <div className="result-title">
            <span>03</span>
            <div>
              <h2>风险与关注点</h2>
              <p>投资决策中需要持续跟踪的关键变量</p>
            </div>
          </div>
          <div className="risk-grid">
            <article>
              <span className="risk-level high">较高</span>
              <h3>需求与价格风险</h3>
              <p>高端白酒商务消费恢复不及预期，批价波动可能影响渠道信心。</p>
            </article>
            <article>
              <span className="risk-level mid">中等</span>
              <h3>渠道库存压力</h3>
              <p>五粮液渠道库存相对更高，需关注动销和经销商回款质量。</p>
            </article>
            <article>
              <span className="risk-level low">较低</span>
              <h3>估值波动风险</h3>
              <p>茅台享有确定性溢价，若增长放缓可能面临估值中枢下移。</p>
            </article>
          </div>
        </div>

        <div className="report-cta">
          <div className="report-cover">
            <span>ZH</span>
            <small>
              COMPANY
              <br />
              RESEARCH
            </small>
            <b>
              消费龙头
              <br />
              公司对比研究
            </b>
            <i>2025.05</i>
          </div>
          <div className="report-info">
            <span>已生成完整报告</span>
            <h2>贵州茅台与五粮液对比研究</h2>
            <p>共 18 页，包含公司概览、财务分析、估值对比、行业趋势与风险提示。</p>
            <div>
              <small>PDF · 4.8 MB</small>
              <small>生成于 10:42</small>
            </div>
          </div>
          <div className="report-buttons">
            <button onClick={onOpenReport}>
              阅读报告 <Icon name="arrow" size={15} />
            </button>
            <button aria-label="下载报告" onClick={downloadReport}>
              <Icon name="download" size={17} />
            </button>
          </div>
        </div>

        <div className="sources">
          <button onClick={() => setSourcesOpen(!sourcesOpen)}>
            <Icon name="chevron" size={14} /> 查看 12 个参考数据源
          </button>
          <span>数据更新至 2025年5月20日</span>
        </div>
        {sourcesOpen && (
          <div className="source-list">
            {[
              "贵州茅台 2024 年年度报告",
              "五粮液 2024 年年度报告",
              "上海证券交易所公开行情",
              "国家统计局消费数据",
            ].map((source, index) => (
              <div key={source}>
                <span>{index + 1}</span>
                <b>{source}</b>
                <small>已交叉验证</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportViewer({
  onClose,
  topic = "comparison",
}: {
  onClose: () => void;
  topic?: "comparison" | "catl" | "robotics" | "csi300";
}) {
  const [activeChapter, setActiveChapter] = useState(0);
  const isCatl = topic === "catl";
  const isRobotics = topic === "robotics";
  const isCsi300 = topic === "csi300";
  return (
    <div className="report-overlay">
      <div className="report-toolbar">
        <button className="report-close" onClick={onClose}>
          <Icon name="close" size={19} />
        </button>
        <div>
          <b>
            {isCsi300
              ? "沪深300 收盘快报｜2025年5月20日"
              : isRobotics
                ? "人形机器人：从技术验证到量产前夜"
                : isCatl
                  ? "宁德时代：走势复盘、盈利驱动与风险评估"
                  : "贵州茅台与五粮液对比研究"}
          </b>
          <span>生成于 2025年5月20日</span>
        </div>
        <div className="report-toolbar-actions">
          <span>1 / 18</span>
          <button onClick={() => downloadReport(topic)}>
            <Icon name="download" size={16} /> 下载 PDF
          </button>
        </div>
      </div>
      <div className="report-reader">
        <aside className="report-outline">
          <span>报告目录</span>
          {[
            "核心观点",
            "01 公司概览",
            "02 财务表现",
            "03 市场与估值",
            "04 行业趋势",
            "05 风险提示",
            "数据附录",
          ].map((item, i) => (
            <button
              className={i === activeChapter ? "active" : ""}
              key={item}
              onClick={() => setActiveChapter(i)}
            >
              {item}
              <small>{i + 1}</small>
            </button>
          ))}
        </aside>
        <div className="report-pages">
          <article className="report-page cover-page">
            <div className="report-brand">
              <span>知衡研究</span>
              <small>ZH RESEARCH</small>
            </div>
            <div className="cover-rule"></div>
            <span className="report-type">
              {isCsi300
                ? "市场快报 · 沪深300"
                : isRobotics
                  ? "行业深度 · 高端制造"
                  : isCatl
                    ? "个股研究 · 新能源"
                    : "公司对比研究 · 食品饮料"}
            </span>
            <h1>
              {isCsi300 ? (
                <>
                  沪深300
                  <br />
                  <em>MARKET DAILY</em>
                </>
              ) : isRobotics ? (
                <>
                  人形机器人
                  <br />
                  <em>HUMANOID ROBOTICS</em>
                </>
              ) : isCatl ? (
                <>
                  宁德时代
                  <br />
                  <em>CATL · 300750</em>
                </>
              ) : (
                <>
                  贵州茅台
                  <br />
                  <em>VS</em> 五粮液
                </>
              )}
            </h1>
            <h2>
              {isCsi300
                ? "每日收盘行情与市场结构复盘"
                : isRobotics
                  ? "从技术验证到量产前夜"
                  : isCatl
                    ? "走势复盘、盈利驱动与风险评估"
                    : "增长确定性与估值弹性的再审视"}
            </h2>
            <div className="cover-meta">
              <div>
                <small>研究日期</small>
                <b>2025年5月20日</b>
              </div>
              <div>
                <small>研究范围</small>
                <b>2022—2025</b>
              </div>
            </div>
            <p>本报告由知衡研究助手生成，仅供研究参考，不构成投资建议。</p>
          </article>
          <article className="report-page content-page">
            <header>
              <span>知衡研究 · 公司研究</span>
              <b>02</b>
            </header>
            <div className="page-kicker">EXECUTIVE SUMMARY</div>
            <h2>核心观点</h2>
            <div className="report-highlight">
              {isCsi300
                ? "沪深300 今日低开高走，收涨 1.09%。AI 算力、半导体设备和光伏设备领涨，市场上涨家数接近三分之二。"
                : isRobotics
                  ? "2025—2027 年是人形机器人产业化关键窗口，AI 模型、核心零部件降本和头部厂商量产将共同驱动行业进入加速期。"
                  : isCatl
                    ? "宁德时代过去一年股价震荡上行，储能需求与盈利韧性是核心驱动；估值修复后，需重点跟踪海外政策、价格竞争与终端需求。"
                    : "贵州茅台凭借品牌壁垒与渠道掌控力，继续维持更高的增长质量；五粮液的低估值则提供了更强的修复弹性。"}
            </div>
            <div className="report-columns">
              <div>
                <b>01</b>
                <h3>
                  {isCsi300
                    ? "指数表现"
                    : isRobotics
                      ? "市场空间"
                      : isCatl
                        ? "市场表现"
                        : "盈利质量"}
                </h3>
                <p>
                  {isCsi300
                    ? "指数收于 3,972.16 点，上涨 1.09%，全天成交额 4,186 亿元。"
                    : isRobotics
                      ? "预计全球市场规模将在 2030 年达到约 1,680 亿美元，五年复合增速约 68%。"
                      : isCatl
                        ? "过去一年累计上涨约 42%，明显跑赢创业板指，四季度后进入估值修复阶段。"
                        : "茅台毛利率与 ROE 持续领先，现金流创造能力突出，业绩可预测性更强。"}
                </p>
              </div>
              <div>
                <b>02</b>
                <h3>{isCsi300 ? "结构特征" : isRobotics ? "产业驱动" : "增长动能"}</h3>
                <p>
                  {isCsi300
                    ? "通信、电子与电力设备领涨，食品饮料和交通运输表现偏弱。"
                    : isRobotics
                      ? "具身智能模型进步、核心零部件国产化和结构化场景需求构成三重驱动。"
                      : isCatl
                        ? "储能业务、海外项目和成本改善共同支撑盈利增长，动力电池份额保持领先。"
                        : "直营渠道占比提升与产品结构升级，为茅台中期增长提供主要支撑。"}
                </p>
              </div>
              <div>
                <b>03</b>
                <h3>{isCsi300 ? "后市关注" : isRobotics || isCatl ? "风险判断" : "估值判断"}</h3>
                <p>
                  {isCsi300
                    ? "关注成交量持续性、成长板块扩散效果及权重消费股能否企稳。"
                    : isRobotics
                      ? "商业化进度、技术路线变化和主题估值与业绩错配是现阶段主要风险。"
                      : isCatl
                        ? "海外政策与行业价格竞争为主要风险，当前估值要求后续业绩持续兑现。"
                        : "五粮液估值已处于历史偏低区间，消费预期改善时向上弹性更显著。"}
                </p>
              </div>
            </div>
            <div className="report-chart-mini">
              <span style={{ height: "54%" }}></span>
              <span style={{ height: "62%" }}></span>
              <span style={{ height: "73%" }}></span>
              <span style={{ height: "83%" }}></span>
              <i></i>
            </div>
            <footer>
              <span>资料来源：公司公告、Wind、知衡研究整理</span>
              <span>ZH RESEARCH</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}

const reportItems = [
  {
    title: "贵州茅台与五粮液对比研究",
    type: "公司研究",
    pages: 18,
    date: "今天 10:42",
    color: "green",
  },
  {
    title: "人形机器人产业链深度报告",
    type: "行业研究",
    pages: 32,
    date: "昨天 16:20",
    color: "blue",
  },
  { title: "2025 新能源汽车行业展望", type: "行业策略", pages: 26, date: "4月18日", color: "gold" },
];

function ReportCenter({
  onOpenReport,
}: {
  onOpenReport: (topic?: "comparison" | "catl" | "robotics") => void;
}) {
  const [filter, setFilter] = useState("全部报告");
  return (
    <div className="workspace-page">
      <div className="workspace-head">
        <div>
          <span>RESEARCH LIBRARY</span>
          <h1>报告中心</h1>
          <p>集中阅读、管理和下载由研究任务生成的完整报告。</p>
        </div>
        <button>
          <Icon name="search" size={16} /> 搜索报告
        </button>
      </div>
      <div className="workspace-tabs">
        {["全部报告", "公司研究", "行业研究", "策略研究"].map((item) => (
          <button
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="report-library">
        {reportItems
          .filter((item) => filter === "全部报告" || item.type === filter)
          .map((item, index) => (
            <article key={item.title}>
              <button
                className={`library-cover ${item.color}`}
                onClick={() =>
                  onOpenReport(item.title.includes("人形机器人") ? "robotics" : "comparison")
                }
              >
                <span>ZH RESEARCH</span>
                <b>{item.title}</b>
                <small>2025</small>
              </button>
              <div className="library-info">
                <span>{item.type}</span>
                <h2>{item.title}</h2>
                <p>
                  {item.pages} 页 · PDF · {item.date}
                </p>
              </div>
              <div className="library-actions">
                <button
                  onClick={() =>
                    onOpenReport(item.title.includes("人形机器人") ? "robotics" : "comparison")
                  }
                >
                  阅读
                </button>
                <button onClick={downloadReport} aria-label="下载">
                  <Icon name="download" size={15} />
                </button>
                <button aria-label="更多">
                  <Icon name="more" size={15} />
                </button>
              </div>
            </article>
          ))}
      </div>
      <div className="library-foot">已显示全部 3 份报告</div>
    </div>
  );
}

const historyItems = [
  {
    title: "比较贵州茅台和五粮液近三年的营收、利润和估值表现",
    kind: "公司对比",
    time: "今天 10:41",
    duration: "42 秒",
    status: "已完成",
  },
  {
    title: "生成一份人形机器人行业研究报告",
    kind: "行业研究",
    time: "昨天 16:18",
    duration: "1分 24秒",
    status: "已完成",
  },
  {
    title: "分析宁德时代过去一年的股价走势与主要风险",
    kind: "风险分析",
    time: "4月18日 09:32",
    duration: "36 秒",
    status: "已完成",
  },
  {
    title: "查询沪深300今日行情及领涨、领跌成分股",
    kind: "行情查询",
    time: "4月16日 14:06",
    duration: "12 秒",
    status: "已完成",
  },
];

function ResearchHistory({ onOpen }: { onOpen: (question: string) => void }) {
  const [search, setSearch] = useState("");
  return (
    <div className="workspace-page">
      <div className="workspace-head">
        <div>
          <span>ACTIVITY</span>
          <h1>研究记录</h1>
          <p>查看所有历史研究任务、运行状态、耗时与生成结果。</p>
        </div>
        <label className="history-search">
          <Icon name="search" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索研究记录"
          />
        </label>
      </div>
      <div className="history-summary">
        <div>
          <strong>24</strong>
          <span>本月研究任务</span>
        </div>
        <div>
          <strong>8.6h</strong>
          <span>预计节省时间</span>
        </div>
        <div>
          <strong>96%</strong>
          <span>任务完成率</span>
        </div>
      </div>
      <section className="history-panel">
        <div className="history-panel-head">
          <b>全部记录</b>
          <span>共 24 项</span>
          <button>
            最近 30 天 <Icon name="chevron" size={13} />
          </button>
        </div>
        <div className="history-list">
          {historyItems
            .filter((item) => item.title.includes(search))
            .map((item) => (
              <button key={item.title} onClick={() => onOpen(item.title)}>
                <span className="history-icon">
                  <Icon
                    name={
                      item.kind === "行情查询"
                        ? "chart"
                        : item.kind === "行业研究"
                          ? "report"
                          : "search"
                    }
                    size={18}
                  />
                </span>
                <span className="history-main">
                  <b>{item.title}</b>
                  <small>
                    {item.kind} · {item.time}
                  </small>
                </span>
                <span className="history-duration">{item.duration}</span>
                <span className="history-status">
                  <i></i>
                  {item.status}
                </span>
                <Icon name="arrow" size={15} />
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [showExamples, setShowExamples] = useState(true);
  const [query, setQuery] = useState("");
  const [activeNav, setActiveNav] = useState("当前对话");
  const [running, setRunning] = useState(false);
  const [submitted, setSubmitted] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTopic, setReportTopic] = useState<"comparison" | "catl" | "robotics" | "csi300">(
    "comparison",
  );
  const canRun = query.trim().length > 0;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  }, []);

  const runTask = () => {
    if (!canRun || running) return;
    setRunning(true);
    setSubmitted(query.trim());
    setActiveNav("当前对话");
    window.setTimeout(() => {
      setRunning(false);
      setQuery("");
    }, 1400);
  };

  const newConversation = () => {
    setActiveNav("当前对话");
    setQuery("");
    setSubmitted("");
    setRunning(false);
    setReportOpen(false);
  };

  const openConversation = (question: string) => {
    setSubmitted(question);
    setQuery("");
    setRunning(false);
    setActiveNav("当前对话");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={newConversation} aria-label="返回首页">
          <div className="brand-mark">
            <Icon name="spark" size={20} />
          </div>
          <span>知衡研究</span>
          <span className="beta">BETA</span>
        </button>

        <button className="new-chat" onClick={newConversation}>
          <Icon name="plus" size={17} /> 新对话
        </button>

        <nav className="nav-list" aria-label="主要导航">
          {[
            { name: "当前对话", icon: "chat" as IconName },
            { name: "报告中心", icon: "file" as IconName },
            { name: "研究记录", icon: "clock" as IconName },
          ].map((item) => (
            <button
              key={item.name}
              className={activeNav === item.name ? "nav-item active" : "nav-item"}
              onClick={() => setActiveNav(item.name)}
            >
              <Icon name={item.icon} size={17} /> {item.name}
              {item.name === "报告中心" && <span className="nav-count">3</span>}
            </button>
          ))}
        </nav>

        <div className="recent">
          <div className="section-label">最近对话</div>
          <button
            onClick={() => {
              openConversation(examples[0]);
            }}
          >
            <span>消费龙头公司对比分析</span>
            <small>今天</small>
          </button>
          <button
            onClick={() => {
              openConversation(examples[2]);
            }}
          >
            <span>人形机器人行业研究</span>
            <small>昨天</small>
          </button>
          <button
            onClick={() => {
              openConversation(examples[1]);
            }}
          >
            <span>新能源板块风险分析</span>
            <small>4月18日</small>
          </button>
        </div>

        <div className="sidebar-bottom">
          <button className="user-card">
            <div className="avatar">研</div>
            <span>
              <b>研究员</b>
              <small>个人工作区</small>
            </span>
            <Icon name="more" size={18} />
          </button>
          <button className="settings" aria-label="设置">
            <Icon name="settings" size={18} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="market-status">
            <span></span> 数据服务正常
          </div>
          <div className="context-pill">支持最近 3 轮连续追问</div>
        </header>

        {activeNav === "报告中心" ? (
          <ReportCenter
            onOpenReport={(topic = "comparison") => {
              setReportTopic(topic);
              setReportOpen(true);
            }}
          />
        ) : activeNav === "研究记录" ? (
          <ResearchHistory onOpen={openConversation} />
        ) : !submitted ? (
          <div className="content">
            <section className="hero">
              <div className="eyebrow">
                <span></span> AI 驱动的投研工作台
              </div>
              <h1>{greeting}，想研究什么？</h1>
              <p>查询行情、比较公司、洞察历史表现与风险，或生成一份完整的行业研究报告。</p>
            </section>

            <section className="research-box">
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如：比较贵州茅台和五粮液近三年的业绩与估值表现"
                maxLength={500}
                aria-label="研究需求"
              />
              <div className="box-footer">
                <div className="input-meta">
                  <span className="model-dot"></span>深度研究模式<span className="divider"></span>
                  <span>{query.length}/500</span>
                </div>
                <button className="run-button" disabled={!canRun || running} onClick={runTask}>
                  <Icon name="send" size={16} /> 运行研究任务
                </button>
              </div>
            </section>

            <section className="examples">
              <button
                className="examples-toggle"
                onClick={() => setShowExamples(!showExamples)}
                aria-expanded={showExamples}
              >
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
                  {examples.map((example, index) => (
                    <button key={example} onClick={() => setQuery(example)}>
                      <span className="example-index">0{index + 1}</span>
                      <span>{example}</span>
                      <Icon name="arrow" size={16} />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="capabilities">
              <div className="section-heading">
                <div>
                  <span>研究能力</span>
                  <h2>从数据到结论，一站完成</h2>
                </div>
                <p>回答和图表将在结果页呈现，完整报告可前往「报告中心」阅读与下载。</p>
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
              <span>数据范围与使用说明</span>
            </footer>
          </div>
        ) : (
          <div className="result-content">
            {running ? (
              <LoadingResearch question={submitted} />
            ) : submitted.includes("沪深300") ? (
              <Csi300ResearchResult
                question={submitted}
                onOpenReport={() => {
                  setReportTopic("csi300");
                  setReportOpen(true);
                }}
              />
            ) : submitted.includes("人形机器人") ? (
              <HumanoidResearchResult
                question={submitted}
                onOpenReport={() => {
                  setReportTopic("robotics");
                  setReportOpen(true);
                }}
              />
            ) : submitted.includes("宁德时代") ? (
              <CatlResearchResult
                question={submitted}
                onOpenReport={() => {
                  setReportTopic("catl");
                  setReportOpen(true);
                }}
              />
            ) : (
              <ResearchResult
                question={submitted}
                onOpenReport={() => {
                  setReportTopic("comparison");
                  setReportOpen(true);
                }}
              />
            )}
            {!running && (
              <div className="followup-bar">
                <div>
                  <Icon name="spark" size={16} />
                  <input
                    aria-label="继续追问"
                    placeholder="基于以上结果继续追问…"
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && query.trim()) runTask();
                    }}
                  />
                  <span>还可追问 3 轮</span>
                  <button onClick={runTask} disabled={!query.trim()}>
                    <Icon name="send" size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      {reportOpen && <ReportViewer topic={reportTopic} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
