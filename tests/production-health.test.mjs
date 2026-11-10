import test from "node:test";
import assert from "node:assert/strict";
import { checkHealthEndpoint } from "../scripts/monitor-production.mjs";

const reply = (status, body, contentType = "application/json") => new Response(
  contentType === "application/json" ? JSON.stringify(body) : String(body),
  { status, headers: { "Content-Type": contentType } },
);

test("monitor accepts healthy liveness and readiness JSON", async () => {
  let called = 0;
  const request = async (url, options) => {
    called++;
    assert.equal(url.origin, "https://ai-native-research-qfeh.vercel.app");
    assert.equal(options.redirect, "manual");
    assert.equal(options.method, "GET");
    return reply(200, { status: url.pathname === "/api/ready" ? "ready" : "ok" });
  };
  assert.equal(await checkHealthEndpoint("/api/health", "ok", request), true);
  assert.equal(await checkHealthEndpoint("/api/ready", "ready", request), true);
  assert.equal(called, 2);
});

test("monitor refuses Vercel login redirects", async () => {
  await assert.rejects(
    checkHealthEndpoint("/api/health", "ok", async () => reply(302, {})),
    /HTTP 302/,
  );
});

test("monitor refuses a login page disguised as HTTP 200", async () => {
  await assert.rejects(
    checkHealthEndpoint("/api/health", "ok", async () => reply(200, "<html>Login</html>", "text/html")),
    /non-JSON page/,
  );
});

test("monitor detects an unavailable dependency", async () => {
  await assert.rejects(
    checkHealthEndpoint("/api/ready", "ready", async () => reply(503, { status: "degraded" })),
    /HTTP 503/,
  );
});

test("monitor detects an unexpected response even if HTTP is OK", async () => {
  await assert.rejects(
    checkHealthEndpoint("/api/ready", "ready", async () => reply(200, { status: "degraded" })),
    /unexpected state/,
  );
});

test("monitor rejects requests that leave the production origin", async () => {
  await assert.rejects(
    checkHealthEndpoint("https://attacker.invalid/login", "ok", async () => reply(200, { status: "ok" })),
    /expected production origin/,
  );
});
