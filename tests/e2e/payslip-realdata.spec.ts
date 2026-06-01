import { test, expect } from "@playwright/test";

// Real input + results taken from an authentic DATEV payslip:
//   "Gehaltsabrechnung 10_2023" — Yacoub Youssef Abu Naaj, ILS Integrated Lab Solutions GmbH.
// Automatik is OFF: we feed the slip's own gross lines + the per-row Lohnsteuer/SV
// figures exactly as printed, and assert the engine reproduces the document's
// Gesamt-Brutto (3.565,00) and Auszahlungsbetrag (2.707,06). These are pure
// sums/subtraction, so they are year-independent — a faithful check of the slip
// assembly + net calc against a real document. (The 2023 Lohnsteuer/SV amounts
// themselves are entered as given; the templates' auto-engine is 2026-rate and is
// not used here.)

const META = {
  persNr: "00107", geburtsdatum: "021097", stKl: "1", faktor: "",
  kiFrbtr: "", konfession: "", freibetragJ: "", freibetragM: "",
  dba: "", midijob: "Ja", stTg: "30",
  vjUrlUeb: "", urlAnspr: "", urlTgGen: "", resturlaub: "",
  anwTage: "", urlaubTage: "", krankhTg: "", fehlzTage: "",
  anwStd: "", urlaubStd: "", krankhStd: "", fehlzStd: "",
  zeitlohnStd: "", ueberstd: "", bezStd: "",
  svNummer: "25021097A060", krankenkasse: "AOK Sachsen-Anhalt", kkProzent: "",
  pgrs: "0100", bgrs: "2", umSvTg: "30",
  eintritt: "290719", austritt: "", steuerId: "15270956832", mfb: "",
  rocCode: "R0C", mandant: "133267/30605/00107", druckdatum: "23.10.2023",
  blatt: "1", persNrBox: "00107", abtNr: "1", bn: "B/N", mandantBox: "30605",
};

const OKTOBER_2023 = {
  meta: META,
  firma: "ILS Integrated Lab Solutions GmbH*Barbara-McClintock-Straße 11*12489 Berlin",
  mitarbeiter: {
    name: "Yacoub Youssef Abu Naaj",
    strasse: "Joachimsthaler Str. 6",
    plzOrt: "13055 Berlin",
  },
  zeitraum: { monat: "Oktober", jahr: "2023" },
  brutto: [
    { lohnart: "1000", bezeichnung: "Stundenlohn", einheit: "Std", menge: "79,75", faktor: "20,00", prozent: "", st: "L", sv: "L", gb: "J" },
    { lohnart: "1012", bezeichnung: "Feiertagslohn", einheit: "Std", menge: "8,00", faktor: "20,00", prozent: "", st: "L", sv: "L", gb: "J" },
    { hinweis: true, text: "Nachberechnung 09/2023: - Midijob nicht angewandt -" },
    { lohnart: "1000", bezeichnung: "Stundenlohn", einheit: "Std", menge: "90,50", faktor: "20,00", prozent: "", st: "L", sv: "L", gb: "J" },
  ],
  steuer: [
    { tag: "L", steuerBrutto: "1.755,00", lohnsteuer: "79,25", kirchensteuer: "", soli: "" },
    { tag: "N", steuerBrutto: "1.810,00", lohnsteuer: "441,75", kirchensteuer: "", soli: "" },
  ],
  sv: [
    { tag: "L", kvBrutto: "", rvBrutto: "1.668,92", avBrutto: "", pvBrutto: "", kvBeitrag: "", rvBeitrag: "155,21", avBeitrag: "", pvBeitrag: "" },
    { tag: "N", kvBrutto: "", rvBrutto: "1.854,34", avBrutto: "", pvBrutto: "", kvBeitrag: "", rvBeitrag: "181,73", avBeitrag: "", pvBeitrag: "" },
  ],
  nettoBezuege: [],
  verdienst: {
    nachberechnungVorjahr: true, gesamtBrutto: "", steuerBrutto: "",
    lohnsteuer: "", kirchensteuer: "", soli: "", steuerfreieBezuege: "",
    pVerstZukSich: "", pfaendungRest: "", darlehenRest: "", svBrutto: "",
    kvBeitrag: "", rvBeitrag: "", avBeitrag: "", pvBeitrag: "", vwlGesamt: "",
    kugAuszahlung: "",
  },
  bank: {
    name: "Deutsche Bank", iban: "DE97 1007 0124 0303 6XXX XX",
    svAgAnteil: "", zusAgKosten: "", gesamtkosten: "", code: "32946",
  },
  hinweiseZurAbrechnung: "",
  automatik: {
    enabled: false, steuerklasse: 1, faktor: "", konfession: "",
    bundesland: "", freibetragMonatlich: "", kkZusatzbeitrag: "",
    kinder: 0, age: 0, midijob: false, westOst: "W",
  },
};

async function postState(
  page: import("@playwright/test").Page,
  state: unknown,
) {
  await page.goto("/templates/datev-classic.html");
  await page.evaluate((s) => {
    window.postMessage({ type: "setState", state: s }, "*");
  }, state);
  await page.waitForTimeout(150);
}

test("per month: engine reproduces the real slip's Gesamt-Brutto and Auszahlungsbetrag", async ({
  page,
}) => {
  await postState(page, OKTOBER_2023);
  // headline numbers straight off the real document
  await expect(page.locator("#gesamtBruttoCell")).toHaveText("3.565,00");
  await expect(page.locator("#fAuszahlung")).toHaveText("2.707,06");
  // the per-row tax/SV sums that produce that net
  await expect(page.locator("#steuerTotal")).toHaveText("521,00");
  await expect(page.locator("#svTotal")).toHaveText("336,94");
});

test("total: the Jahres-Werte block shows the true sum of three months", async ({
  page,
}) => {
  // October (real) + two fabricated months; sums computed by hand for the assertion:
  //   Gesamt-Brutto 3.565 + 3.000 + 4.000 = 10.565,00
  //   Lohnsteuer    521   + 450   + 600   =  1.571,00
  //   RV-Beitrag    336,94+ 279   + 372   =    987,94
  //   Auszahlung    2.707,06 + 2.300 + 3.000 = 8.007,06
  const cumulative = {
    monatszahl: 3,
    gesamtBrutto: 10565, steuerBrutto: 10565, svBrutto: 9523.26,
    lohnsteuer: 1571, kirchensteuer: 0, soli: 0,
    kvBeitrag: 0, rvBeitrag: 987.94, avBeitrag: 0, pvBeitrag: 0,
    auszahlung: 8007.06,
  };
  await postState(page, { ...OKTOBER_2023, cumulative });
  await expect(page.locator("#yGesamtBrutto")).toHaveText("10.565,00");
  await expect(page.locator("#yLohnsteuer")).toHaveText("1.571,00");
  await expect(page.locator("#yRvBeitrag")).toHaveText("987,94");
  await expect(page.locator("#yAuszahlungCell")).toHaveText("8.007,06");
  await expect(page.locator("#yearSuffix")).toContainText("3 Monate");
});
