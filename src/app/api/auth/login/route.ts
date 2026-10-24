import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { destroySession, issueSession, verifyLogin } from "@/server/auth";
import { jsonError } from "@/server/http";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const { username, password } = credentialsSchema.parse(await req.json());
    const user = await verifyLogin(username, password);
    await issueSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE() {
  await destroySession();
  return new NextResponse(null, { status: 204 });
}
