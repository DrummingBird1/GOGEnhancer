import { describe, it, expect, beforeEach, vi } from "vitest";

await import("../extension/lib/defaults.js");
await import("../extension/lib/storage.js");
await import("../extension/lib/notify-policy.js");
await import("../extension/lib/settings-profiles.js");
await import("../extension/options/settings-v4.js");

const V4 = window.GOGPlusSettingsV4;
const $ = (id) => document.getElementById(id);
const getSync = (keys) => new Promise((r) => chrome.storage.sync.get(keys, r));
const getLocal = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const change = async (el, value) => {
  if (el.type === "checkbox") el.checked = value;
  else el.value = value;
  el.dispatchEvent(new Event("change"));
  await tick();
};

async function boot(stored = {}) {
  globalThis.__resetChromeStores();
  document.body.innerHTML = `
    <main class="page">
      <section class="card"><div id="themePicker"></div></section>
      <section class="card" id="syncCard"></section>
    </main>
    <span id="saveStatus"></span>`;
  for (const [k, v] of Object.entries(stored)) {
    await window.GOGPlusStorage.set({ [k]: v });
  }
  V4.init();
  await tick(10);
}

beforeEach(() => {
  chrome.permissions = { request: vi.fn(async () => true) };
  vi.spyOn(chrome.runtime, "sendMessage").mockImplementation(async () => ({ ok: true }));
  chrome.runtime.sendMessage.mockClear();
  chrome.tabs.create.mockClear?.();
});

describe("building the page", () => {
  it("adds the cards before the sync card, once, and extends the look & feel card", async () => {
    await boot();
    const titles = [...document.querySelectorAll("main.page > .card > h2")].map((h) => h.textContent);
    expect(titles).toEqual(["Game page tools", "My PC", "Catalog, wishlist & library", "Notification rules"]);
    expect(document.querySelector("main.page").lastElementChild).toBe($("syncCard"));
    expect($("palette")).not.toBeNull();
    V4.init(); // a second call must not duplicate anything
    expect(document.querySelectorAll("#v4GameCard")).toHaveLength(1);
  });
});

describe("toggles and selects", () => {
  it("shows stored values and saves changes to the right storage area", async () => {
    await boot({ offerTimer: false, ownedDisplay: "dim", palette: "tritanopia" });
    expect($("offerTimer").checked).toBe(false);
    expect($("realDiscountCheck").checked).toBe(true); // default
    expect($("ownedDisplay").value).toBe("dim");
    expect($("palette").value).toBe("tritanopia");
    await change($("pricePerHour"), false);
    await change($("ownedDisplay"), "hide");
    await change($("seasonRadar"), true);
    expect(await getSync(["pricePerHour", "ownedDisplay", "seasonRadar"])).toEqual({ pricePerHour: false, ownedDisplay: "hide", seasonRadar: true });
  });

  it("clamps numbers and falls back sensibly", async () => {
    await boot();
    await change($("uiScale"), "9");
    await change($("notifyMinDiscount"), "500");
    await change($("monthlyGoal"), "abc");
    await change($("notifyMaxPrice"), "-5");
    const s = await getSync(["uiScale", "notifyMinDiscount", "monthlyGoal", "notifyMaxPrice"]);
    expect(s).toEqual({ uiScale: 1.6, notifyMinDiscount: 90, monthlyGoal: 0, notifyMaxPrice: 0 });
    expect($("uiScale").value).toBe("1.6");
  });

  it("saves the preferred languages as a clean list", async () => {
    await boot();
    await change($("preferredLanguages"), " Hebrew, ,English ,");
    expect((await getSync(["preferredLanguages"])).preferredLanguages).toEqual(["Hebrew", "English"]);
    await boot({ preferredLanguages: ["German"] });
    expect($("preferredLanguages").value).toBe("German");
  });
});

describe("My PC", () => {
  it("stores what you type, never detects anything, and clears when emptied", async () => {
    await boot();
    await change($("myPcRam"), "16");
    await change($("myPcStorage"), "200");
    await change($("myPcGpu"), "RTX 3060");
    expect((await getLocal(["myPc"])).myPc).toMatchObject({ ramGB: 16, storageGB: 200, gpu: "RTX 3060", cpu: "", os: "" });
    for (const id of ["myPcRam", "myPcStorage", "myPcGpu"]) await change($(id), "");
    expect((await getLocal(["myPc"])).myPc).toBeNull();
  });

  it("shows a saved profile", async () => {
    await boot({ myPc: { ramGB: 32, vramGB: 8, storageGB: 500, os: "Windows 11", cpu: "Ryzen", gpu: "RTX" } });
    expect($("myPcRam").value).toBe("32");
    expect($("myPcCpu").value).toBe("Ryzen");
  });
});

