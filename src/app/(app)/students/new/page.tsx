import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { EnrollForm } from "./enroll-form";

export default async function NewStudentPage() {
  await requirePagePermission("user:manage");
  return (
    <>
      <PageTitle title="Nouvelle inscription" subtitle="Fiche élève et échéancier initial" />
      <Card className="max-w-3xl">
        <EnrollForm />
      </Card>
    </>
  );
}
