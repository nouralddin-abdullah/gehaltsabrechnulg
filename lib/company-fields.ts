export type CompanyField = {
  name: string;
  label: string;
  description: string;
  example?: string;
};

export const COMPANY_FIELDS: CompanyField[] = [
  { name: "name", label: "Company name", description: "Shown in the dropdown and printed on the slip as the company name line.", example: "ACME GmbH" },
  { name: "firma", label: "Employer address", description: "Address printed under the name; use * to separate lines. Leave blank to print the name only.", example: "Rankestr. 2*10789 Berlin" },
  { name: "mandant", label: "Mandant-Code (oben)", description: "Full Mandant code line printed at the top.", example: "133267/30605/00107" },
  { name: "mandant_box", label: "Mandant-Code (Box)", description: "Short Mandant value printed in the small box. Often just one segment of the code above.", example: "30605" },
  { name: "roc_code", label: "R0C-Code", description: "Optional R0C reference code.", example: "R0C9" },
];
