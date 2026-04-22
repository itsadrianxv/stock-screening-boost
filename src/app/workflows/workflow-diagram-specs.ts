import type {
  WorkflowDiagramEdge,
  WorkflowDiagramLane,
  WorkflowDiagramNode,
  WorkflowDiagramSpec,
} from "~/app/workflows/workflow-diagram";

type DiagramTemplateCode =
  | "quick_industry_research"
  | "company_research_center"
  | "timing_signal_pipeline_v1"
  | "watchlist_timing_cards_pipeline_v1"
  | "watchlist_timing_pipeline_v1"
  | "timing_review_loop_v1";

type DiagramDraftNode = Omit<WorkflowDiagramNode, "width" | "height"> & {
  width?: number;
  height?: number;
};

const defaultNodeSize = {
  width: 168,
  height: 64,
} as const;

const lanes = {
  scope: {
    id: "scope",
    label: "Scope",
    y: 24,
    height: 88,
  },
  collect: {
    id: "collect",
    label: "Collect",
    y: 136,
    height: 112,
  },
  review: {
    id: "review",
    label: "Review",
    y: 272,
    height: 88,
  },
  report: {
    id: "report",
    label: "Report",
    y: 384,
    height: 88,
  },
} satisfies Record<string, WorkflowDiagramLane>;

function toNode(node: DiagramDraftNode): WorkflowDiagramNode {
  return {
    ...node,
    width: node.width ?? defaultNodeSize.width,
    height: node.height ?? defaultNodeSize.height,
  };
}

function buildSpec(params: {
  templateCode: DiagramTemplateCode;
  templateVersion: number;
  title: string;
  layout: WorkflowDiagramSpec["layout"];
  lanes: WorkflowDiagramLane[];
  nodes: DiagramDraftNode[];
  edges: WorkflowDiagramEdge[];
}): WorkflowDiagramSpec {
  return {
    templateCode: params.templateCode,
    templateVersion: params.templateVersion,
    title: params.title,
    layout: params.layout,
    lanes: params.lanes,
    nodes: params.nodes.map(toNode),
    edges: params.edges,
  };
}

const quickResearchV3 = buildSpec({
  templateCode: "quick_industry_research",
  templateVersion: 3,
  title: "Quick Industry Research",
  layout: {
    width: 1260,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.review, lanes.report],
  nodes: [
    {
      id: "agent0_clarify_scope",
      label: "Clarify Scope",
      description: "Clarify intent and constraints.",
      kind: "agent",
      laneId: "scope",
      x: 48,
      y: 36,
    },
    {
      id: "agent1_extract_research_spec",
      label: "Research Spec",
      description: "Generate brief and unit plan.",
      kind: "agent",
      laneId: "scope",
      x: 256,
      y: 36,
    },
    {
      id: "agent2_trend_analysis",
      label: "Trend Analysis",
      description: "Assess theme and momentum.",
      kind: "agent",
      laneId: "collect",
      x: 48,
      y: 160,
    },
    {
      id: "agent3_candidate_screening",
      label: "Candidate Screen",
      description: "Screen candidate names.",
      kind: "agent",
      laneId: "collect",
      x: 256,
      y: 160,
    },
    {
      id: "agent4_credibility_and_competition",
      label: "Credibility",
      description: "Check evidence and competition.",
      kind: "agent",
      laneId: "collect",
      x: 464,
      y: 160,
    },
    {
      id: "agent5_report_synthesis",
      label: "Report Synthesis",
      description: "Write the research report.",
      kind: "agent",
      laneId: "report",
      x: 672,
      y: 396,
    },
    {
      id: "agent6_reflection",
      label: "Reflection",
      description: "Score quality and gaps.",
      kind: "gate",
      laneId: "review",
      x: 880,
      y: 284,
    },
  ],
  edges: [
    { from: "agent0_clarify_scope", to: "agent1_extract_research_spec" },
    { from: "agent1_extract_research_spec", to: "agent2_trend_analysis" },
    { from: "agent2_trend_analysis", to: "agent3_candidate_screening" },
    {
      from: "agent3_candidate_screening",
      to: "agent4_credibility_and_competition",
    },
    {
      from: "agent4_credibility_and_competition",
      to: "agent5_report_synthesis",
    },
    { from: "agent5_report_synthesis", to: "agent6_reflection" },
    {
      from: "agent6_reflection",
      to: "agent1_extract_research_spec",
      label: "replan",
    },
  ],
});

