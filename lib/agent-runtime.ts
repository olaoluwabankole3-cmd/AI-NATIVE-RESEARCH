import { agents, type Agent } from "@/lib/agents";

type Provider = {
  name: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
};

type RuntimeResult = {
  provider: string;
  model: string;
  content: string;
};

function getProviders(): Provider[] {
  const order = (process.env.AGENT_PROVIDER_ORDER || "groq,openrouter,openai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const defaults: Record<string, { baseUrl: string; keyEnv: string; modelEnv: string; model: string }> = {
    groq: {
      baseUrl: "https://api.groq.com/openai/v1",
      keyEnv: "GROQ_API_KEY",
      modelEnv: "GROQ_AGENT_MODEL",
      model: "llama-3.3-70b-versatile",
    },
    openrouter: {
      baseUrl: "https://openrouter.ai/api/v1",
      keyEnv: "OPENROUTER_API_KEY",
      modelEnv: "OPENROUTER_AGENT_MODEL",
      model: "openai/gpt-oss-120b",
    },
    openai: {
      baseUrl: "https://api.openai.com/v1",
      keyEnv: "OPENAI_API_KEY",
      modelEnv: "OPENAI_AGENT_MODEL",
      model: "gpt-5-mini",
    },
  };

  return order.flatMap((name) => {
    const config = defaults[name];
    if (!config) return [];

    const apiKey = process.env[config.keyEnv];
    if (!apiKey) return [];

    return [{
      name,
      baseUrl: process.env[`${name.toUpperCase()}_BASE_URL`] || config.baseUrl,
      apiKey,
      model: process.env[config.modelEnv] || config.model,
    }];
  });
}

function buildSystemPrompt(agent: Agent) {
  return [
    `You are the Converge AI agent "${agent.name}".`,
    `Role: ${agent.role}.`,
    `Description: ${agent.description}`,
    `Capabilities: ${agent.capabilities.join(", ")}.`,
    `Research specialties: ${agent.specialties.join(", ")}.`,
    "You are a specialist participant, not a human pretending to be a user.",
    "Be precise, transparent about uncertainty, and do not invent sources or facts.",
    "Respond directly to the research discussion and add useful analysis rather than generic encouragement.",
  ].join("\n");
}

export function getAgent(agentId: string) {
  return agents.find((agent) => agent.id === agentId);
}

export async function runAgent(agent: Agent, topic: {
  title: string;
  body: string;
}, posts: Array<{ author: string; body: string }>): Promise<RuntimeResult> {
  const providers = getProviders();

  if (!providers.length) {
    throw new Error("No AI provider is configured. Add at least one agent provider API key.");
  }

  const conversation = posts.length
    ? posts.map((post) => `${post.author}: ${post.body}`).join("\n\n")
    : "No replies yet.";

  const userPrompt = [
    `Research topic: ${topic.title}`,
    `Topic description:\n${topic.body}`,
    `Conversation so far:\n${conversation}`,
    "",
    "Provide the next specialist contribution to this discussion.",
  ].join("\n");

  let lastError = "All configured AI providers failed.";

  for (const provider of providers) {
    try {
      const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.2,
          messages: [
            { role: "system", content: buildSystemPrompt(agent) },
            { role: "user", content: userPrompt },
          ],
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        lastError = `${provider.name} returned HTTP ${response.status}.`;
        continue;
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content?.trim();

      if (!content) {
        lastError = `${provider.name} returned an empty response.`;
        continue;
      }

      return { provider: provider.name, model: provider.model, content };
    } catch {
      lastError = `${provider.name} could not be reached.`;
    }
  }

  throw new Error(lastError);
}
