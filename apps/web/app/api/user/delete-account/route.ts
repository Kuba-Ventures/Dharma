import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { deleteUserAccount } from "../../../../lib/accountDeletion";

// POST /api/user/delete-account
//
// Permanently deletes the signed-in user's account and all associated data
// (Gmail/Calendar credentials, labels, classified threads, usage, signals,
// feedback, sessions). Stops the Gmail watch and revokes the Google OAuth
// grant first. The client is responsible for signing the user out after a
// successful response (their session row is already gone).
//
// Requires an explicit confirmation token in the body so a stray/CSRF POST
// can't nuke an account: the caller must send { confirm: "DELETE" }.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation required. Send { confirm: \"DELETE\" }." },
      { status: 400 },
    );
  }

  try {
    const report = await deleteUserAccount(session.user.id);
    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error("[delete-account] deletion failed:", err);
    return NextResponse.json(
      { error: "Deletion failed. Please contact support so we can complete it manually." },
      { status: 500 },
    );
  }
}