const companyResearchV1 = buildSpec({
  templateCode: "company_research_center",
  templateVersion: 1,
  title: "Company Research v1",
  layout: {
    width: 1120,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.report],
  nodes: [
    {
      id: "agent1_company_briefing",
      label: "Company Brief",
      description: "Create company research brief.",
      kind: "agent",
      laneId: "scope",
      x: 48,
      y: 36,
    },
    {
      id: "agent2_concept_mapping",
      label: "Concept Map",
      description: "Map the concept fit.",
      kind: "agent",
      laneId: "collect",
      x: 256,
      y: 160,
    },
    {
      id: "agent3_question_design",
      label: "Question Design",
      description: "Design deep research questions.",
      kind: "agent",
      laneId: "scope",
      x: 464,
      y: 36,
    },
    {
      id: "agent4_evidence_collection",
      label: "Evidence",
      description: "Collect evidence packs.",
      kind: "tool",
      laneId: "collect",
      x: 672,
      y: 160,
    },
    {
      id: "agent5_investment_synthesis",
      label: "Investment Synthesis",
      description: "Produce the final verdict.",
      kind: "agent",
      laneId: "report",
      x: 880,
      y: 396,
    },
  ],
  edges: [
    { from: "agent1_company_briefing", to: "agent2_concept_mapping" },
    { from: "agent2_concept_mapping", to: "agent3_question_design" },
    { from: "agent3_question_design", to: "agent4_evidence_collection" },
    { from: "agent4_evidence_collection", to: "agent5_investment_synthesis" },
  ],
});

const companyResearchV2 = buildSpec({
  templateCode: "company_research_center",
  templateVersion: 2,
  title: "Company Research v2",
  layout: {
    width: 1460,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.report],
  nodes: [
    {
      id: "agent1_company_briefing",
      label: "Company Brief",
      description: "Create company brief.",
      kind: "agent",
      laneId: "scope",
      x: 40,
      y: 36,
    },
    {
      id: "agent2_concept_mapping",
      label: "Concept Map",
      description: "Map key concepts.",
      kind: "agent",
      laneId: "collect",
      x: 248,
      y: 160,
    },
    {
      id: "agent3_question_design",
      label: "Question Design",
      description: "Define research questions.",
      kind: "agent",
      laneId: "scope",
      x: 456,
      y: 36,
    },
    {
      id: "agent4_source_grounding",
      label: "Source Grounding",
      description: "Plan grounded sources.",
      kind: "agent",
      laneId: "collect",
      x: 664,
      y: 160,
    },
    {
      id: "collector_official_sources",
      label: "Official Sources",
      description: "Collect official sources.",
      kind: "tool",
      laneId: "collect",
      x: 872,
      y: 136,
      width: 152,
      height: 56,
    },
    {
      id: "collector_financial_sources",
      label: "Financial Sources",
      description: "Collect financial sources.",
      kind: "tool",
      laneId: "collect",
      x: 872,
      y: 200,
      width: 152,
      height: 56,
    },
    {
      id: "collector_news_sources",
      label: "News Sources",
      description: "Collect news sources.",
      kind: "tool",
      laneId: "collect",
      x: 1048,
      y: 136,
      width: 152,
      height: 56,
    },
    {
      id: "collector_industry_sources",
      label: "Industry Sources",
      description: "Collect industry sources.",
      kind: "tool",
      laneId: "collect",
      x: 1048,
      y: 200,
      width: 152,
      height: 56,
    },
    {
      id: "agent9_evidence_curation",
      label: "Evidence Curation",
      description: "Curate collected evidence.",
      kind: "agent",
      laneId: "collect",
      x: 1224,
      y: 160,
    },
    {
      id: "agent10_reference_enrichment",
      label: "Reference Enrichment",
      description: "Add supporting references.",
      kind: "tool",
      laneId: "report",
      x: 1224,
      y: 396,
    },
    {
      id: "agent11_investment_synthesis",
      label: "Investment Synthesis",
      description: "Produce the verdict.",
      kind: "agent",
      laneId: "report",
      x: 1008,
      y: 396,
    },
  ],
  edges: [
    { from: "agent1_company_briefing", to: "agent2_concept_mapping" },
    { from: "agent2_concept_mapping", to: "agent3_question_design" },
    { from: "agent3_question_design", to: "agent4_source_grounding" },
    { from: "agent4_source_grounding", to: "collector_official_sources" },
    { from: "agent4_source_grounding", to: "collector_financial_sources" },
    { from: "agent4_source_grounding", to: "collector_news_sources" },
    { from: "agent4_source_grounding", to: "collector_industry_sources" },
    { from: "collector_official_sources", to: "agent9_evidence_curation" },
    { from: "collector_financial_sources", to: "agent9_evidence_curation" },
    { from: "collector_news_sources", to: "agent9_evidence_curation" },
    { from: "collector_industry_sources", to: "agent9_evidence_curation" },
    { from: "agent9_evidence_curation", to: "agent10_reference_enrichment" },
    {
      from: "agent10_reference_enrichment",
      to: "agent11_investment_synthesis",
    },
  ],
});

