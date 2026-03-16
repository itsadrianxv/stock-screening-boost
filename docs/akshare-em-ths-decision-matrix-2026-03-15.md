# AkShare EM/THS 决策矩阵（2026-03-15）

本轮只处理用户可见的 blocker，不把“发现某个 THS 接口存在”直接等价成“可以无损替换”。

| 当前接口 | 当前用途 | 当前策略 | 备注 |
| --- | --- | --- | --- |
| `stock_board_concept_name_em` | 概念目录 | 改为 THS 本地快照主链路 | 运行时读取 [ths_concept_catalog.csv](D:/课外项目/stock-screening-boost/data/ths_concept_catalog.csv)，仅刷新脚本调用 `stock_board_concept_name_ths` |
| `stock_board_concept_cons_em` | 概念成分股 | 已切到 THS 并补全分页 | 仍保持 live THS 调用，不做静态化 |
| `stock_zh_a_spot_em` | `evidence` / `research-pack` / 候选股 spot fallback | 不直接切 THS | 继续保留现有多级降级策略 |
| `fund_etf_spot_em` | ETF 快照 | 本轮不切换 | 持续观察字段等价性 |
| `fund_etf_hist_em` | ETF 日线 | 本轮不切换 | 未确认 THS 等价历史接口 |
| `stock_board_industry_name_em` | 行业列表 | 本轮不切换 | 后续再看字段和口径一致性 |
| `stock_yjbb_em` | 最新财务快照 | 本轮不切换 | 失败时仍允许 partial degrade |
| `stock_individual_info_em` | 行业补全 | 本轮不切换 | 当前仅作兜底补全 |
| `stock_financial_analysis_indicator_em` | 历史财务指标 | 本轮不切换 | 未证明 THS 可一对一复现 |
| `stock_news_em` | 个股新闻 | 本轮不切换 | 未确认 THS 等效新闻源 |

## 本轮落地结论

- 概念目录从“live THS 请求链路”切换为“THS 生成的本地快照文件”。
- 快照文件固定为 [ths_concept_catalog.csv](D:/课外项目/stock-screening-boost/data/ths_concept_catalog.csv)。
- 运维需要定期执行刷新脚本，至少每日盘前或盘后一次。
- 如果快照文件缺失、为空或结构损坏，概念相关接口显式报错，不自动回退 live THS。

## 后续替换原则

- 先证明“字段和行为等价”，再切主链路。
- 先替换直接影响用户正确性的链路，再处理低收益边缘接口。
- 切换后保留可观测性，包括 smoke test、warning 和数据质量标记。
