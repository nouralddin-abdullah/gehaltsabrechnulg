import manifest from "@/public/templates/template-manifest.json";

export type TemplateMeta = {
  id: string;
  name: string;
  file: string;
  supportsCumulative: boolean;
  supportsAutoTax: boolean;
};

export const TEMPLATES: TemplateMeta[] = manifest as TemplateMeta[];

export const DEFAULT_TEMPLATE_ID = "datev-classic";

export function templateById(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
