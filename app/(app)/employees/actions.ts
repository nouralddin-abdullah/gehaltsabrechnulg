"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildEmployeeData } from "@/lib/employee-data";
import {
  createEmployee,
  updateEmployee,
  getEmployee,
  deleteEmployee as deleteEmployeeDb,
} from "@/lib/db/employees";

export async function saveEmployee(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const companyRaw = String(formData.get("company_id") ?? "");
  const company_id = companyRaw === "" ? null : companyRaw;
  const data = buildEmployeeData(formData);

  if (id) {
    await updateEmployee(id, { company_id, data });
  } else {
    await createEmployee({ company_id, data });
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deleteEmployee(formData: FormData): Promise<void> {
  await deleteEmployeeDb(String(formData.get("id")));
  revalidatePath("/dashboard");
}

// --- Wizard ---
// (type kept internal: a "use server" module may only export async functions)
type WizardSaveState = { employeeId?: string; error?: string };

// Step 1: create the employee draft and return its id (no redirect).
export async function saveEmployeeStep(
  _prev: WizardSaveState,
  formData: FormData,
): Promise<WizardSaveState> {
  const companyRaw = String(formData.get("company_id") ?? "");
  const company_id = companyRaw === "" ? null : companyRaw;
  const data = buildEmployeeData(formData);
  const employee = await createEmployee({ company_id, data });
  revalidatePath("/dashboard");
  return { employeeId: employee.id };
}

// Step 2: attach the chosen company to the employee.
export async function setEmployeeCompany(
  employeeId: string,
  companyId: string | null,
): Promise<void> {
  const emp = await getEmployee(employeeId);
  if (!emp) return;
  await updateEmployee(employeeId, { company_id: companyId, data: emp.data });
}
