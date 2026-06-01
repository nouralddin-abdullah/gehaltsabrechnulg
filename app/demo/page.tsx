"use client";

import { SlipFrame } from "@/components/SlipFrame";
import { sampleSlip } from "@/lib/fixtures/sample-slip";
import { DEFAULT_TEMPLATE_ID, templateById } from "@/lib/template-manifest";

export default function DemoPage() {
  const template = templateById(DEFAULT_TEMPLATE_ID);
  return (
    <main className="min-h-screen overflow-auto p-6">
      <h1 className="mb-4 text-lg font-semibold text-neutral-200">
        Slip demo — {template.name}
      </h1>
      <SlipFrame templateFile={template.file} state={sampleSlip} />
    </main>
  );
}
