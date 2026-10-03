import { describe, it, expect, beforeEach } from "vitest";
import { resetEnv, tick, state } from "./helpers/content-env.js";
import { gamePageHtml } from "./helpers/fixtures.js";

const C = () => window.GOGPlusPanelChrome;
const SLUG = "the_witcher_3";

function body(ids = ["a", "b", "c"]) {
  document.body.innerHTML = '<div id="gog-plus-gp-body"></div>';
  const el = document.getElementById("gog-plus-gp-body");
  for (const id of ids) {
    const s = document.createElement("section");
    s.className = "gog-plus-gp-section";
    s.innerHTML = `<h3>Section ${id} <span class="gog-plus-gp-since">x</span></h3><p>content ${id}</p>`;
    C().decorate(s, id);
    el.appendChild(s);
  }
  return el;
}
const ids = (el) => [...el.querySelectorAll(":scope > [data-section-id]")].map((s) => s.dataset.sectionId);
const stored = (key) => new Promise((r) => chrome.storage.sync.get([key], (v) => r(v[key])));

beforeEach(() => resetEnv({ path: `/en/game/${SLUG}`, bodyClass: "productcard _prices-in-usd user-logged-in", settings: { priceCompareTable: false } }));

describe("decorate", () => {
  it("adds a collapse caret and a grip, labelled for assistive tech", () => {
    const el = body();
    const h3 = el.querySelector("section h3");
    const toggle = h3.querySelector(".gog-plus-gp-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Collapse Section a x");
    expect(h3.querySelector(".gog-plus-gp-grip").getAttribute("aria-label")).toContain("Reorder Section a x");
    expect(h3.firstElementChild).toBe(toggle);
  });

  it("collapses on click, remembers it, and expands again", async () => {
    const el = body();
    const s = el.querySelector("section");
    s.querySelector(".gog-plus-gp-toggle").click();
    expect(s.classList.contains("is-collapsed")).toBe(true);
    expect(s.querySelector(".gog-plus-gp-toggle").getAttribute("aria-expanded")).toBe("false");
    expect(s.querySelector(".gog-plus-gp-toggle").textContent).toBe("▸");
    await tick(5);
    expect(await stored("panelCollapsed")).toEqual({ a: true });
    s.querySelector(".gog-plus-gp-toggle").click();
    expect(s.classList.contains("is-collapsed")).toBe(false);
    await tick(5);
    expect(await stored("panelCollapsed")).toEqual({ a: false });
  });

  it("starts collapsed when the saved state says so", () => {
    state.settings.panelCollapsed = { b: true };
    const el = body();
    expect(el.querySelector('[data-section-id="b"]').classList.contains("is-collapsed")).toBe(true);
    expect(el.querySelector('[data-section-id="a"]').classList.contains("is-collapsed")).toBe(false);
  });

  it("ignores a section without a heading", () => {
    const s = document.createElement("section");
    C().decorate(s, "x");
    expect(s.dataset.sectionId).toBe("x");
    expect(s.querySelector("button")).toBeNull();
  });
});

describe("ordering", () => {
  it("applies the saved order and leaves unknown sections after the known ones", () => {
    state.settings.panelOrder = ["c", "a"];
    const el = body(["a", "b", "c", "d"]);
    C().applyOrder(el);
    expect(ids(el)).toEqual(["c", "a", "b", "d"]);
  });

  it("does nothing without a saved order", () => {
    const el = body();
    C().applyOrder(el);
    expect(ids(el)).toEqual(["a", "b", "c"]);
  });

  it("moves a section with Alt+Arrow and saves the new order", async () => {
    const el = body();
    const grip = el.querySelector('[data-section-id="b"] .gog-plus-gp-grip');
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true, cancelable: true }));
    expect(ids(el)).toEqual(["b", "a", "c"]);
    expect(document.activeElement).toBe(el.querySelector('[data-section-id="b"] .gog-plus-gp-grip'));
    el.querySelector('[data-section-id="b"] .gog-plus-gp-grip').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true }));
    expect(ids(el)).toEqual(["a", "b", "c"]);
    await tick(5);
    expect(await stored("panelOrder")).toEqual(["a", "b", "c"]);
  });

  it("does not move past either end, and ignores arrows without Alt", () => {
    const el = body();
    C().moveSection(el.querySelector('[data-section-id="a"]'), -1);
    C().moveSection(el.querySelector('[data-section-id="c"]'), 1);
    expect(ids(el)).toEqual(["a", "b", "c"]);
    const grip = el.querySelector('[data-section-id="b"] .gog-plus-gp-grip');
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(ids(el)).toEqual(["a", "b", "c"]);
  });

  it("reorders by drag and drop, using the drop position", async () => {
    const el = body();
    const [a, b, c] = ["a", "b", "c"].map((id) => el.querySelector(`[data-section-id="${id}"]`));
    a.querySelector(".gog-plus-gp-grip").dispatchEvent(new Event("pointerdown"));
    expect(a.draggable).toBe(true);
    a.dispatchEvent(new Event("dragstart", { bubbles: true }));
    expect(a.classList.contains("is-dragging")).toBe(true);
    // over c, lower half → after c
    c.getBoundingClientRect = () => ({ top: 0, height: 100 });
    const over = new Event("dragover", { cancelable: true });
    c.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(c.classList.contains("is-drop-target")).toBe(true);
    const drop = Object.assign(new Event("drop", { cancelable: true }), { clientY: 80 });
    c.dispatchEvent(drop);
    expect(ids(el)).toEqual(["b", "c", "a"]);
    a.dispatchEvent(new Event("dragend", { bubbles: true }));
    expect(a.draggable).toBe(false);
    expect(a.classList.contains("is-dragging")).toBe(false);
    expect(c.classList.contains("is-drop-target")).toBe(false);
    await tick(5);
    expect(await stored("panelOrder")).toEqual(["b", "c", "a"]);
    // upper half → before
    b.dispatchEvent(new Event("dragstart", { bubbles: true }));
    const drop2 = Object.assign(new Event("drop", { cancelable: true }), { clientY: 10 });
    a.getBoundingClientRect = () => ({ top: 0, height: 100 });
    a.dispatchEvent(drop2);
    expect(ids(el)).toEqual(["c", "b", "a"]);
  });

  it("ignores a drop of a section onto itself, and drags when nothing is being dragged", () => {
    const el = body();
    const a = el.querySelector('[data-section-id="a"]');
    a.dispatchEvent(new Event("dragstart", { bubbles: true }));
    const over = new Event("dragover", { cancelable: true });
    a.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(false);
    a.dispatchEvent(Object.assign(new Event("drop", { cancelable: true }), { clientY: 0 }));
    expect(ids(el)).toEqual(["a", "b", "c"]);
    a.dispatchEvent(new Event("dragend", { bubbles: true }));
    const b = el.querySelector('[data-section-id="b"]');
    const idle = new Event("dragover", { cancelable: true });
    b.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
    b.dispatchEvent(new Event("dragleave"));
  });
});