const companyResearchV3 = buildSpec({
  templateCode: "company_research_center",
  templateVersion: 3,
  title: "Company Research v3",
  layout: {
    width: 1320,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.review, lanes.report],
  nodes: [
    {
      id: "agent0_clarify_scope",
      label: "Clarify Scope",
      description: "Clarify the brief.",
      kind: "agent",
      laneId: "scope",
      x: 40,
      y: 36,
    },
    {
      id: "agent1_write_research_brief",
      label: "Research Brief",
      description: "Write the brief.",
      kind: "agent",
      laneId: "scope",
      x: 248,
      y: 36,
    },
    {
      id: "agent2_plan_research_units",
      label: "Plan Units",
      description: "Plan research units.",
      kind: "agent",
      laneId: "scope",
      x: 456,
      y: 36,
    },
    {
      id: "agent3_execute_research_units",
      label: "Execute Units",
      description: "Execute planned units.",
      kind: "agent",
      laneId: "collect",
      x: 664,
      y: 160,
    },
    {
      id: "agent4_evidence_curation",
      label: "Evidence Curation",
      description: "Curate evidence.",
      kind: "agent",
      laneId: "collect",
      x: 872,
      y: 160,
    },
    {
      id: "agent5_gap_analysis",
      label: "Gap Analysis",
      description: "Review evidence gaps.",
      kind: "gate",
      laneId: "review",
      x: 1080,
      y: 284,
    },
    {
      id: "agent6_compress_findings",
      label: "Compress Findings",
      description: "Compress research output.",
      kind: "agent",
      laneId: "report",
      x: 872,
      y: 396,
    },
    {
      id: "agent7_reference_enrichment",
      label: "Reference Enrichment",
      description: "Add references.",
      kind: "tool",
      laneId: "report",
      x: 1080,
      y: 396,
    },
    {
      id: "agent8_investment_synthesis",
      label: "Investment Synthesis",
      description: "Write the verdict.",
      kind: "agent",
      laneId: "report",
      x: 248,
      y: 396,
    },
  ],
  edges: [
    { from: "agent0_clarify_scope", to: "agent1_write_research_brief" },
    { from: "agent1_write_research_brief", to: "agent2_plan_research_units" },
    { from: "agent2_plan_research_units", to: "agent3_execute_research_units" },
    { from: "agent3_execute_research_units", to: "agent4_evidence_curation" },
    { from: "agent4_evidence_curation", to: "agent5_gap_analysis" },
    { from: "agent5_gap_analysis", to: "agent6_compress_findings" },
    {
      from: "agent5_gap_analysis",
      to: "agent2_plan_research_units",
      label: "replan",
    },
    { from: "agent6_compress_findings", to: "agent7_reference_enrichment" },
    { from: "agent7_reference_enrichment", to: "agent8_investment_synthesis" },
  ],
});

