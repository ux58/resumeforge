import { requireUser } from "@/server/auth";
import { listResumes } from "@/features/resumes/service";
import { JobsClient } from "./jobs-client";

export const metadata = { title: "职位匹配 · ResumeForge" };

export default async function JobsPage() {
  const user = await requireUser();
  const resumes = await listResumes(user.id);
  return <JobsClient resumes={resumes} />;
}
