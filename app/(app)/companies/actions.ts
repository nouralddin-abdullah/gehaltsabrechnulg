"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCompany as createCompanyDb,
  updateCompany as updateCompanyDb,
  deleteCompany as deleteCompanyDb,
} from "@/lib/db/companies";
import type { Company } from "@/lib/db/types";

function readCompany(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    firma: String(formData.get("firma") ?? ""),
    mandant: String(formData.get("mandant") ?? ""),
    mandant_box: String(formData.get("mandant_box") ?? ""),
    roc_code: String(formData.get("roc_code") ?? ""),
    default_template: String(formData.get("default_template") ?? "datev-classic"),
  };
}

export async function createCompany(formData: FormData): Promise<void> {
  await createCompanyDb(readCompany(formData));
  revalidatePath("/companies");
}

// Used by the wizard's inline add; returns the created company.
export async function createCompanyReturning(formData: FormData): Promise<Company> {
  const company = await createCompanyDb(readCompany(formData));
  revalidatePath("/companies");
  return company;
}

export async function updateCompany(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  await updateCompanyDb(id, readCompany(formData));
  revalidatePath("/companies");
  redirect("/companies");
}

export async function deleteCompany(formData: FormData): Promise<void> {
  await deleteCompanyDb(String(formData.get("id")));
  revalidatePath("/companies");
}
