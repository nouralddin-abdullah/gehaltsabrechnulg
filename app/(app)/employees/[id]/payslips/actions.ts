"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildPayslipData } from "@/lib/payslip-data";
import {
  createPayslip,
  savePayslipComputedTotals,
  setPayslipTemplate,
  updatePayslipData,
} from "@/lib/db/payslips";
import { printPayslip as printPayslipDb, type PrintResult } from "@/lib/db/credits";
import type { ComputedTotals } from "@/lib/db/types";

export async function createMonth(
  employeeId: string,
  templateId: string,
  formData: FormData,
): Promise<void> {
  const data = buildPayslipData(formData);
  const payslip = await createPayslip({
    employee_id: employeeId,
    template_id: templateId,
    data,
  });
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}/payslips/${payslip.id}`);
}

export async function saveComputedTotals(
  payslipId: string,
  totals: ComputedTotals,
): Promise<void> {
  await savePayslipComputedTotals(payslipId, totals);
}

// Print = spend a credit (first print of the employee) + assign/reuse the serial.
// All accounting is enforced atomically in the DB (print_payslip RPC).
export async function printPayslip(
  employeeId: string,
  payslipId: string,
): Promise<PrintResult> {
  const res = await printPayslipDb(payslipId);
  if (res.ok) {
    revalidatePath(`/employees/${employeeId}/payslips/${payslipId}`);
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/", "layout");
  }
  return res;
}

export async function changeTemplate(
  employeeId: string,
  payslipId: string,
  templateId: string,
): Promise<void> {
  await setPayslipTemplate(payslipId, templateId);
  revalidatePath(`/employees/${employeeId}/payslips/${payslipId}`);
}

// Edit an existing month's inputs, then return to its preview (status/serial kept).
export async function updateMonth(
  employeeId: string,
  payslipId: string,
  formData: FormData,
): Promise<void> {
  await updatePayslipData(payslipId, buildPayslipData(formData));
  revalidatePath(`/employees/${employeeId}/payslips/${payslipId}`);
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}/payslips/${payslipId}`);
}

// Like createMonth, but returns to the employee detail page (used by the wizard).
export async function createMonthThenDetail(
  employeeId: string,
  templateId: string,
  formData: FormData,
): Promise<void> {
  await createPayslip({
    employee_id: employeeId,
    template_id: templateId,
    data: buildPayslipData(formData),
  });
  revalidatePath(`/employees/${employeeId}`);
  redirect(`/employees/${employeeId}`);
}
