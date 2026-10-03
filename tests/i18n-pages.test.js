import { describe, it, expect, beforeEach } from "vitest";

await import("../extension/lib/i18n.js");
await import("../extension/lib/i18n-pages.js");

const P = () => window.GOGPlusPageI18n;
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

// A tiny private vocabulary, so these tests say what the translator does rather
// than what the shipped rows happen to contain.
P().add([
  ["Save", "שמור", "Сохранить", "Zapisz", "Speichern", "Enregistrer", "Guardar"],
  ["{n} games", "{1} משחקים", "{1} {1#игра|игры|игр}", "{1} {1#gra|gry|gier}", "{1} Spiele", "{1} jeux", "{1} juegos"],
  ["{n} game", "משחק {1}", "{1} игра", "{1} gra", "{1} Spiel", "{1} jeu", "{1} juego"],
  ["Mark as {}", "סמן כ{1}", "Отметить: {1}", "Oznacz jako {1}", "Markieren als {1}", "Marquer comme {1}", "Marcar como {1}"],
  ["Playing", "משחק", "Играю", "Gram", "Spiele gerade", "En cours", "Jugando"],
  ["Fetched from <1>frankfurter.app</1> every <2>12</2> hours.", "כל <2>12</2> שעות מתקבל מ־<1>frankfurter.app</1>.", "Раз в <2>12</2> ч. из <1>frankfurter.app</1>.", "Co <2>12</2> godz. z <1>frankfurter.app</1>.", "Alle <2>12</2> Std. von <1>frankfurter.app</1>.", "Toutes les <2>12</2> h depuis <1>frankfurter.app</1>.", "Cada <2>12</2> h desde <1>frankfurter.app</1>."],
  ["Across <1>{n}</1> drops, <2>{}</2> leads.", "ב־<1>{1}</1> ירידות, <2>{2}</2> מובילה.", "Из <1>{1}</1> снижений лидирует <2>{2}</2>.", "Z <1>{1}</1> spadków prowadzi <2>{2}</2>.", "Bei <1>{1}</1> Preissenkungen führt <2>{2}</2>.", "Sur <1>{1}</1> baisses, <2>{2}</2> mène.", "De <1>{1}</1> bajadas, lidera <2>{2}</2>."],
]);

beforeEach(() => {
  document.documentElement.setAttribute("lang", "en");
  document.body.innerHTML = "";
  P().apply(document.body, "en");
});

describe("translate", () => {
  it("looks up exact English, ignoring surrounding whitespace and keeping it", () => {
    expect(P().translate("Save", "he")).toBe("שמור");
    expect(P().translate("  Save \n", "de")).toBe("  Speichern \n");
    expect(P().translate("Something else", "he")).toBeNull();
    expect(P().translate("42", "he")).toBeNull();
    expect(P().translate("Save", "xx")).toBeNull();
  });

  it("matches {n} to numbers only", () => {
    expect(P().translate("12 games", "he")).toBe("12 משחקים");
    expect(P().translate("Wishlisted games", "he")).toBeNull();
    expect(P().translate("1 game", "fr")).toBe("1 jeu");
  });

  it("matches {} to anything and translates what it caught", () => {
    expect(P().translate("Mark as Playing", "ru")).toBe("Отметить: Играю");
    expect(P().translate("Mark as Retro", "ru")).toBe("Отметить: Retro");
  });

  it("picks the Russian and Polish plural form by the number", () => {
    const ru = (n) => P().translate(`${n} games`, "ru");
    expect([1, 2, 5, 11, 21, 22, 25, 101, 112].map(ru)).toEqual(["1 игра", "2 игры", "5 игр", "11 игр", "21 игра", "22 игры", "25 игр", "101 игра", "112 игр"]);
    const pl = (n) => P().translate(`${n} games`, "pl");
    expect([1, 2, 5, 12, 22, 25].map(pl)).toEqual(["1 gra", "2 gry", "5 gier", "12 gier", "22 gry", "25 gier"]);
  });

  it("english and german use one|other", () => {
    expect(P().pluralIndex(1, "de")).toBe(0);
    expect(P().pluralIndex(0, "de")).toBe(1);
    expect(P().pluralIndex(2, "fr")).toBe(1);
  });

  it("tx falls back to the English", () => {
    document.documentElement.setAttribute("lang", "he");
    expect(P().tx("Save")).toBe("שמור");
    expect(P().tx("Unknown text")).toBe("Unknown text");
    expect(P().tx("Save", "es")).toBe("Guardar");
  });
});

