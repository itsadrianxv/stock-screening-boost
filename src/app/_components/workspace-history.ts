import type { WorkspaceHistoryItem } from "~/app/_components/workspace-shell";
import { buildRunDetailHref } from "~/app/workflows/run-detail-href";

export function buildScreeningWorkspaceHistoryItems(
  workspaces: Array<{ id: string; name: string }>,
): WorkspaceHistoryItem[] {
  return workspaces.map((workspace) => ({
    id: workspace.id,
    title: workspace.name,
    href: `/screening?workspaceId=${workspace.id}`,
  }));
}

export function buildWorkflowRunHistoryItems(
  runs: Array<{ id: string; query: string; templateCode?: string | null }>,
): WorkspaceHistoryItem[] {
  return runs.map((run) => ({
    id: run.id,
    title: run.query,
    href: buildRunDetailHref({
      runId: run.id,
      templateCode: run.templateCode,
    }),
  }));
}
