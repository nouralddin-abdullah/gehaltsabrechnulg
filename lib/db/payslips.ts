import { createClient } from "@/lib/supabase/server";
import type { ComputedTotals, Payslip, PayslipData } from "./types";
import { monthNumber } from "@/lib/payslip-data";

export async function listPayslipsForEmployee(
  employeeId: string,
): Promise<Payslip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("employee_id", employeeId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return data as Payslip[];
}

export async function getPayslip(id: string): Promise<Payslip | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Payslip | null;
}

export async function createPayslip(input: {
  employee_id: string;
  template_id: string;
  data: PayslipData;
}): Promise<Payslip> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const year = Number(input.data.zeitraum.jahr) || 0;
  const month = monthNumber(input.data.zeitraum.monat);
  const { data, error } = await supabase
    .from("payslips")
    .insert({
      owner_id: user!.id,
      employee_id: input.employee_id,
      year,
      month,
      template_id: input.template_id,
      data: input.data,
      status: "draft",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Payslip;
}

export async function setPayslipTemplate(
  id: string,
  template_id: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payslips")
    .update({ template_id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function savePayslipComputedTotals(
  id: string,
  computed_totals: ComputedTotals,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payslips")
    .update({ computed_totals, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Assign-once / reuse-forever: if already issued, return the stored serial.
export async function issuePayslip(id: string): Promise<number> {
  const supabase = await createClient();
  const existing = await getPayslip(id);
  if (!existing) throw new Error("payslip not found");
  if (existing.status === "issued" && existing.serial_number != null) {
    return existing.serial_number;
  }
  const { data: serial, error: rpcError } =
    await supabase.rpc("allocate_serial");
  if (rpcError) throw rpcError;
  const { error } = await supabase
    .from("payslips")
    .update({
      serial_number: serial as number,
      status: "issued",
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  return serial as number;
}

// computed_totals of the employee's saved months for `year`, month <= maxMonth,
// excluding `excludeId` (the slip currently being previewed contributes live).
export async function getYearComputedTotals(
  employeeId: string,
  year: number,
  maxMonth: number,
  excludeId?: string,
): Promise<ComputedTotals[]> {
  const supabase = await createClient();
  let q = supabase
    .from("payslips")
    .select("computed_totals")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .lte("month", maxMonth)
    .not("computed_totals", "is", null);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as { computed_totals: ComputedTotals }[]).map(
    (r) => r.computed_totals,
  );
}
