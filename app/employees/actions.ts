"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildEmployeeData } from "@/lib/employee-data";
import {
  createEmployee,
  updateEmployee,
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
