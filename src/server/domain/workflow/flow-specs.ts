import { z } from "zod";
import {
  buildFlow,
  type FlowMap,
  type FlowMapNode,
  type FlowSpec,
  makeEdge,
  makeNode,
  makeStage,
  type NodeKind,
} from "~/server/domain/workflow/flow-spec";
import {
  COMPANY_RESEARCH_NODE_KEYS,
  COMPANY_RESEARCH_TEMPLATE_CODE,
  COMPANY_RESEARCH_V1_NODE_KEYS,
  COMPANY_RESEARCH_V3_NODE_KEYS,
  COMPANY_RESEARCH_V4_NODE_KEYS,
  QUICK_RESEARCH_NODE_KEYS,
  QUICK_RESEARCH_TEMPLATE_CODE,
  SCREENING_INSIGHT_PIPELINE_NODE_KEYS,
  SCREENING_INSIGHT_PIPELINE_TEMPLATE_CODE,
  SCREENING_TO_TIMING_NODE_KEYS,
  SCREENING_TO_TIMING_TEMPLATE_CODE,
  TIMING_REVIEW_LOOP_NODE_KEYS,
  TIMING_REVIEW_LOOP_TEMPLATE_CODE,
  TIMING_SIGNAL_PIPELINE_NODE_KEYS,
  TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE,
  WATCHLIST_TIMING_CARDS_PIPELINE_NODE_KEYS,
  WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE,
  WATCHLIST_TIMING_PIPELINE_NODE_KEYS,
  WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";

const anyRecord = z.record(z.string(), z.unknown());

type StageKey = "scope" | "collect" | "review" | "report";

type NodeDraft = {
  key: string;
  kind: NodeKind;
  name: string;
  goal: string;
  stage: StageKey;
  show?: boolean;
  routes?: string[];
  tools?: string[];
};

const STAGES = {
  scope: makeStage({ key: "scope", name: "Clarify" }),
  collect: makeStage({ key: "collect", name: "Collect" }),
  review: makeStage({ key: "review", name: "Review" }),
  report: makeStage({ key: "report", name: "Report" }),
} as const;

const stageByKey = (keys: readonly StageKey[]) =>
  keys.map((key) => STAGES[key]);

const nodeText: Record<
  string,
  {
    name: string;
    goal: string;
    kind: NodeKind;
    stage: StageKey;
    show?: boolean;
    routes?: string[];
    tools?: string[];
  }
> = {
  agent0_clarify_scope: {
    name: "Clarify",
    goal: "Clarify the request",
    kind: "agent",
    stage: "scope",
    tools: ["brief"],
    routes: ["ok", "pause"],
  },
  agent1_extract_research_spec: {
    name: "Plan",
    goal: "Build the research plan",
    kind: "agent",
    stage: "scope",
    tools: ["plan"],
  },
  agent2_trend_analysis: {
    name: "Trend",
    goal: "Study the theme trend",
    kind: "agent",
    stage: "collect",
    tools: ["search"],
  },
  agent3_candidate_screening: {
    name: "Screen",
    goal: "Pick candidate stocks",
    kind: "agent",
    stage: "collect",
    tools: ["screen"],
  },
  agent4_credibility_and_competition: {
    name: "Check",
    goal: "Check credibility and competition",
    kind: "agent",
    stage: "collect",
    tools: ["check"],
  },
  agent5_report_synthesis: {
    name: "Report",
    goal: "Write the final report",
    kind: "agent",
    stage: "report",
    tools: ["write"],
  },
  agent6_reflection: {
    name: "Reflect",
    goal: "Review the report quality",
    kind: "gate",
    stage: "review",
    tools: ["score"],
  },
  agent1_company_briefing: {
    name: "Brief",
    goal: "Write the company brief",
    kind: "agent",
    stage: "scope",
    tools: ["brief"],
  },
  agent2_concept_mapping: {
    name: "Map",
    goal: "Map key concepts",
    kind: "agent",
    stage: "collect",
    tools: ["map"],
  },
  agent3_question_design: {
    name: "Ask",
    goal: "Design research questions",
    kind: "agent",
    stage: "scope",
    tools: ["plan"],
  },
  agent4_evidence_collection: {
    name: "Collect",
    goal: "Collect company evidence",
    kind: "tool",
    stage: "collect",
    tools: ["search"],
  },
  agent5_investment_synthesis: {
    name: "Report",
    goal: "Write the investment view",
    kind: "agent",
    stage: "report",
    tools: ["write"],
  },
  agent1_write_research_brief: {
    name: "Brief",
    goal: "Write the research brief",
    kind: "agent",
    stage: "scope",
    tools: ["brief"],
  },
  agent2_plan_research_units: {
    name: "Plan",
    goal: "Plan research units",
    kind: "agent",
    stage: "scope",
    tools: ["plan"],
  },
  agent3_execute_research_units: {
    name: "Run",
    goal: "Run research units",
    kind: "agent",
    stage: "collect",
    tools: ["search"],
  },
  agent4_evidence_curation: {
    name: "Curate",
    goal: "Curate the evidence",
    kind: "agent",
    stage: "collect",
    tools: ["curate"],
  },
  agent5_gap_analysis: {
    name: "Gap",
    goal: "Check missing areas",
    kind: "gate",
    stage: "review",
    tools: ["check"],
  },
  agent6_compress_findings: {
    name: "Compress",
    goal: "Compress the findings",
    kind: "agent",
    stage: "report",
    tools: ["compress"],
  },
  agent7_reference_enrichment: {
    name: "Refs",
    goal: "Add source references",
    kind: "tool",
    stage: "report",
    tools: ["refs"],
  },
  agent8_investment_synthesis: {
    name: "Report",
    goal: "Write the investment view",
    kind: "agent",
    stage: "report",
    tools: ["write"],
  },
  agent3_source_grounding: {
    name: "Sources",
    goal: "Pick source lanes",
    kind: "agent",
    stage: "collect",
    tools: ["plan"],
  },
  collector_official_sources: {
    name: "Official",
    goal: "Collect official sources",
    kind: "tool",
    stage: "collect",
    tools: ["web"],
    show: false,
  },
  collector_financial_sources: {
    name: "Finance",
    goal: "Collect financial sources",
    kind: "tool",
    stage: "collect",
    tools: ["finance"],
    show: false,
  },
  collector_news_sources: {
    name: "News",
    goal: "Collect news sources",
    kind: "tool",
    stage: "collect",
    tools: ["news"],
    show: false,
  },
  collector_industry_sources: {
    name: "Industry",
    goal: "Collect industry sources",
    kind: "tool",
    stage: "collect",
    tools: ["industry"],
    show: false,
  },
  agent4_source_grounding: {
    name: "Sources",
    goal: "Pick source lanes",
    kind: "agent",
    stage: "collect",
    tools: ["plan"],
  },
  agent9_evidence_curation: {
    name: "Curate",
    goal: "Curate the evidence",
    kind: "agent",
    stage: "collect",
    tools: ["curate"],
  },
  agent10_reference_enrichment: {
    name: "Refs",
    goal: "Add source references",
    kind: "tool",
    stage: "report",
    tools: ["refs"],
  },
  agent11_investment_synthesis: {
    name: "Report",
    goal: "Write the investment view",
    kind: "agent",
    stage: "report",
    tools: ["write"],
  },
  agent4_synthesis: {
    name: "Merge",
    goal: "Merge the evidence",
    kind: "agent",
    stage: "collect",
    tools: ["merge"],
  },
  agent5_gap_analysis_and_replan: {
    name: "Gap",
    goal: "Check gaps and replan",
    kind: "gate",
    stage: "review",
    tools: ["check"],
  },
  agent8_finalize_report: {
    name: "Report",
    goal: "Finalize the report",
    kind: "agent",
    stage: "report",
    tools: ["write"],
  },
  agent9_reflection: {
    name: "Reflect",
    goal: "Review the final result",
    kind: "gate",
    stage: "review",
    tools: ["score"],
  },
  load_run_context: {
    name: "Load",
    goal: "Load session context",
    kind: "system",
    stage: "scope",
  },
  screen_candidates: {
    name: "Screen",
    goal: "Pick candidate stocks",
    kind: "tool",
    stage: "collect",
    routes: ["ok", "empty"],
  },
  collect_evidence_batch: {
    name: "Collect",
    goal: "Collect evidence for candidates",
    kind: "tool",
    stage: "collect",
  },
  synthesize_insights: {
    name: "Draft",
    goal: "Draft insight cards",
    kind: "agent",
    stage: "collect",
  },
  validate_insights: {
    name: "Check",
    goal: "Validate insight cards",
    kind: "gate",
    stage: "review",
  },
  review_gate: {
    name: "Review",
    goal: "Wait for review approval",
    kind: "gate",
    stage: "review",
    routes: ["ok", "pause"],
  },
  archive_insights: {
    name: "Save",
    goal: "Save approved insights",
    kind: "system",
    stage: "report",
  },
  schedule_review_reminders: {
    name: "Remind",
    goal: "Schedule review reminders",
    kind: "system",
    stage: "report",
    show: false,
  },
  archive_empty_result: {
    name: "Empty",
    goal: "Save the empty result",
    kind: "system",
    stage: "report",
    show: false,
  },
  notify_user: {
    name: "Notify",
    goal: "Notify the user",
    kind: "system",
    stage: "report",
  },
  load_targets: {
    name: "Load",
    goal: "Load timing targets",
    kind: "system",
    stage: "scope",
  },
  fetch_signal_snapshots: {
    name: "Fetch",
    goal: "Fetch timing snapshots",
    kind: "tool",
    stage: "collect",
  },
  technical_signal_agent: {
    name: "Signal",
    goal: "Score technical signals",
    kind: "agent",
    stage: "collect",
  },
  timing_synthesis_agent: {
    name: "Card",
    goal: "Build timing cards",
    kind: "agent",
    stage: "report",
  },
  persist_cards: {
    name: "Save",
    goal: "Save timing cards",
    kind: "system",
    stage: "report",
  },
  load_watchlist_context: {
    name: "Load",
    goal: "Load watchlist context",
    kind: "system",
    stage: "scope",
  },
  fetch_signal_snapshots_batch: {
    name: "Fetch",
    goal: "Fetch batch signal snapshots",
    kind: "tool",
    stage: "collect",
  },
  market_regime_agent: {
    name: "Market",
    goal: "Assess market regime",
    kind: "agent",
    stage: "review",
  },
  watchlist_risk_manager: {
    name: "Risk",
    goal: "Build the risk plan",
    kind: "agent",
    stage: "review",
  },
  watchlist_portfolio_manager: {
    name: "Plan",
    goal: "Build recommendations",
    kind: "agent",
    stage: "report",
  },
  persist_recommendations: {
    name: "Save",
    goal: "Save recommendations",
    kind: "system",
    stage: "report",
  },
  load_screening_results: {
    name: "Load",
    goal: "Load screening results",
    kind: "system",
    stage: "scope",
  },
  select_top_candidates: {
    name: "Select",
    goal: "Select top candidates",
    kind: "tool",
    stage: "collect",
  },
  run_timing_pipeline: {
    name: "Timing",
    goal: "Run timing analysis",
    kind: "agent",
    stage: "report",
  },
  archive_results: {
    name: "Save",
    goal: "Save the final result",
    kind: "system",
    stage: "report",
  },
  load_due_reviews: {
    name: "Load",
    goal: "Load due reviews",
    kind: "system",
    stage: "scope",
  },
  evaluate_outcomes: {
    name: "Score",
    goal: "Evaluate outcomes",
    kind: "tool",
    stage: "collect",
  },
  review_agent: {
    name: "Review",
    goal: "Write the review result",
    kind: "agent",
    stage: "review",
  },
  persist_reviews: {
    name: "Save",
    goal: "Save review records",
    kind: "system",
    stage: "report",
  },
  schedule_next_review: {
    name: "Next",
    goal: "Schedule the next review",
    kind: "system",
    stage: "report",
  },
};

function buildNode({
  key,
  kind,
  name,
  goal,
  stage,
  show = true,
  routes = ["ok"],
  tools = [],
}: NodeDraft) {
  return makeNode({
    key,
    kind,
    name,
    goal,
    tools,
    in: anyRecord,
    out: anyRecord,
    routes,
    view: {
      stage,
      show,
    },
  });
}

function getNodeDraft(key: string): NodeDraft {
  const draft = nodeText[key];
  if (!draft) {
    return {
      key,
      kind: "system",
      name: key,
      goal: key,
      stage: "collect",
    };
  }

  return {
    key,
    kind: draft.kind,
    name: draft.name,
    goal: draft.goal,
    stage: draft.stage,
    show: draft.show,
    routes: draft.routes,
    tools: draft.tools,
  };
}

function makeFlowFromOrder(params: {
  templateCode: string;
  templateVersion?: number;
  name: string;
  stageKeys: readonly StageKey[];
  nodeKeys: readonly string[];
  edgeOverrides?: Array<{ from: string; to: string; when: string }>;
}) {
  const defaultEdges = params.nodeKeys
    .slice(0, -1)
    .flatMap((nodeKey, index) => {
      const nextKey = params.nodeKeys[index + 1];

      if (!nextKey) {
        return [];
      }

      return [makeEdge({ from: nodeKey, to: nextKey, when: "ok" })];
    });

  return buildFlow({
    templateCode: params.templateCode,
    templateVersion: params.templateVersion,
    name: params.name,
    stages: stageByKey(params.stageKeys),
    nodes: params.nodeKeys.map((nodeKey) => buildNode(getNodeDraft(nodeKey))),
    edges: params.edgeOverrides?.map(makeEdge) ?? defaultEdges,
  });
}

const flowSpecs = [
  makeFlowFromOrder({
    templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
    templateVersion: 3,
    name: "Quick Research",
    stageKeys: ["scope", "collect", "review", "report"],
    nodeKeys: QUICK_RESEARCH_NODE_KEYS,
  }),
  makeFlowFromOrder({
    templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
    templateVersion: 1,
    name: "Company Research",
    stageKeys: ["scope", "collect", "report"],
    nodeKeys: COMPANY_RESEARCH_V1_NODE_KEYS,
  }),
  makeFlowFromOrder({
    templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
    templateVersion: 2,
    name: "Company Research",
    stageKeys: ["scope", "collect", "report"],
    nodeKeys: COMPANY_RESEARCH_NODE_KEYS,
    edgeOverrides: [
      {
        from: "agent1_company_briefing",
        to: "agent2_concept_mapping",
        when: "ok",
      },
      {
        from: "agent2_concept_mapping",
        to: "agent3_question_design",
        when: "ok",
      },
      {
        from: "agent3_question_design",
        to: "agent4_source_grounding",
        when: "ok",
      },
      {
        from: "agent4_source_grounding",
        to: "collector_official_sources",
        when: "ok",
      },
      {
        from: "agent4_source_grounding",
        to: "collector_financial_sources",
        when: "ok",
      },
      {
        from: "agent4_source_grounding",
        to: "collector_news_sources",
        when: "ok",
      },
      {
        from: "agent4_source_grounding",
        to: "collector_industry_sources",
        when: "ok",
      },
      {
        from: "collector_official_sources",
        to: "agent9_evidence_curation",
        when: "ok",
      },
      {
        from: "collector_financial_sources",
        to: "agent9_evidence_curation",
        when: "ok",
      },
      {
        from: "collector_news_sources",
        to: "agent9_evidence_curation",
        when: "ok",
      },
      {
        from: "collector_industry_sources",
        to: "agent9_evidence_curation",
        when: "ok",
      },
      {
        from: "agent9_evidence_curation",
        to: "agent10_reference_enrichment",
        when: "ok",
      },
      {
        from: "agent10_reference_enrichment",
        to: "agent11_investment_synthesis",
        when: "ok",
      },
    ],
  }),
  makeFlowFromOrder({
    templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
    templateVersion: 3,
    name: "Company Research",
    stageKeys: ["scope", "collect", "review", "report"],
    nodeKeys: COMPANY_RESEARCH_V3_NODE_KEYS,
  }),
  makeFlowFromOrder({
    templateCode: COMPANY_RESEARCH_TEMPLATE_CODE,
    templateVersion: 4,
    name: "Company Research",
    stageKeys: ["scope", "collect", "review", "report"],
    nodeKeys: COMPANY_RESEARCH_V4_NODE_KEYS,
    edgeOverrides: [
      {
        from: "agent0_clarify_scope",
        to: "agent1_write_research_brief",
        when: "ok",
      },
      {
        from: "agent1_write_research_brief",
        to: "agent2_plan_research_units",
        when: "ok",
      },
      {
        from: "agent2_plan_research_units",
        to: "agent3_source_grounding",
        when: "ok",
      },
      {
        from: "agent3_source_grounding",
        to: "collector_official_sources",
        when: "ok",
      },
      {
        from: "agent3_source_grounding",
        to: "collector_financial_sources",
        when: "ok",
      },
      {
        from: "agent3_source_grounding",
        to: "collector_news_sources",
        when: "ok",
      },
      {
        from: "agent3_source_grounding",
        to: "collector_industry_sources",
        when: "ok",
      },
      {
        from: "collector_official_sources",
        to: "agent4_synthesis",
        when: "ok",
      },
      {
        from: "collector_financial_sources",
        to: "agent4_synthesis",
        when: "ok",
      },
      { from: "collector_news_sources", to: "agent4_synthesis", when: "ok" },
      {
        from: "collector_industry_sources",
        to: "agent4_synthesis",
        when: "ok",
      },
      {
        from: "agent4_synthesis",
        to: "agent5_gap_analysis_and_replan",
        when: "ok",
      },
      {
        from: "agent5_gap_analysis_and_replan",
        to: "agent6_compress_findings",
        when: "ok",
      },
      {
        from: "agent6_compress_findings",
        to: "agent7_reference_enrichment",
        when: "ok",
      },
      {
        from: "agent7_reference_enrichment",
        to: "agent8_finalize_report",
        when: "ok",
      },
      { from: "agent8_finalize_report", to: "agent9_reflection", when: "ok" },
    ],
  }),
  makeFlowFromOrder({
    templateCode: SCREENING_INSIGHT_PIPELINE_TEMPLATE_CODE,
    templateVersion: 1,
    name: "Screening Insight",
    stageKeys: ["scope", "collect", "review", "report"],
    nodeKeys: SCREENING_INSIGHT_PIPELINE_NODE_KEYS,
    edgeOverrides: [
      { from: "load_run_context", to: "screen_candidates", when: "ok" },
      { from: "screen_candidates", to: "collect_evidence_batch", when: "ok" },
      { from: "screen_candidates", to: "archive_empty_result", when: "empty" },
      { from: "collect_evidence_batch", to: "synthesize_insights", when: "ok" },
      { from: "synthesize_insights", to: "validate_insights", when: "ok" },
      { from: "validate_insights", to: "review_gate", when: "ok" },
      { from: "review_gate", to: "archive_insights", when: "ok" },
      { from: "review_gate", to: "review_gate", when: "pause" },
      { from: "archive_insights", to: "schedule_review_reminders", when: "ok" },
      { from: "schedule_review_reminders", to: "notify_user", when: "ok" },
      { from: "archive_empty_result", to: "notify_user", when: "ok" },
    ],
  }),
  makeFlowFromOrder({
    templateCode: TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE,
    templateVersion: 1,
    name: "Timing Signal",
    stageKeys: ["scope", "collect", "report"],
    nodeKeys: TIMING_SIGNAL_PIPELINE_NODE_KEYS,
  }),
  makeFlowFromOrder({
    templateCode: WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE,
    templateVersion: 1,
    name: "Watchlist Cards",
    stageKeys: ["scope", "collect", "report"],
    nodeKeys: WATCHLIST_TIMING_CARDS_PIPELINE_NODE_KEYS,
  }),
  makeFlowFromOrder({
    templateCode: WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE,
    templateVersion: 1,
    name: "Watchlist Timing",
    stageKeys: ["scope", "collect", "review", "report"],
    nodeKeys: WATCHLIST_TIMING_PIPELINE_NODE_KEYS,
  }),
  makeFlowFromOrder({
    templateCode: SCREENING_TO_TIMING_TEMPLATE_CODE,
    templateVersion: 1,
    name: "Screen To Timing",
    stageKeys: ["scope", "collect", "report"],
    nodeKeys: SCREENING_TO_TIMING_NODE_KEYS,
  }),
  makeFlowFromOrder({
    templateCode: TIMING_REVIEW_LOOP_TEMPLATE_CODE,
    templateVersion: 1,
    name: "Timing Review",
    stageKeys: ["scope", "collect", "review", "report"],
    nodeKeys: TIMING_REVIEW_LOOP_NODE_KEYS,
  }),
] as const satisfies readonly FlowSpec[];

function buildNodeMap(spec: FlowSpec, mode: "user" | "debug") {
  return spec.nodes.filter((node) => mode === "debug" || node.view.show);
}

function buildCollapsedEdges(spec: FlowSpec, nodes: FlowMapNode[]) {
  const visibleKeys = new Set(nodes.map((node) => node.key));
  const outgoing = new Map<string, Array<{ to: string; when: string }>>();

  for (const edge of spec.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }

  const collapsed = new Map<
    string,
    { from: string; to: string; when: string }
  >();

  for (const node of nodes) {
    const stack = [...(outgoing.get(node.key) ?? [])];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const edge = stack.shift();

      if (!edge) {
        continue;
      }

      const visitKey = `${edge.when}:${edge.to}`;
      if (visited.has(visitKey)) {
        continue;
      }
      visited.add(visitKey);

      if (visibleKeys.has(edge.to)) {
        collapsed.set(`${node.key}:${edge.to}:${edge.when}`, {
          from: node.key,
          to: edge.to,
          when: edge.when,
        });
        continue;
      }

      for (const nextEdge of outgoing.get(edge.to) ?? []) {
        stack.push({
          to: nextEdge.to,
          when: edge.when === "ok" ? nextEdge.when : edge.when,
        });
      }
    }
  }

  return [...collapsed.values()];
}

