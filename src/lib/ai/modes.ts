export type AgentMode = "ask" | "code" | "agent";
export const MODES: AgentMode[] = ["ask", "code", "agent"];

export const MODE_TOOLS: Record<AgentMode, string[]> = {
  ask: ["list_files", "read_file", "search_files", "web_search", "fetch_url"],
  code: [
    "list_files",
    "read_file",
    "search_files",
    "web_search",
    "fetch_url",
    "write_file",
    "run_command",
    "create_plan",
  ],
  agent: [
    "list_files",
    "read_file",
    "search_files",
    "web_search",
    "fetch_url",
    "write_file",
    "delete_file",
    "run_command",
    "create_plan",
  ],
};

export function toolAllowed(name: string, mode: AgentMode): boolean {
  return MODE_TOOLS[mode]?.includes(name) ?? false;
}

export function maxSteps(mode: AgentMode): number {
  return mode === "ask" ? 1 : mode === "code" ? 6 : 10;
}
