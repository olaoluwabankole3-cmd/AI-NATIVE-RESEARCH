import test from "node:test";
import assert from "node:assert/strict";
import { generateCloudflareTurnCredentials, validateCloudflareIceServers } from "../lib/cloudflare-turn.ts";

const validPayload = {
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478"] },
    {
      urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:80?transport=tcp",
        "turns:turn.cloudflare.com:443?transport=tcp"],
      username: "short-lived-username", credential: "short-lived-secret",
    },
  ],
};

test("Cloudflare's full UDP, TCP and TLS ICE server set is preserved", () => {
  const servers = validateCloudflareIceServers(validPayload);
  assert.equal(servers.length, 2);
  assert.equal(servers[1].urls.length, 3);
  assert.equal(servers[1].credential, "short-lived-secret");
});

test("invalid or non-Cloudflare relay URLs never reach RTCPeerConnection", () => {
  const servers = validateCloudflareIceServers({
    iceServers: [
      ...validPayload.iceServers,
      { urls: ["turn:attacker.example:3478", "turn:turn.cloudflare.com:3478?transport=udp"] },
    ],
  });
  assert.equal(servers.length, 2);
  assert.ok(!JSON.stringify(servers).includes("attacker.example"));
  assert.throws(() => validateCloudflareIceServers({ iceServers: [
    { urls: ["turn:turn.cloudflare.com:3478?transport=udp"] },
  ] }), /no valid TURN/);
  assert.throws(() => validateCloudflareIceServers({ iceServers: [] }), /no valid TURN/);
});

test("credentials are generated via the fixed Cloudflare endpoint with four-hour TTL", async () => {
  let passed = false;
  const servers = await generateCloudflareTurnCredentials(
    "0123456789abcdef0123456789abcdef", "server-secret-only",
    async (url, init) => {
      assert.equal(url, "https://rtc.live.cloudflare.com/v1/turn/keys/0123456789abcdef0123456789abcdef/credentials/generate-ice-servers");
      assert.equal(init?.method, "POST");
      assert.equal(init?.headers?.Authorization, "Bearer server-secret-only");
      assert.deepEqual(JSON.parse(init?.body), { ttl: 14400 });
      passed = true;
      return new Response(JSON.stringify(validPayload), { status: 201 });
    },
  );
  assert.ok(passed);
  assert.equal(servers.length, 2);
});

test("managed TURN failures never expose upstream secrets or leak arbitrary ICE entries", async () => {
  const errBody = "server-secret-only upstream internal information";
  await assert.rejects(
    () => generateCloudflareTurnCredentials("0123456789abcdef0123456789abcdef", "server-secret-only",
      async () => new Response(errBody, { status: 403 })),
    (error) => error instanceof Error && error.message === "Managed TURN service is unavailable.",
  );
  await assert.rejects(
    () => generateCloudflareTurnCredentials("../bad", "server-secret-only", async () => { throw new Error("Should not be called"); }),
    /configuration is invalid/,
  );
});
