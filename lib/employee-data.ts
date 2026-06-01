import type { Employee, EmployeeData } from "@/lib/db/types";

const CHECKBOX_PATHS = new Set(["automatik.enabled", "automatik.midijob"]);
const NUMBER_PATHS = new Set([
  "automatik.steuerklasse",
  "automatik.kinder",
  "automatik.age",
]);

export function buildEmployeeData(formData: FormData): EmployeeData {
  const data: EmployeeData = {
    mitarbeiter: { name: "", strasse: "", plzOrt: "" },
    meta: {},
    automatik: {
      enabled: false,
      steuerklasse: 1,
      faktor: "",
      konfession: "",
      bundesland: "",
      freibetragMonatlich: "",
      kkZusatzbeitrag: "",
      kinder: 0,
      age: 0,
      midijob: false,
      westOst: "W",
    },
  };

  for (const [path, raw] of formData.entries()) {
    if (!path.includes(".")) continue;
    const value = typeof raw === "string" ? raw : "";
    const [group, key] = path.split(".");
    if (CHECKBOX_PATHS.has(path)) {
      setNested(data, group, key, value === "on" || value === "true");
    } else if (NUMBER_PATHS.has(path)) {
      setNested(data, group, key, Number(value) || 0);
    } else {
      setNested(data, group, key, value);
    }
  }

  // checkboxes are absent from FormData when unchecked
  if (!formData.has("automatik.enabled")) data.automatik.enabled = false;
  if (!formData.has("automatik.midijob")) data.automatik.midijob = false;

  return data;
}

function setNested(
  data: EmployeeData,
  group: string,
  key: string,
  value: string | number | boolean,
) {
  const bucket = (data as unknown as Record<string, Record<string, unknown>>)[
    group
  ];
  if (bucket) bucket[key] = value;
}

export function filterEmployees<T extends { name: string }>(
  list: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((e) => e.name.toLowerCase().includes(q));
}