const companyResearchV4 = buildSpec({
  templateCode: "company_research_center",
  templateVersion: 4,
  title: "Company Research v4",
  layout: {
    width: 1520,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.review, lanes.report],
  nodes: [
    {
      id: "agent0_clarify_scope",
      label: "Clarify Scope",
      description: "Clarify scope and constraints.",
      kind: "agent",
      laneId: "scope",
      x: 32,
      y: 36,
    },
    {
      id: "agent1_write_research_brief",
      label: "Research Brief",
      description: "Write the research brief.",
      kind: "agent",
      laneId: "scope",
      x: 232,
      y: 36,
    },
    {
      id: "agent2_plan_research_units",
      label: "Plan Units",
      description: "Plan research units.",
      kind: "agent",
      laneId: "scope",
      x: 432,
      y: 36,
    },
    {
      id: "agent3_source_grounding",
      label: "Source Grounding",
      description: "Ground source channels.",
      kind: "agent",
      laneId: "collect",
      x: 632,
      y: 160,
    },
    {
      id: "collector_official_sources",
      label: "Official Sources",
      description: "Collect official sources.",
      kind: "tool",
      laneId: "collect",
      x: 832,
      y: 136,
      width: 152,
      height: 56,
    },
    {
      id: "collector_financial_sources",
      label: "Financial Sources",
      description: "Collect financial sources.",
      kind: "tool",
      laneId: "collect",
      x: 832,
      y: 200,
      width: 152,
      height: 56,
    },
    {
      id: "collector_news_sources",
      label: "News Sources",
      description: "Collect news sources.",
      kind: "tool",
      laneId: "collect",
      x: 1008,
      y: 136,
      width: 152,
      height: 56,
    },
    {
      id: "collector_industry_sources",
      label: "Industry Sources",
      description: "Collect industry sources.",
      kind: "tool",
      laneId: "collect",
      x: 1008,
      y: 200,
      width: 152,
      height: 56,
    },
    {
      id: "agent4_synthesis",
      label: "Synthesis",
      description: "Merge grounded packs.",
      kind: "agent",
      laneId: "collect",
      x: 1184,
      y: 160,
    },
    {
      id: "agent5_gap_analysis_and_replan",
      label: "Gap & Replan",
      description: "Check gaps and replan.",
      kind: "gate",
      laneId: "review",
      x: 1184,
      y: 284,
    },
    {
      id: "agent6_compress_findings",
      label: "Compress Findings",
      description: "Compress findings.",
      kind: "agent",
      laneId: "report",
      x: 584,
      y: 396,
    },
    {
      id: "agent7_reference_enrichment",
      label: "Reference Enrichment",
      description: "Add references.",
      kind: "tool",
      laneId: "report",
      x: 784,
      y: 396,
    },
    {
      id: "agent8_finalize_report",
      label: "Finalize Report",
      description: "Finalize report.",
      kind: "agent",
      laneId: "report",
      x: 984,
      y: 396,
    },
    {
      id: "agent9_reflection",
      label: "Reflection",
      description: "Reflect on output quality.",
      kind: "gate",
      laneId: "review",
      x: 1184,
      y: 396,
    },
  ],
  edges: [
    { from: "agent0_clarify_scope", to: "agent1_write_research_brief" },
    { from: "agent1_write_research_brief", to: "agent2_plan_research_units" },
    { from: "agent2_plan_research_units", to: "agent3_source_grounding" },
    { from: "agent3_source_grounding", to: "collector_official_sources" },
    { from: "agent3_source_grounding", to: "collector_financial_sources" },
    { from: "agent3_source_grounding", to: "collector_news_sources" },
    { from: "agent3_source_grounding", to: "collector_industry_sources" },
    { from: "collector_official_sources", to: "agent4_synthesis" },
    { from: "collector_financial_sources", to: "agent4_synthesis" },
    { from: "collector_news_sources", to: "agent4_synthesis" },
    { from: "collector_industry_sources", to: "agent4_synthesis" },
    { from: "agent4_synthesis", to: "agent5_gap_analysis_and_replan" },
    {
      from: "agent5_gap_analysis_and_replan",
      to: "agent2_plan_research_units",
      label: "replan",
    },
    {
      from: "agent5_gap_analysis_and_replan",
      to: "agent6_compress_findings",
    },
    { from: "agent6_compress_findings", to: "agent7_reference_enrichment" },
    { from: "agent7_reference_enrichment", to: "agent8_finalize_report" },
    { from: "agent8_finalize_report", to: "agent9_reflection" },
  ],
});