describe("the panel built by the game page", () => {
  beforeEach(() => {
    document.body.innerHTML = gamePageHtml();
  });
  const panel = () => document.getElementById("gog-plus-gamepanel");

  it("gets every section with a stable id, in the default order", async () => {
    await window.GOGPlusGamePage.ensureGamePagePanel(SLUG);
    const found = ids(panel().querySelector("#gog-plus-gp-body"));
    expect(found.slice(0, 3)).toEqual(["deal", "facts", "history"]);
    expect(found).toEqual(expect.arrayContaining(["sysreq", "refund", "alert", "library", "links", "tags"].filter((i) => i !== "sysreq")));
    expect(found.indexOf("deal")).toBeLessThan(found.indexOf("tags"));
  });

  it("honours the user's saved order and collapsed sections", async () => {
    state.settings.panelOrder = ["tags", "alert"];
    state.settings.panelCollapsed = { deal: true };
    await window.GOGPlusGamePage.ensureGamePagePanel(SLUG);
    const found = ids(panel().querySelector("#gog-plus-gp-body"));
    expect(found.slice(0, 2)).toEqual(["tags", "alert"]);
    expect(panel().querySelector('[data-section-id="deal"]').classList.contains("is-collapsed")).toBe(true);
  });

  it("survives a section that throws — the rest of the panel still renders", async () => {
    const real = window.GOGPlusGameExtras.renderFactsSection;
    window.GOGPlusGameExtras.renderFactsSection = () => {
      throw new Error("markup changed");
    };
    try {
      await window.GOGPlusGamePage.ensureGamePagePanel(SLUG);
      const found = ids(panel().querySelector("#gog-plus-gp-body"));
      expect(found).not.toContain("facts");
      expect(found).toContain("tags");
    } finally {
      window.GOGPlusGameExtras.renderFactsSection = real;
    }
  });

  it("shows the header tools: dock, plain look, reset", async () => {
    await window.GOGPlusGamePage.ensureGamePagePanel(SLUG);
    const tools = [...panel().querySelectorAll(".gog-plus-gp-tool")];
    expect(tools).toHaveLength(3);
    expect(tools[0].getAttribute("aria-pressed")).toBe("false");
    tools[0].click();
    await tick(5);
    expect(await stored("panelSticky")).toBe(true);
    tools[1].click();
    await tick(5);
    expect(await stored("plainLook")).toBe(true);
    expect(document.querySelector(".gog-plus-toast").textContent).toContain("Plain look on");
  });

  it("resets the layout and rebuilds the panel", async () => {
    state.settings.panelOrder = ["tags"];
    state.settings.panelCollapsed = { deal: true };
    await window.GOGPlusGamePage.ensureGamePagePanel(SLUG);
    const old = panel();
    old.querySelectorAll(".gog-plus-gp-tool")[2].click();
    await tick(20);
    expect(await stored("panelOrder")).toEqual([]);
    expect(await stored("panelCollapsed")).toEqual({});
    expect(panel()).not.toBe(old);
    expect(panel().querySelector('[data-section-id="deal"]').classList.contains("is-collapsed")).toBe(false);
  });

  it("applies the dock class from the setting", async () => {
    state.settings.panelSticky = true;
    await window.GOGPlusGamePage.ensureGamePagePanel(SLUG);
    expect(panel().classList.contains("gog-plus-gamepanel--dock")).toBe(true);
    state.settings.panelSticky = false;
    C().applyPanelMode(panel());
    expect(panel().classList.contains("gog-plus-gamepanel--dock")).toBe(false);
  });

  it("does not add the tools twice", async () => {
    await window.GOGPlusGamePage.ensureGamePagePanel(SLUG);
    C().addHeaderTools(panel());
    expect(panel().querySelectorAll(".gog-plus-gp-tools")).toHaveLength(1);
    C().addHeaderTools(document.createElement("div"));
  });
});
