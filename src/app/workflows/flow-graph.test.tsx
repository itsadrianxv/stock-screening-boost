/* biome-ignore lint/correctness/noUnusedImports: React is required for server-side JSX rendering in this test. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlowGraph } from "~/app/workflows/flow-graph";

describe("FlowGraph", () => {
  it("renders stage groups, node states, and path pills", () => {
    const markup = renderToStaticMarkup(
      <FlowGraph
        mode="user"
        graph={{
          stages: [
            { key: "scope", name: "Scope" },
            { key: "report", name: "Report" },
          ],
          nodes: [
            {
              key: "clarify",
              name: "Clarify",
              kind: "agent",
              goal: "Clarify the request",
              stage: "scope",
              state: "done",
              result: null,
              note: "Scope locked",
              stats: { ready: true },
            },
            {
              key: "report",
              name: "Report",
              kind: "agent",
              goal: "Write the report",
              stage: "report",
              state: "active",
              result: null,
              note: "Writing now",
              stats: { draft: 1 },
            },
          ],
          edges: [{ from: "clarify", to: "report", when: "ok" }],
          activePath: ["clarify", "report"],
          current: null,
        }}
      />,
    );

    expect(markup).toContain("Scope");
    expect(markup).toContain("Report");
    expect(markup).toContain("Scope locked");
    expect(markup).toContain("Active");
    expect(markup).toContain("clarify → report");
  });
});