const timingSignalV1 = buildSpec({
  templateCode: "timing_signal_pipeline_v1",
  templateVersion: 1,
  title: "Timing Signal",
  layout: {
    width: 1080,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.report],
  nodes: [
    {
      id: "load_targets",
      label: "Load Targets",
      description: "Load the target stock.",
      kind: "system",
      laneId: "scope",
      x: 48,
      y: 36,
    },
    {
      id: "fetch_signal_snapshots",
      label: "Signal Snapshots",
      description: "Fetch signal snapshots.",
      kind: "tool",
      laneId: "collect",
      x: 256,
      y: 160,
    },
    {
      id: "technical_signal_agent",
      label: "Technical Signal",
      description: "Score technical signals.",
      kind: "agent",
      laneId: "collect",
      x: 464,
      y: 160,
    },
    {
      id: "timing_synthesis_agent",
      label: "Timing Synthesis",
      description: "Build the timing card.",
      kind: "agent",
      laneId: "report",
      x: 672,
      y: 396,
    },
    {
      id: "persist_cards",
      label: "Persist Cards",
      description: "Persist the timing report.",
      kind: "system",
      laneId: "report",
      x: 880,
      y: 396,
    },
  ],
  edges: [
    { from: "load_targets", to: "fetch_signal_snapshots" },
    { from: "fetch_signal_snapshots", to: "technical_signal_agent" },
    { from: "technical_signal_agent", to: "timing_synthesis_agent" },
    { from: "timing_synthesis_agent", to: "persist_cards" },
  ],
});

const watchlistTimingCardsV1 = buildSpec({
  templateCode: "watchlist_timing_cards_pipeline_v1",
  templateVersion: 1,
  title: "Watchlist Timing Cards",
  layout: {
    width: 1080,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.report],
  nodes: [
    {
      id: "load_watchlist_context",
      label: "Load Watchlist",
      description: "Load watchlist context.",
      kind: "system",
      laneId: "scope",
      x: 48,
      y: 36,
    },
    {
      id: "fetch_signal_snapshots_batch",
      label: "Batch Snapshots",
      description: "Fetch snapshots in batch.",
      kind: "tool",
      laneId: "collect",
      x: 256,
      y: 160,
    },
    {
      id: "technical_signal_agent",
      label: "Technical Signal",
      description: "Score technical signals.",
      kind: "agent",
      laneId: "collect",
      x: 464,
      y: 160,
    },
    {
      id: "timing_synthesis_agent",
      label: "Timing Synthesis",
      description: "Build timing cards.",
      kind: "agent",
      laneId: "report",
      x: 672,
      y: 396,
    },
    {
      id: "persist_cards",
      label: "Persist Cards",
      description: "Persist timing cards.",
      kind: "system",
      laneId: "report",
      x: 880,
      y: 396,
    },
  ],
  edges: [
    { from: "load_watchlist_context", to: "fetch_signal_snapshots_batch" },
    { from: "fetch_signal_snapshots_batch", to: "technical_signal_agent" },
    { from: "technical_signal_agent", to: "timing_synthesis_agent" },
    { from: "timing_synthesis_agent", to: "persist_cards" },
  ],
});

