import { requireUser } from "@/server/auth";
import { getResume } from "@/features/resumes/service";
import { Editor } from "./editor";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const resume = await getResume(user.id, (await params).id);
  return <Editor initial={resume} />;
}
