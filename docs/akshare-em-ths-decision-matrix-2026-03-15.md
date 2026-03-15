# AkShare EM/THS 决策矩阵（2026-03-15）

本轮只修复用户可见 blocker，不把“发现某个 THS 接口存在”直接当成“可以无损替换”。

| 当前接口 | 当前用途 | 本轮动作 | 暂留原因 | 后续切换前需要验证 |
| --- | --- | --- | --- | --- |
| `stock_board_concept_name_em` | 概念目录 | 已切到 THS | THS 原始目录与适配层 smoke 可用 | 持续观察目录稳定性与耗时 |
| `stock_board_concept_cons_em` | 概念成分股 | 已切到 THS 并补全分页 | 之前只抓到第 1 页，现已修正 | 持续验证多页概念与去重行为 |
| `stock_zh_a_spot_em` | `evidence` / `research-pack` / 候选股 spot fallback | 不直接切 THS，新增 AkShare-only fallback | 未找到明确 THS 等效；当前主问题是 EM 失效而非字段映射 | 新浪源稳定性、限流风险、缺失字段对上层影响 |
| `fund_etf_spot_em` | ETF 快照 | 本轮只加 smoke 对比，不切换 | 发现 `fund_etf_spot_ths()` 但未验证字段一致性 | 核心字段列名、覆盖范围、ETF 代码匹配率 |
| `fund_etf_hist_em` | ETF 日线 | 本轮不切换 | 未找到明确 THS 历史等效 | 是否存在等价历史接口，复权与日期参数是否一致 |
| `stock_board_industry_name_em` | 行业列表 | 本轮只加 smoke 对比，不切换 | 发现 `stock_board_industry_name_ths()` 但未验证返回语义 | 行业名称口径、去重结果、缓存收益 |
| `stock_yjbb_em` | 最新财务快照 | 本轮不切换，失败时允许 partial degrade | THS 没有确认的一对一“全市场最新快照”接口 | 全市场覆盖率、更新时间、字段口径 |
| `stock_individual_info_em` | 行业补全 | 本轮不切换 | 当前只是兜底单股补全，替换收益有限 | 单股行业字段可用率、限流风险 |
| `stock_financial_analysis_indicator_em` | 历史财务指标 | 本轮不切换 | THS 只有部分替代思路，未证明可一对一复现 | ROE/EPS/PB 等历史序列的字段映射与时间顺序 |
| `stock_news_em` | 个股新闻 | 本轮不切换 | 未找到明确 THS 新闻等效 | 新闻时效、字段结构、去重与发布日期可用性 |

## 本轮落地结论

- 概念链路已经以 THS 为主，并补上了全分页。
- `theme_concepts`、`theme_candidates`、`company_evidence`、`company_research_pack` 现在都允许 stale cache 回退。
- `stock_zh_a_spot_em` 失效时，会按 `EM -> 新浪 -> per-code partial snapshot` 依次降级，不再直接把所有问题放大成 503。

## 后续替换原则

- 先证明“字段与行为等效”，再切主路径。
- 先替换直接造成用户故障的接口，再处理低收益的边缘接口。
- 优先保留可观测性：切换后必须保留 smoke test、data quality 标记和 warning。
