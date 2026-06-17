import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mints signed upload URLs so the browser pushes design mockups + source artwork
// straight to Storage (bypassing serverless body limits). Auth-gated: only a
// logged-in user can stage uploads, scoped under their own user id.

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const BUCKETS = new Set(["designs", "artwork", "proofs"]);

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function POST(request: Request) {
  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const files = (body as { files?: unknown })?.files;
  if (!Array.isArray(files) || files.length === 0 || files.length > 20) {
    return NextResponse.json({ error: "Bad file list" }, { status: 400 });
  }

  const service = requireSupabaseServiceClient();
  const batch = crypto.randomUUID();
  const uploads: { id: string; bucket: string; path: string; token: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i] as { id?: string; bucket?: string; name?: string; size?: number; kind?: string };
    const bucket = String(f.bucket ?? "");
    if (!BUCKETS.has(bucket)) {
      return NextResponse.json({ error: `Bad bucket: ${bucket}` }, { status: 400 });
    }
    if ((f.size ?? 0) > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `"${f.name}" exceeds the size limit.` }, { status: 413 });
    }
    const kind = sanitize(f.kind ?? "file");
    const path = `${user.id}/${batch}/${kind}/${i}-${sanitize(f.name ?? "file")}`;
    const { data, error } = await service.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: "Could not prepare upload." }, { status: 500 });
    }
    uploads.push({ id: String(f.id ?? i), bucket, path, token: data.token });
  }

  return NextResponse.json({ uploads });
}
