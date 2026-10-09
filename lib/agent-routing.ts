import { agents, type Agent } from "@/lib/agents";

const stopWords = new Set([
  "about", "after", "again", "also", "because", "being", "between", "could",
  "from", "have", "into", "more", "most", "other", "should", "their",
  "there", "these", "they", "this", "what", "when", "where", "which",
  "with", "would", "your", "then", "than", "that", "while", "will", "does",
]);

const specialistTerms: Record<string, string[]> = {
  "research-analyst": [
    "research", "evidence", "source", "sources", "citation", "citations", "paper",
    "papers", "study", "studies", "literature", "synthesis", "findings", "review",
    "reference", "references", "publication", "journal", "investigate", "compare",
  ],
  "critical-reviewer": [
    "critique", "criticize", "challenge", "assumption", "assumptions", "contradiction",
    "contradict", "bias", "biased", "weakness", "weaknesses", "flaw", "flaws",
    "risk", "risks", "verify", "verification", "counterargument", "unsupported",
    "accuracy", "limitation", "limitations", "validity", "robustness",
  ],
  economist: [
    "economy", "economic", "economics", "inflation", "prices", "price", "market",
    "markets", "trade", "currency", "naira", "employment", "unemployment", "gdp",
    "policy", "cost", "costs", "incentive", "incentives", "consumer", "consumers",
    "poverty", "growth", "tax", "taxes", "budget", "income", "wages", "finance",
    "financial", "business", "businesses", "supply", "demand", "exchange",
  ],
  historian: [
    "history", "historical", "timeline", "past", "origin", "origins", "archive",
    "archives", "colonial", "chronology", "heritage", "precedent", "decade",
    "century", "centuries", "historian", "institution", "institutions",
  ],
  "data-analyst": [
    "data", "dataset", "datasets", "statistics", "statistic", "statistical",
    "numbers", "chart", "charts", "trend", "trends", "measure", "measurement",
    "quantitative", "survey", "surveys", "percentage", "percentages", "correlation",
    "regression", "csv", "spreadsheet", "metric", "metrics", "sample", "sampling",
    "distribution", "calculate", "calculation", "visualization", "visualize",
  ],
  strategy: [
    "strategy", "strategic", "plan", "planning", "implement", "implementation",
    "priority", "priorities", "decision", "decisions", "option", "options",
    "scenario", "scenarios", "roadmap", "action", "actions", "recommendation",
    "recommendations", "tradeoff", "tradeoffs", "execution", "operational",
    "launch", "rollout", "stakeholder", "stakeholders", "next",
  ],
};

function words(value: string) {
  return new Set(
    value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !stopWords.has(word)),
  );
}

function tokenScore(input: Set<string>, values: string[]) {
  return values.reduce((score, value) => score + (input.has(value) ? 1 : 0), 0);
}

export function selectAgentsForResponse(
  topic: { title: string; body: string },
  latestMessage: string,
  attachedAgentIds: string[],
  limit = 2,
): Agent[] {
  const topicInput = words(topic.title + " " + topic.body);
  const messageInput = words(latestMessage);
  const fullInput = new Set([...topicInput, ...messageInput]);

  const ranked = agents
    .filter((agent) => attachedAgentIds.includes(agent.id))
    .map((agent) => {
      const roleWords = words(agent.role);
      const capabilityWords = words(agent.capabilities.join(" "));
      const specialtyWords = words(agent.specialties.join(" "));
      const explicitTerms = specialistTerms[agent.id] || [];
      const messageRelevance = tokenScore(messageInput, explicitTerms) * 4;
      const topicRelevance = tokenScore(topicInput, explicitTerms);
      const descriptorRelevance = tokenScore(fullInput, [...roleWords, ...capabilityWords]) * 2 + tokenScore(fullInput, [...specialtyWords]) * 2;
      return { agent, relevance: messageRelevance + topicRelevance + descriptorRelevance };
    })
    .sort((a, b) => b.relevance - a.relevance || a.agent.name.localeCompare(b.agent.name));

  const relevant = ranked.filter((entry) => entry.relevance > 0).slice(0, Math.max(1, limit));
  if (relevant.length > 0) return relevant.map(({ agent }) => agent);
  const fallback = ranked.find(({ agent }) => agent.id === "research-analyst") || ranked[0];
  return fallback ? [fallback.agent] : [];
}