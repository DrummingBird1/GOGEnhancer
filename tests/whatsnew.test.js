import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The page opened in a new tab after every update (background.js).
const html = readFileSync(resolve(__dirname, "../extension/tour/whatsnew.html"), "utf8");
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, "");

await import("../extension/lib/changelog.js");

async function open(search) {
  vi.resetModules();
  document.body.innerHTML = body;
  window.history.replaceState({}, "", `/tour/whatsnew.html${search}`);
  window.close = vi.fn();
  chrome.runtime.getManifest = () => ({ version: "4.5.1" });
  await import("../extension/tour/whatsnew.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));
  await vi.waitFor(() => expect(document.querySelectorAll("#wnBody li").length).toBeGreaterThan(0));
}

describe("the what's-new tab", () => {
  beforeEach(() => {
    delete window.GOGPlusStorage;
    window.GOGPlusStorage = { get: async () => ({ uiLanguage: "en" }) };
  });

  it("lists the changes of the new version for someone coming from 4.0.0", async () => {
    await open("?from=4.0.0");
    expect(document.getElementById("wnIntro").textContent).toContain("4.0.0");
    expect(document.getElementById("wnIntro").textContent).toContain("4.5.1");
    const items = [...document.querySelectorAll("#wnBody li")].map((l) => l.textContent);
    expect(items.some((t) => t.includes("24 currencies"))).toBe(true);
    expect(items.some((t) => t.includes("Frankfurter"))).toBe(true);
  });

  it("still shows the current version when it does not know the previous one", async () => {
    await open("");
    expect(document.getElementById("wnPill").textContent).toBe("GOG Enhancer 4.5.1");
    expect(document.querySelectorAll("#wnBody li").length).toBeGreaterThan(3);
  });

  it("closes on Got it and links to the full changelog without any script injection", async () => {
    await open("?from=4.0.0");
    document.getElementById("wnClose").click();
    expect(window.close).toHaveBeenCalled();
    for (const a of document.querySelectorAll("a")) expect(a.rel).toContain("noopener");
  });
});