describe("apply", () => {
  it("translates text nodes and the title / placeholder / aria-label attributes", () => {
    document.body.innerHTML = `<button id="b" title="Save" aria-label="Save">Save</button><input id="i" placeholder="Save">`;
    P().apply(document.body, "de");
    expect(document.getElementById("b").textContent).toBe("Speichern");
    expect(document.getElementById("b").title).toBe("Speichern");
    expect(document.getElementById("b").getAttribute("aria-label")).toBe("Speichern");
    expect(document.getElementById("i").placeholder).toBe("Speichern");
  });

  it("goes from one language to another, and back to the original English", () => {
    document.body.innerHTML = `<p id="p">Save</p>`;
    P().apply(document.body, "he");
    expect(document.getElementById("p").textContent).toBe("שמור");
    P().apply(document.body, "fr");
    expect(document.getElementById("p").textContent).toBe("Enregistrer");
    P().apply(document.body, "en");
    expect(document.getElementById("p").textContent).toBe("Save");
  });

  it("leaves opted-out subtrees alone", () => {
    document.body.innerHTML = `<span id="a" translate="no">Save</span><span id="b" data-no-i18n>Save</span><div data-no-i18n><b id="c">Save</b></div><code id="d">Save</code>`;
    P().apply(document.body, "he");
    for (const id of ["a", "b", "c", "d"]) expect(document.getElementById(id).textContent).toBe("Save");
  });

  it("translates what the page draws afterwards, and keeps the originals straight across switches", async () => {
    P().apply(document.body, "he");
    const p = document.createElement("p");
    p.textContent = "Save";
    document.body.appendChild(p);
    await tick();
    expect(p.textContent).toBe("שמור");
    p.textContent = "Playing"; // the page rewrites its own text
    await tick();
    expect(p.textContent).toBe("משחק");
    P().apply(document.body, "en");
    expect(p.textContent).toBe("Playing");
  });

  it("does not loop on its own writes", async () => {
    document.body.innerHTML = `<p id="p">Fetched from <a>frankfurter.app</a> every <b>12</b> hours.</p><i title="Save">x</i>`;
    P().apply(document.body, "he");
    await tick(30);
    const before = document.body.innerHTML;
    await tick(60);
    expect(document.body.innerHTML).toBe(before);
  });

  it("is a no-op without a row", () => {
    document.body.innerHTML = `<p id="p">No row for this</p>`;
    P().apply(document.body, "he");
    expect(document.getElementById("p").textContent).toBe("No row for this");
  });
});

describe("a sentence with highlighted words", () => {
  it("is translated as one piece, with the highlights moved to where the translation puts them", () => {
    document.body.innerHTML = `<p id="p">Fetched from <a href="#x">frankfurter.app</a> every <b>12</b> hours.</p>`;
    P().apply(document.body, "he");
    const p = document.getElementById("p");
    expect(p.textContent).toBe("כל 12 שעות מתקבל מ־frankfurter.app.");
    expect(p.querySelector("a").getAttribute("href")).toBe("#x"); // the very same element, attributes intact
    expect(p.firstChild.nodeType).toBe(3);
    expect(p.children[0].tagName).toBe("B");
    expect(p.children[1].tagName).toBe("A");
  });

  it("fills numbers and translated names into the highlights", () => {
    document.body.innerHTML = `<p id="p">Across <strong>12</strong> drops, <em>Playing</em> leads.</p>`;
    P().apply(document.body, "ru");
    expect(document.getElementById("p").textContent).toBe("Из 12 снижений лидирует Играю.");
    expect(document.querySelectorAll("#p strong, #p em")).toHaveLength(2);
  });

  it("restores the original structure when switching back, and between languages", () => {
    document.body.innerHTML = `<p id="p">Fetched from <a>frankfurter.app</a> every <b>12</b> hours.</p>`;
    const [a, b] = [document.querySelector("a"), document.querySelector("b")];
    P().apply(document.body, "de");
    expect(document.getElementById("p").textContent).toBe("Alle 12 Std. von frankfurter.app.");
    P().apply(document.body, "fr");
    expect(document.getElementById("p").textContent).toBe("Toutes les 12 h depuis frankfurter.app.");
    P().apply(document.body, "en");
    const p = document.getElementById("p");
    expect(p.textContent).toBe("Fetched from frankfurter.app every 12 hours.");
    expect([...p.children]).toEqual([a, b]);
  });

  it("is left alone when the page has already redrawn it", async () => {
    document.body.innerHTML = `<p id="p">Fetched from <a>frankfurter.app</a> every <b>12</b> hours.</p>`;
    P().apply(document.body, "he");
    const p = document.getElementById("p");
    p.innerHTML = `Something <b>new</b> here`;
    P().apply(document.body, "en");
    expect(p.textContent).toBe("Something new here");
  });
});

describe("GOGPlusI18n.apply calls it", () => {
  it("translates the page in the same call that sets lang and dir", () => {
    document.body.innerHTML = `<p id="p">Save</p>`;
    window.GOGPlusI18n.apply("he");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(document.getElementById("p").textContent).toBe("שמור");
    window.GOGPlusI18n.apply("en");
    expect(document.getElementById("p").textContent).toBe("Save");
  });
});
