"use server";

import { revalidatePath } from "next/cache";
import {
  createCompany as createCompanyDb,
  deleteCompany as deleteCompanyDb,
} from "@/lib/db/companies";

export async function createCompany(formData: FormData): Promise<void> {
  await createCompanyDb({
    name: String(formData.get("name") ?? "").trim(),
    firma: String(formData.get("firma") ?? ""),
    mandant: String(formData.get("mandant") ?? ""),
    mandant_box: String(formData.get("mandant_box") ?? ""),
    roc_code: String(formData.get("roc_code") ?? ""),
    default_template: String(
      formData.get("default_template") ?? "datev-classic",
    ),
  });
  revalidatePath("/companies");
}

export async function deleteCompany(formData: FormData): Promise<void> {
  await deleteCompanyDb(String(formData.get("id")));
  revalidatePath("/companies");
}