describe("notification rules", () => {
  it("saves quiet hours as one object", async () => {
    await boot();
    expect($("quietFrom").value).toBe("22:00");
    await change($("quietEnabled"), true);
    await change($("quietFrom"), "23:30");
    await change($("quietTo"), "07:15");
    expect((await getSync(["quietHours"])).quietHours).toEqual({ enabled: true, from: "23:30", to: "07:15" });
  });

  it("adds, lists and removes alerts by tag", async () => {
    await boot({ tags: { a: ["co-op", "rpg"] }, targetCurrency: "EUR" });
    expect($("tagAlertsList").textContent).toBe("No tag alerts yet.");
    expect([...$("tagAlertTagOptions").children].map((o) => o.value)).toEqual(["co-op", "rpg"]);
    expect($("tagAlertCurrency").value).toBe("EUR");
    $("tagAlertTag").value = "co-op";
    $("tagAlertAmount").value = "10";
    $("tagAlertAdd").click();
    await tick(10);
    expect((await getLocal(["tagAlerts"])).tagAlerts).toEqual({ "co-op": { threshold: 10, currency: "EUR" } });
    expect($("tagAlertsList").textContent).toContain("co-op");
    expect($("tagAlertsList").textContent).toContain("at or under 10 EUR");
    expect($("tagAlertTag").value).toBe("");
    // incomplete input is ignored
    $("tagAlertTag").value = "x";
    $("tagAlertAdd").click();
    await tick();
    expect(Object.keys((await getLocal(["tagAlerts"])).tagAlerts)).toEqual(["co-op"]);
    $("tagAlertsList").querySelector("button[data-remove]").click();
    await tick(10);
    expect((await getLocal(["tagAlerts"])).tagAlerts).toEqual({});
  });
});

describe("webhook", () => {
  const url = "https://discord.com/api/webhooks/123/abc";

  it("asks the browser for access to that one address, then saves it", async () => {
    await boot();
    $("webhookUrl").value = url;
    await V4.saveWebhook();
    expect(chrome.permissions.request).toHaveBeenCalledWith({ origins: ["https://discord.com/*"] });
    expect((await getLocal(["webhookUrl"])).webhookUrl).toBe(url);
    expect($("webhookStatus").textContent).toContain("https://discord.com");
  });

  it("saves nothing when permission is refused, or for a non-https address", async () => {
    await boot();
    chrome.permissions.request.mockResolvedValue(false);
    $("webhookUrl").value = url;
    await V4.saveWebhook();
    expect((await window.GOGPlusStorage.get(["webhookUrl"])).webhookUrl).toBe("");
    expect($("webhookStatus").classList.contains("has-error")).toBe(true);

    chrome.permissions.request.mockClear();
    $("webhookUrl").value = "http://example.com/hook";
    await V4.saveWebhook();
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect($("webhookStatus").textContent).toContain("https");
  });

  it("reports a permission API failure", async () => {
    await boot();
    chrome.permissions.request.mockRejectedValue(new Error("boom"));
    $("webhookUrl").value = url;
    await V4.saveWebhook();
    expect($("webhookStatus").textContent).toContain("boom");
  });

  it("removes the webhook when the address is emptied", async () => {
    await boot({ webhookUrl: url, webhookEnabled: true });
    $("webhookUrl").value = "";
    await V4.saveWebhook();
    const s = await getLocal(["webhookUrl", "webhookEnabled"]);
    expect(s).toEqual({ webhookUrl: "", webhookEnabled: false });
    expect($("webhookEnabled").checked).toBe(false);
  });

  it("sends a test through the service worker and says how it went", async () => {
    await boot();
    await V4.testWebhook();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "webhook-test" });
    expect($("webhookStatus").textContent).toContain("delivered");
    chrome.runtime.sendMessage.mockResolvedValue({ ok: false, error: "HTTP 404" });
    await V4.testWebhook();
    expect($("webhookStatus").textContent).toContain("HTTP 404");
    chrome.runtime.sendMessage.mockRejectedValue(new Error("asleep"));
    await V4.testWebhook();
    expect($("webhookStatus").textContent).toContain("asleep");
  });
});

describe("settings profiles", () => {
  it("applies a profile and reports which one matches", async () => {
    await boot();
    expect($("settingsProfileHint").textContent).toContain("custom");
    await change($("settingsProfile"), "accessible");
    $("settingsProfileApply").click();
    await tick(10);
    const s = await getSync(["calmMode", "dyslexiaFont", "uiScale", "theme"]);
    expect(s).toMatchObject({ calmMode: true, dyslexiaFont: true, uiScale: 1.25, theme: "highcontrast" });
    expect($("settingsProfileHint").textContent).toContain("“Accessible”");
  });

  it("does nothing without a choice, and the tour button opens the tour page", async () => {
    await boot();
    $("settingsProfileApply").click();
    await tick();
    expect(await getSync(["calmMode"])).toEqual({});
    $("replayTour").click();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining("tour/tour.html") });
  });
});
