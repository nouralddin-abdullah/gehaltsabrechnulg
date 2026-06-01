import { notFound } from "next/navigation";
import { getCompany } from "@/lib/db/companies";
import { CompanyForm } from "@/components/CompanyForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Companies", href: "/companies" },
          { label: company.name },
          { label: "Edit" },
        ]}
      />
      <PageHeader title="Edit company" />
      <CompanyForm company={company} />
    </>
  );
}
