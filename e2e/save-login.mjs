// Saves YOUR gog.com login, on YOUR disk, so the logged-in checks in
// `E2E_LIVE=1 E2E_AUTH=e2e/.auth/gog.json npm run e2e` can run.
//
//   node e2e/save-login.mjs
//
// A normal browser window opens. Log in to gog.com yourself (the script never
// sees or types your password), then come back to this terminal and press
// Enter. The session cookies are written to e2e/.auth/gog.json, which is
// git-ignored — don't commit or share it, it is a login. Delete it when done.

import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findChromium } from "./harness.mjs";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), ".auth", "gog.json");
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ executablePath: findChromium(), headless: false });
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await context.newPage();
await page.goto("https://www.gog.com/en/");
console.log("\nLog in to gog.com in the window that just opened.\nWhen you are logged in, press Enter here to save the session (or Ctrl+C to cancel).");
await new Promise((r) => createInterface({ input: process.stdin }).once("line", r));

const cookies = (await context.cookies()).filter((c) => /(^|\.)gog\.com$/.test(c.domain.replace(/^\./, "")));
writeFileSync(OUT, JSON.stringify({ savedAt: new Date().toISOString(), cookies }, null, 2));
console.log(`Saved ${cookies.length} cookies to ${OUT}`);
await browser.close();
