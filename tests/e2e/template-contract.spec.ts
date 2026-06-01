import { test, expect } from "@playwright/test";

const SAMPLE = {
  meta: {
    persNr: "1", geburtsdatum: "", stKl: "1", faktor: "", kiFrbtr: "0",
    konfession: "", freibetragJ: "", freibetragM: "", dba: "", midijob: "",
    stTg: "30", vjUrlUeb: "", urlAnspr: "", urlTgGen: "", resturlaub: "",
    anwTage: "", urlaubTage: "", krankhTg: "", fehlzTage: "", anwStd: "",
    urlaubStd: "", krankhStd: "", fehlzStd: "", zeitlohnStd: "", ueberstd: "",
    bezStd: "", svNummer: "", krankenkasse: "", kkProzent: "", pgrs: "",
    bgrs: "", umSvTg: "", eintritt: "010126", austritt: "", steuerId: "",
    mfb: "", rocCode: "", mandant: "", druckdatum: "31.03.2026", blatt: "1",
    persNrBox: "1", abtNr: "1", bn: "B/N", mandantBox: "",
  },
  firma: "Test GmbH",
  mitarbeiter: { name: "Max", strasse: "Weg 1", plzOrt: "10115 Berlin" },
  zeitraum: { monat: "März", jahr: "2026" },
  brutto: [
    { lohnart: "100", bezeichnung: "Normalstunden", einheit: "Std", menge: "100,00", faktor: "20,00", prozent: "", st: "L", sv: "L", gb: "J" },
  ],
  steuer: [], sv: [], nettoBezuege: [],
  verdienst: {
    nachberechnungVorjahr: false, gesamtBrutto: "", steuerBrutto: "",
    lohnsteuer: "", kirchensteuer: "", soli: "", steuerfreieBezuege: "",
    pVerstZukSich: "", pfaendungRest: "", darlehenRest: "", svBrutto: "",
    kvBeitrag: "", rvBeitrag: "", avBeitrag: "", pvBeitrag: "", vwlGesamt: "",
    kugAuszahlung: "",
  },
  bank: { name: "", iban: "", svAgAnteil: "", zusAgKosten: "", gesamtkosten: "", code: "" },
  hinweiseZurAbrechnung: "",
  automatik: {
    enabled: true, steuerklasse: 1, faktor: "", konfession: "",
    bundesland: "BE", freibetragMonatlich: "", kkZusatzbeitrag: "2,69",
    kinder: 0, age: 30, midijob: false, westOst: "W",
  },
};

async function postState(
  page: import("@playwright/test").Page,
  file: string,
  state: unknown,
) {
  await page.goto(`/templates/${file}`);
  await page.evaluate((s) => {
    window.postMessage({ type: "setState", state: s }, "*");
  }, state);
  await page.waitForTimeout(150); // let the message loop render
}

test("datev-classic self-computes the Verdienst summary under automatik", async ({ page }) => {
  await postState(page, "datev-classic.html", SAMPLE);
  // Gesamt-Brutto = 100,00 * 20,00 = 2.000,00
  await expect(page.locator("#gesamtBruttoCell")).toHaveText("2.000,00");
  await expect(page.locator("#vGesamtBrutto")).toHaveText("2.000,00");
  await expect(page.locator("#vLohnsteuer")).not.toHaveText("");
});

test("datev-classic renders injected cumulative sums verbatim", async ({ page }) => {
  const withCumulative = {
    ...SAMPLE,
    cumulative: {
      monatszahl: 3, gesamtBrutto: 6000, steuerBrutto: 6000, svBrutto: 6000,
      lohnsteuer: 600, kirchensteuer: 0, soli: 0, kvBeitrag: 50, rvBeitrag: 50,
      avBeitrag: 10, pvBeitrag: 10, auszahlung: 4800,
    },
  };
  await postState(page, "datev-classic.html", withCumulative);
  await expect(page.locator("#yGesamtBrutto")).toHaveText("6.000,00");
  await expect(page.locator("#yLohnsteuer")).toHaveText("600,00");
  await expect(page.locator("#yAuszahlungCell")).toHaveText("4.800,00");
  await expect(page.locator("#yearSuffix")).toContainText("3 Monate");
});

const CUMULATIVE_TEMPLATES = [
  "datev-classic.html", "lexware-classic.html", "sage-classic.html",
  "viper-classic.html", "neon-classic.html", "atlas-classic.html",
  "aurora-classic.html", "ledger-classic.html", "slate-classic.html",
  "prism-classic.html", "quartz-classic.html",
];

for (const file of CUMULATIVE_TEMPLATES) {
  test(`${file}: autoVerdienst + cumulative branch work`, async ({ page }) => {
    await postState(page, file, {
      ...SAMPLE,
      cumulative: {
        monatszahl: 2, gesamtBrutto: 4000, steuerBrutto: 4000, svBrutto: 4000,
        lohnsteuer: 400, kirchensteuer: 0, soli: 0, kvBeitrag: 40, rvBeitrag: 40,
        avBeitrag: 8, pvBeitrag: 8, auszahlung: 3200,
      },
    });
    await expect(page.locator("#vGesamtBrutto")).toHaveText("2.000,00");
    await expect(page.locator("#yGesamtBrutto")).toHaveText("4.000,00");
  });
}
