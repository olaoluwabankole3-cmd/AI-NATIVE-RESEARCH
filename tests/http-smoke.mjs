import assert from "node:assert/strict";

const origin = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, opts = {}) {
  return fetch(new URL(path, origin), {
    redirect: "manual",
    signal: AbortSignal.timeout(7000),
    ...opts,
  });
}

let online = false;
for (let attempt = 0; attempt < 48; attempt += 1) {
  try {
    const r = await request("/");
    if (r.status === 200) { online = true; break; }
  } catch { /* Next server has not started yet */ }
  await sleep(250);
}
assert.equal(online, true, "Next production server did not become ready");

for (const [route, expected] of [
  ["/", "Converge"],
  ["/sign-in", "Sign in to Converge"],
  ["/sign-up", "Create your Converge account"],
  ["/forgot-password", "Reset your password"],
  ["/reset-password", "Choose a new password"],
  ["/communities", "Communities"],
  ["/messages", "Conversations that keep ideas moving."],
  ["/notifications", "Stay in the loop."],
]) {
  const response = await request(route);
  assert.equal(response.status, 200, route + " should render successfully");
  const html = await response.text();
  assert.ok(html.toLowerCase().includes(expected.toLowerCase()), route + " should include its page marker");
}

// Liveness must be cheap, read-only, and never reveal configuration.
const livenessResponse = await request("/api/health");
assert.equal(livenessResponse.status, 200, "App liveness endpoint should return HTTP 200");
assert.match(livenessResponse.headers.get("cache-control") || "", /no-store/);
const liveness = await livenessResponse.json();
assert.deepEqual(liveness, { status: "ok" });

// The isolated preview intentionally uses fake Supabase credentials.
// It must not claim that the real database/authentication service is ready.
const readinessResponse = await request("/api/ready");
assert.equal(readinessResponse.status, 503, "UI-only Preview should report degraded dependencies");
assert.match(readinessResponse.headers.get("cache-control") || "", /no-store/);
const readiness = await readinessResponse.json();
assert.deepEqual(readiness, { status: "degraded" });
assert.equal("error" in readiness, false, "Health endpoints should not expose upstream error details");

const signupPage = await request("/sign-up");
assert.equal(signupPage.status, 200);
assert.ok((await signupPage.text()).includes("8+ characters"), "Registration and reset must require at least eight password characters");

const warningPage = await request("/");
assert.equal(warningPage.status, 200);
assert.ok((await warningPage.text()).includes("UI-only preview"), "Test preview must clearly identify its offline mode");

const callback = await request("/auth/callback?next=%2Fmessages%2Fabc&error=access_denied");
assert.ok(callback.status >= 300 && callback.status < 400, "callback should redirect on provider error");
const callbackLocation = new URL(callback.headers.get("location") || "", origin);
assert.equal(callbackLocation.pathname, "/sign-in");
assert.equal(callbackLocation.searchParams.get("redirect"), "/messages/abc");
assert.equal(callbackLocation.searchParams.get("auth_error"), "provider");
assert.match(callback.headers.get("cache-control") || "", /no-store/, "OAuth callbacks must not be cached");

const deniedWithCode = await request("/auth/callback?code=unused-test-code&error=access_denied");
assert.ok(deniedWithCode.status >= 300 && deniedWithCode.status < 400);
const deniedLocation = new URL(deniedWithCode.headers.get("location") || "", origin);
assert.equal(deniedLocation.searchParams.get("auth_error"), "provider", "provider denial should take precedence over a code");


const attacker = await request("/auth/callback?next=https%3A%2F%2Fmalicious.invalid%2F&error=access_denied");
assert.ok(attacker.status >= 300 && attacker.status < 400);
const attackerLocation = new URL(attacker.headers.get("location") || "", origin);
assert.equal(attackerLocation.origin, origin);
assert.equal(attackerLocation.pathname, "/sign-in");
assert.equal(attackerLocation.searchParams.get("redirect"), "/communities");

const recovery = await request("/auth/callback?next=%2Freset-password&error=access_denied");
assert.ok(recovery.status >= 300 && recovery.status < 400);
const recoveryLocation = new URL(recovery.headers.get("location") || "", origin);
assert.equal(recoveryLocation.pathname, "/forgot-password");

// Negative-permission HTTP checks never use an account or a real database.
// Each request must stop at the authentication boundary before any mutation.
const zeroId = "00000000-0000-0000-0000-000000000000";
const securedRoutes = [
  { method: "GET", path: `/api/communities/${zeroId}/requests` },
  { method: "POST", path: `/api/communities/${zeroId}/requests`, body: "{}" },
  { method: "PATCH", path: `/api/communities/${zeroId}/requests/${zeroId}`, body: '{"decision":"APPROVED"}' },
  { method: "POST", path: `/api/topics/${zeroId}/replies`, body: '{"body":"Unauthorized test contribution"}' },
  { method: "POST", path: `/api/topics/${zeroId}/agents/${zeroId}/run`, body: "{}" },
  { method: "POST", path: `/api/topics/${zeroId}/agents/${zeroId}/artifacts/synthesis`, body: "{}" },
  { method: "DELETE", path: "/api/account/delete", body: "{}" },
];
for (const testCase of securedRoutes) {
  const response = await request(testCase.path, {
    method: testCase.method,
    headers: testCase.body === undefined ? {} : { "Content-Type": "application/json" },
    ...(testCase.body === undefined ? {} : { body: testCase.body }),
  });
  assert.equal(response.status, 401,
    testCase.method + " " + testCase.path + " must reject an unauthenticated request");
}

// Origin-sensitive destructive actions must reject cross-site requests,
 // independently of whether the browser has a valid session.
const crossOriginDelete = await request("/api/account/delete", {
  method: "DELETE",
  headers: { "Origin": "https://untrusted.invalid", "Content-Type": "application/json" },
  body: '{"confirmation":"DELETE","emailConfirmation":"attacker@invalid"}',
});
assert.equal(crossOriginDelete.status, 403, "Account deletion must block a cross-site origin");

console.log("Converge HTTP smoke passed: eight pages, liveness, safely degraded isolated readiness, three callback cases, seven unauthenticated API denials and one cross-site deletion denial.");