const watchlistTimingV1 = buildSpec({
  templateCode: "watchlist_timing_pipeline_v1",
  templateVersion: 1,
  title: "Watchlist Timing",
  layout: {
    width: 1520,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.review, lanes.report],
  nodes: [
    {
      id: "load_watchlist_context",
      label: "Load Watchlist",
      description: "Load watchlist and portfolio context.",
      kind: "system",
      laneId: "scope",
      x: 32,
      y: 36,
    },
    {
      id: "fetch_signal_snapshots_batch",
      label: "Batch Snapshots",
      description: "Fetch snapshots.",
      kind: "tool",
      laneId: "collect",
      x: 232,
      y: 160,
    },
    {
      id: "technical_signal_agent",
      label: "Technical Signal",
      description: "Score technical signals.",
      kind: "agent",
      laneId: "collect",
      x: 432,
      y: 160,
    },
    {
      id: "timing_synthesis_agent",
      label: "Timing Synthesis",
      description: "Build timing card proposals.",
      kind: "agent",
      laneId: "collect",
      x: 632,
      y: 160,
    },
    {
      id: "market_regime_agent",
      label: "Market Regime",
      description: "Assess market regime.",
      kind: "agent",
      laneId: "review",
      x: 832,
      y: 284,
    },
    {
      id: "watchlist_risk_manager",
      label: "Risk Manager",
      description: "Assess watchlist risk.",
      kind: "agent",
      laneId: "review",
      x: 1032,
      y: 284,
    },
    {
      id: "watchlist_portfolio_manager",
      label: "Portfolio Manager",
      description: "Build portfolio plan.",
      kind: "agent",
      laneId: "report",
      x: 1232,
      y: 396,
    },
    {
      id: "persist_recommendations",
      label: "Persist Recommendations",
      description: "Persist portfolio recommendations.",
      kind: "system",
      laneId: "report",
      x: 1032,
      y: 396,
    },
  ],
  edges: [
    { from: "load_watchlist_context", to: "fetch_signal_snapshots_batch" },
    { from: "fetch_signal_snapshots_batch", to: "technical_signal_agent" },
    { from: "technical_signal_agent", to: "timing_synthesis_agent" },
    { from: "timing_synthesis_agent", to: "market_regime_agent" },
    { from: "market_regime_agent", to: "watchlist_risk_manager" },
    { from: "watchlist_risk_manager", to: "watchlist_portfolio_manager" },
    {
      from: "watchlist_portfolio_manager",
      to: "persist_recommendations",
    },
  ],
});

const timingReviewLoopV1 = buildSpec({
  templateCode: "timing_review_loop_v1",
  templateVersion: 1,
  title: "Timing Review Loop",
  layout: {
    width: 1080,
    height: 500,
  },
  lanes: [lanes.scope, lanes.collect, lanes.review, lanes.report],
  nodes: [
    {
      id: "load_due_reviews",
      label: "Load Due Reviews",
      description: "Load pending reviews.",
      kind: "system",
      laneId: "scope",
      x: 48,
      y: 36,
    },
    {
      id: "evaluate_outcomes",
      label: "Evaluate Outcomes",
      description: "Evaluate outcomes.",
      kind: "agent",
      laneId: "collect",
      x: 256,
      y: 160,
    },
    {
      id: "review_agent",
      label: "Review Agent",
      description: "Review performance.",
      kind: "agent",
      laneId: "review",
      x: 464,
      y: 284,
    },
    {
      id: "persist_reviews",
      label: "Persist Reviews",
      description: "Persist review results.",
      kind: "system",
      laneId: "report",
      x: 672,
      y: 396,
    },
    {
      id: "schedule_next_review",
      label: "Schedule Next Review",
      description: "Trigger next reminders.",
      kind: "system",
      laneId: "report",
      x: 880,
      y: 396,
    },
  ],
  edges: [
    { from: "load_due_reviews", to: "evaluate_outcomes" },
    { from: "evaluate_outcomes", to: "review_agent" },
    { from: "review_agent", to: "persist_reviews" },
    { from: "persist_reviews", to: "schedule_next_review" },
  ],
});

const specs = [
  quickResearchV3,
  companyResearchV1,
  companyResearchV2,
  companyResearchV3,
  companyResearchV4,
  timingSignalV1,
  watchlistTimingCardsV1,
  watchlistTimingV1,
  timingReviewLoopV1,
];

const specMap = new Map(
  specs.map((spec) => [`${spec.templateCode}@${spec.templateVersion}`, spec]),
);
const latestMap = new Map<DiagramTemplateCode, WorkflowDiagramSpec>();

for (const spec of specs) {
  const current = latestMap.get(spec.templateCode as DiagramTemplateCode);
  if (!current || spec.templateVersion >= current.templateVersion) {
    latestMap.set(spec.templateCode as DiagramTemplateCode, spec);
  }
}

export function getWorkflowDiagramSpec(
  templateCode: string,
  templateVersion: number,
): WorkflowDiagramSpec | null {
  return specMap.get(`${templateCode}@${templateVersion}`) ?? null;
}

export function getLatestWorkflowDiagramSpec(
  templateCode: string,
): WorkflowDiagramSpec | null {
  return latestMap.get(templateCode as DiagramTemplateCode) ?? null;
}
