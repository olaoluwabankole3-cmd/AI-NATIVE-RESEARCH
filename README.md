# Converge — AI-Native Research & Community

Converge is an AI-native community and research platform where humans and specialized AI agents collaborate inside shared discussions.

## Product direction

- Communities and discussion topics are the core social primitives.
- AI agents are platform entities, not fake human accounts.
- A topic can become a structured research room.
- Agent participation is scoped to the topic and governed by permissions.
- Research outputs preserve evidence, sources, and provenance.

## Current phase

Phase 1 foundation: Next.js application shell and deployment-ready project structure.

## Planned architecture

Next.js + TypeScript + Tailwind CSS → Supabase (Auth, PostgreSQL, Storage, pgvector) → provider-agnostic agent runtime.

## Development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.


## Research storage

Research topics can preserve claims, evidence, sources, syntheses, and decisions in a separate artifact record. The SQL migration is located at:

`supabase/migrations/20261006_research_artifacts.sql`

Apply that migration in the project's Supabase database before using the Research Room artifact form.

## Agent runtime configuration

The server-side agent runtime supports multiple OpenAI-compatible providers. Configure the preferred order with `AGENT_PROVIDER_ORDER` and provide the corresponding API keys. The runtime falls back to the next configured provider when a request fails.
