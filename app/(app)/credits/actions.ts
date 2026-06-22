"use server";

import { revalidatePath } from "next/cache";
import { grantCredits } from "@/lib/db/credits";
import { packById } from "@/lib/credits";

// Mock purchase: grants the pack's credits immediately. Wire a real payment
// provider in front of this later — the credit accounting itself is final.
export async function purchaseCreditPack(packId: string): Promise<number> {
  const pack = packById(packId);
  if (!pack) throw new Error("unknown pack");
  const balance = await grantCredits(pack.credits, `purchase:${pack.id}`);
  revalidatePath("/credits");
  revalidatePath("/", "layout");
  return balance;
}
