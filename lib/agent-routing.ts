import { agents, type Agent } from "@/lib/agents";

const stopWords = new Set([
  "about", "after", "again", "also", "because", "being", "between", "could",
  "from", "have", "into", "more", "most", "other", "should", "their",
  "there", "these", "they", "this", "what", "when", "where", "which",
  "with", "would", "your", "then", "than", "that", "while", "with",
]);

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
  limit = 3,
): Agent[] {
  const input = words(topic.title + " " + topic.body + " " + latestMessage);
  const ranked = agents
    .filter((agent) => attachedAgentIds.includes(agent.id))
    .map((agent) => {
      const roleWords = words(agent.role);
      const capabilityWords = words(agent.capabilities.join(" "));
      const specialtyWords = words(agent.specialties.join(" "));
      const relevance = tokenScore(input, [...roleWords, ...capabilityWords]) * 2 + tokenScore(input, [...specialtyWords]) * 3;
      return { agent, relevance };
    })
    .sort((a, b) => b.relevance - a.relevance || a.agent.name.localeCompare(b.agent.name));

  const relevant = ranked.filter((entry) => entry.relevance > 0).slice(0, limit);
  if (relevant.length > 0) return relevant.map(({ agent }) => agent);
  const fallback = ranked.find(({ agent }) => agent.id === "research-analyst") || ranked[0];
  return fallback ? [fallback.agent] : [];
}