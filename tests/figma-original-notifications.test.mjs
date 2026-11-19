import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../"+path, import.meta.url), "utf8");

test("Original mobile and desktop notifications use scoped Figma geometry", () => {
  const src = read("app/notifications/page.tsx");
  const css = read("app/figma-parity-phase3.css");
  const layout = read("app/layout.tsx");
  assert.match(layout,/import "\.\/figma-parity-phase3\.css";/);
  assert.match(src,/converge-figma figma-notifications/);
  for(const key of ["figma-notifications-mobile-toolbar","figma-notifications-navigator",
    "figma-notifications-inspector","figma-notifications-mobile-unread","figma-notification-card"]) {
    assert.ok(src.includes(key), "missing Figma element "+key);
    assert.ok(css.includes(key), "missing element style "+key);
  }
  assert.match(css,/@media\s*\(max-width:767px\)/);
  assert.match(css,/@media\s*\(min-width:1280px\)/);
  assert.match(css,/width:368px/);
  assert.match(css,/width:300px/);
  assert.match(css,/height:82px/);
});

test("Notification card filters and buttons use real Supabase data and existing handlers", () => {
  const src = read("app/notifications/page.tsx");
  assert.match(src,/\.from\("notifications"\)/);
  assert.match(src,/\.eq\("recipient_id", currentViewerId\)/);
  assert.match(src,/\.channel\(`notifications-page-/);
  assert.match(src,/setContext\(value\)/);
  assert.match(src,/setQuery\(event\.target\.value\)/);
  assert.match(src,/setView\("unread"\)/);
  assert.match(src,/displayedNotifications\.map\(\(item\) =>/);
  assert.match(src,/safeAuthDestination/);
  assert.match(src,/openNotification\(item\)/);
  assert.match(src,/markAllRead\(\)/);
  assert.match(src,/dismissNotification\(item.id\)/);
  assert.doesNotMatch(src,/Amara replied to your research topic|Tomi accepted your connection|Nadia requested to join AI/);
});

test("Unmodified public and auth pages are not opted in to notification Figma styling", () => {
  const css = read("app/figma-parity-phase3.css");
  assert.match(css,/main\.converge-app-page\.figma-notifications/);
  for(const p of ["app/page.tsx","app/sign-in/page.tsx","app/sign-up/page.tsx"]) {
    assert.doesNotMatch(read(p),/figma-notifications/);
  }
});
