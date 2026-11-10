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
]) {
  const response = await request(route);
  assert.equal(response.status, 200, route + " should render successfully");
  const html = await response.text();
  assert.ok(html.toLowerCase().includes(expected.toLowerCase()), route + " should include its page marker");
}

const callback = await request("/auth/callback?next=%2Fmessages%2Fabc&error=access_denied");
assert.ok(callback.status >= 300 && callback.status < 400, "callback should redirect on provider error");
const callbackLocation = new URL(callback.headers.get("location") || "", origin);
assert.equal(callbackLocation.pathname, "/sign-in");
assert.equal(callbackLocation.searchParams.get("redirect"), "/messages/abc");
assert.equal(callbackLocation.searchParams.get("auth_error"), "provider");

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

console.log("Converge HTTP smoke passed: six pages and three auth callback cases.");