export function listFlowSpecs() {
  return [...flowSpecs];
}

export function getFlowSpec(templateCode: string, templateVersion?: number) {
  if (typeof templateVersion === "number") {
    const exact = flowSpecs.find(
      (spec) =>
        spec.templateCode === templateCode &&
        spec.templateVersion === templateVersion,
    );

    if (exact) {
      return exact;
    }
  }

  const latest = [...flowSpecs]
    .filter((spec) => spec.templateCode === templateCode)
    .sort(
      (left, right) =>
        (right.templateVersion ?? 0) - (left.templateVersion ?? 0),
    )[0];

  if (!latest) {
    throw new Error(
      `Unknown flow spec: ${templateCode}@${templateVersion ?? "latest"}`,
    );
  }

  return latest;
}

export function buildFlowMap(
  spec: FlowSpec,
  mode: "user" | "debug" = "user",
): FlowMap {
  const nodes = buildNodeMap(spec, mode).map((node) => ({
    key: node.key,
    name: node.name,
    kind: node.kind,
    goal: node.goal,
    stage: node.view.stage,
  }));
  const stageKeys = new Set(nodes.map((node) => node.stage));

  return {
    templateCode: spec.templateCode,
    templateVersion: spec.templateVersion,
    name: spec.name,
    mode,
    stages: spec.stages.filter((stage) => stageKeys.has(stage.key)),
    nodes,
    edges:
      mode === "debug" ? [...spec.edges] : buildCollapsedEdges(spec, nodes),
  };
}
