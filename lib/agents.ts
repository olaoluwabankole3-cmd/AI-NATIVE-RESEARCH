export type AgentStatus = "AVAILABLE" | "PLANNED";

export type Agent = {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  capabilities: string[];
  specialties: string[];
  participation: string;
  permissions: string[];
  status: AgentStatus;
};

export const agents: Agent[] = [
  {
    id: "research-analyst",
    name: "Research Analyst",
    handle: "@research-analyst",
    role: "Evidence discovery and synthesis",
    description:
      "Finds, compares, and synthesizes evidence so research discussions can move from questions to defensible findings.",
    capabilities: ["Web research", "Synthesis", "Citations"],
    specialties: ["Literature review", "Evidence mapping", "Source comparison"],
    participation: "Joins research topics when evidence discovery or synthesis is requested.",
    permissions: ["Read topic context", "Read research artifacts", "Publish evidence-backed responses"],
    status: "AVAILABLE",
  },
  {
    id: "critical-reviewer",
    name: "Critical Reviewer",
    handle: "@critical-reviewer",
    role: "Assumption and evidence challenge",
    description:
      "Stress-tests arguments, identifies weak assumptions, and highlights where evidence does not support a conclusion.",
    capabilities: ["Critique", "Fact checking", "Risk analysis"],
    specialties: ["Argument review", "Claim verification", "Research risk"],
    participation: "Best suited to review existing arguments, claims, and draft findings.",
    permissions: ["Read topic context", "Read research artifacts", "Flag unsupported claims"],
    status: "AVAILABLE",
  },
  {
    id: "economist",
    name: "Economist",
    handle: "@economist",
    role: "Economic reasoning and policy analysis",
    description:
      "Analyzes incentives, markets, policy choices, and economic trade-offs within a research discussion.",
    capabilities: ["Economics", "Markets", "Policy"],
    specialties: ["Incentives", "Market signals", "Policy trade-offs"],
    participation: "Joins topics where economic interpretation or policy analysis is relevant.",
    permissions: ["Read topic context", "Read research artifacts", "Publish analytical responses"],
    status: "AVAILABLE",
  },
  {
    id: "historian",
    name: "Historian",
    handle: "@historian",
    role: "Historical context and source analysis",
    description:
      "Adds historical context and tracks how claims, institutions, and ideas have developed over time.",
    capabilities: ["History", "Context", "Source analysis"],
    specialties: ["Historical comparison", "Institutional history", "Chronology"],
    participation: "Useful when a topic depends on historical context or longitudinal evidence.",
    permissions: ["Read topic context", "Read research artifacts", "Publish contextual responses"],
    status: "AVAILABLE",
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    handle: "@data-analyst",
    role: "Structured data interpretation",
    description:
      "Turns structured data into interpretable findings and helps research teams reason about patterns and uncertainty.",
    capabilities: ["Data analysis", "Statistics", "Visualization"],
    specialties: ["Descriptive statistics", "Trend analysis", "Data interpretation"],
    participation: "Joins data-heavy research topics where structured evidence is available.",
    permissions: ["Read topic context", "Read research artifacts", "Analyze supplied datasets"],
    status: "AVAILABLE",
  },
  {
    id: "strategy",
    name: "Strategy Agent",
    handle: "@strategy",
    role: "Decision support and scenario mapping",
    description:
      "Maps evidence into options, trade-offs, scenarios, and practical decisions without replacing human judgment.",
    capabilities: ["Strategy", "Scenarios", "Decision support"],
    specialties: ["Scenario planning", "Trade-offs", "Decision framing"],
    participation: "Best used after a discussion has accumulated enough evidence to evaluate options.",
    permissions: ["Read topic context", "Read research artifacts", "Publish decision options"],
    status: "AVAILABLE",
  },
];

export function getAgentByHandle(handle: string) {
  return agents.find((agent) => agent.handle === `@${handle.replace(/^@/, "")}`);
}
