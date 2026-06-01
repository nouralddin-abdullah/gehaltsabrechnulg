import { createClient } from "@/lib/supabase/server";
import type { Employee, EmployeeData } from "./types";

export async function listEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Employee[];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Employee | null;
}

export async function createEmployee(input: {
  company_id: string | null;
  data: EmployeeData;
}): Promise<Employee> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("employees")
    .insert({
      owner_id: user!.id,
      company_id: input.company_id,
      name: input.data.mitarbeiter.name,
      data: input.data,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(
  id: string,
  input: { company_id: string | null; data: EmployeeData },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      company_id: input.company_id,
      name: input.data.mitarbeiter.name,
      data: input.data,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEmployee(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw error;
}
