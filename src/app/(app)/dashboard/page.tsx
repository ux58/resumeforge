import { listResumes } from "@/features/resumes/service";
import { requireUser } from "@/server/auth";
import { DashboardList } from "./list";

export default async function DashboardPage() {
  const user = await requireUser();
  const items = await listResumes(user.id);
  return <DashboardList initial={items} />;
}
