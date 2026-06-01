// The exact object a template renders. All values are strings as the user
// typed them (German-formatted, e.g. "2.855,29"); the template does the math.
export interface SlipMeta {
  persNr: string; geburtsdatum: string; stKl: string; faktor: string;
  kiFrbtr: string; konfession: string; freibetragJ: string; freibetragM: string;
  dba: string; midijob: string; stTg: string;
  vjUrlUeb: string; urlAnspr: string; urlTgGen: string; resturlaub: string;
  anwTage: string; urlaubTage: string; krankhTg: string; fehlzTage: string;
  anwStd: string; urlaubStd: string; krankhStd: string; fehlzStd: string;
  zeitlohnStd: string; ueberstd: string; bezStd: string;
  svNummer: string; krankenkasse: string; kkProzent: string;
  pgrs: string; bgrs: string; umSvTg: string;
  eintritt: string; austritt: string; steuerId: string; mfb: string;
  rocCode: string; mandant: string; druckdatum: string; blatt: string;
  persNrBox: string; abtNr: string; bn: string; mandantBox: string;
}

export interface BruttoRow {
  lohnart: string; bezeichnung: string; einheit: string;
  menge: string; faktor: string; prozent: string;
  st: string; sv: string; gb: string;
}

export interface SteuerRow {
  tag: string; steuerBrutto?: string; lohnsteuer?: string;
  kirchensteuer?: string; soli?: string;
}

export interface SvRow {
  tag: string; kvBrutto?: string; rvBrutto?: string; avBrutto?: string;
  pvBrutto?: string; kvBeitrag?: string; rvBeitrag?: string;
  avBeitrag?: string; pvBeitrag?: string;
}

export interface VerdienstBlock {
  nachberechnungVorjahr: boolean;
  gesamtBrutto: string; steuerBrutto: string; lohnsteuer: string;
  kirchensteuer: string; soli: string; steuerfreieBezuege: string;
  pVerstZukSich: string; pfaendungRest: string; darlehenRest: string;
  svBrutto: string; kvBeitrag: string; rvBeitrag: string;
  avBeitrag: string; pvBeitrag: string; vwlGesamt: string; kugAuszahlung: string;
}

export interface NettoRow { lohnart: string; bezeichnung: string; betrag: string; }

export interface BankBlock {
  name: string; iban: string; svAgAnteil: string;
  zusAgKosten: string; gesamtkosten: string; code: string;
}

// Drives the embedded Lohnsteuer/SV engine when enabled.
export interface AutomatikBlock {
  enabled: boolean; steuerklasse: number; faktor: string; konfession: string;
  bundesland: string; freibetragMonatlich: string; kkZusatzbeitrag: string;
  kinder: number; age: number; midijob: boolean; westOst: string;
}

export interface SlipState {
  meta: SlipMeta;
  firma: string;
  mitarbeiter: { name: string; strasse: string; plzOrt: string };
  zeitraum: { monat: string; jahr: string };
  brutto: BruttoRow[];
  steuer: SteuerRow[];
  sv: SvRow[];
  verdienst: VerdienstBlock;
  nettoBezuege: NettoRow[];
  bank: BankBlock;
  hinweiseZurAbrechnung: string;
  automatik: AutomatikBlock;
}
