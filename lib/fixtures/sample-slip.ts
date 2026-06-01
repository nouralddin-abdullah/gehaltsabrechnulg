import type { SlipState } from "@/lib/slip-state";

export const sampleSlip: SlipState = {
  meta: {
    persNr: "1122672", geburtsdatum: "250789", stKl: "1", faktor: "",
    kiFrbtr: "0", konfession: "", freibetragJ: "", freibetragM: "",
    dba: "", midijob: "", stTg: "30",
    vjUrlUeb: "", urlAnspr: "", urlTgGen: "", resturlaub: "1,67",
    anwTage: "", urlaubTage: "0,00", krankhTg: "", fehlzTage: "",
    anwStd: "", urlaubStd: "", krankhStd: "", fehlzStd: "",
    zeitlohnStd: "", ueberstd: "", bezStd: "",
    svNummer: "65250789E018", krankenkasse: "Techniker Krankenkasse",
    kkProzent: "17,29", pgrs: "1111", bgrs: "2", umSvTg: "29",
    eintritt: "020326", austritt: "020426", steuerId: "69814453022", mfb: "",
    rocCode: "", mandant: "343424421", druckdatum: "31.03.2026", blatt: "1",
    persNrBox: "1122672", abtNr: "1", bn: "B/N", mandantBox: "",
  },
  firma: "ALLPOWER Personalprofis GmbH*Rankestraße 2*10789 Berlin",
  mitarbeiter: {
    name: "Mohammed El-Korazatti",
    strasse: "Schützenstraße 28",
    plzOrt: "12526 Berlin",
  },
  zeitraum: { monat: "März", jahr: "2026" },
  brutto: [
    { lohnart: "100", bezeichnung: "Normalstunden", einheit: "Std", menge: "119,00", faktor: "16,69", prozent: "", st: "L", sv: "L", gb: "J" },
    { lohnart: "104", bezeichnung: "Einsatzzulage", einheit: "Std", menge: "8,00", faktor: "3,31", prozent: "", st: "L", sv: "L", gb: "J" },
    { lohnart: "133", bezeichnung: "Branchenzuschlag Vergleichslo", einheit: "Std", menge: "102,08", faktor: "3,31", prozent: "", st: "L", sv: "L", gb: "J" },
    { lohnart: "741", bezeichnung: "Fahrtkostenzuschuss (Aufwendu", einheit: "Tage", menge: "15,00", faktor: "2,50", prozent: "", st: "F", sv: "F", gb: "J" },
  ],
  steuer: [],
  sv: [],
  verdienst: {
    nachberechnungVorjahr: false,
    gesamtBrutto: "2.855,29", steuerBrutto: "2.817,79", lohnsteuer: "254,58",
    kirchensteuer: "", soli: "", steuerfreieBezuege: "37,50",
    pVerstZukSich: "", pfaendungRest: "", darlehenRest: "",
    svBrutto: "2.817,79", kvBeitrag: "243,60", rvBeitrag: "262,05",
    avBeitrag: "36,63", pvBeitrag: "67,63", vwlGesamt: "", kugAuszahlung: "",
  },
  nettoBezuege: [],
  bank: {
    name: "Landesbank Berlin - Berliner S",
    iban: "DE58 1005 0000 1064 1292 65",
    svAgAnteil: "", zusAgKosten: "", gesamtkosten: "", code: "",
  },
  hinweiseZurAbrechnung: "",
  automatik: {
    enabled: true, steuerklasse: 1, faktor: "", konfession: "",
    bundesland: "BE", freibetragMonatlich: "", kkZusatzbeitrag: "2,69",
    kinder: 0, age: 36, midijob: false, westOst: "W",
  },
};
