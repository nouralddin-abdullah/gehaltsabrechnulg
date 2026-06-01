"use client";

import { useState } from "react";
import Link from "next/link";
import type { Employee } from "@/lib/db/types";
import { filterEmployees } from "@/lib/employee-data";
import { deleteEmployee } from "@/app/employees/actions";

export function EmployeeList({ employees }: { employees: Employee[] }) {
  const [q, setQ] = useState("");
  const shown = filterEmployees(employees, q);
  return (
    <div className="mt-6">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search employees…"
        className="cmp-input w-full"
      />
      <ul className="mt-4 divide-y divide-neutral-800">
        {shown.length === 0 && (
          <li className="py-4 text-neutral-500">No employees.</li>
        )}
        {shown.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-3">
            <Link
              href={`/employees/${e.id}`}
              className="text-neutral-100 hover:underline"
            >
              {e.name || "(unnamed)"}
            </Link>
            <form action={deleteEmployee}>
              <input type="hidden" name="id" value={e.id} />
              <button className="text-xs text-red-400">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
