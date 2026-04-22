import { describe, expect, it } from "vitest";
import {
  getLatestWorkflowDiagramSpec,
  getWorkflowDiagramSpec,
} from "~/app/workflows/workflow-diagram-specs";

describe("workflow diagram specs", () => {
  it("returns the latest quick research spec for static entry previews", () => {
    const spec = getLatestWorkflowDiagramSpec("quick_industry_research");

    expect(spec?.templateCode).toBe("quick_industry_research");
    expect(spec?.templateVersion).toBe(3);
    expect(spec?.nodes.some((node) => node.id === "agent6_reflection")).toBe(
      true,
    );
    expect(spec?.edges.some((edge) => edge.from === "agent6_reflection")).toBe(
      true,
    );
  });

  it("keeps all company research template versions available", () => {
    const versions = [1, 2, 3, 4].map((version) =>
      getWorkflowDiagramSpec("company_research_center", version),
    );

    expect(versions.every(Boolean)).toBe(true);
    expect(
      versions[1]?.edges.some(
        (edge) =>
          edge.from === "agent4_source_grounding" &&
          edge.to === "collector_official_sources",
      ),
    ).toBe(true);
    expect(
      versions[3]?.edges.some(
        (edge) =>
          edge.from === "agent3_source_grounding" &&
          edge.to === "collector_industry_sources",
      ),
    ).toBe(true);
  });

  it("registers all timing pipeline variants used by timing reports", () => {
    const templateCodes = [
      "timing_signal_pipeline_v1",
      "watchlist_timing_cards_pipeline_v1",
      "watchlist_timing_pipeline_v1",
      "timing_review_loop_v1",
    ] as const;

    for (const templateCode of templateCodes) {
      const spec = getWorkflowDiagramSpec(templateCode, 1);

      expect(spec?.templateCode).toBe(templateCode);
      expect(spec?.nodes.length).toBeGreaterThan(0);
      expect(spec?.lanes.length).toBeGreaterThan(0);
      expect(spec?.layout.width).toBeGreaterThan(0);
      expect(spec?.layout.height).toBeGreaterThan(0);
    }
  });

  it("returns null for unknown template versions", () => {
    expect(getWorkflowDiagramSpec("company_research_center", 99)).toBeNull();
    expect(getLatestWorkflowDiagramSpec("unknown_template")).toBeNull();
  });
});
