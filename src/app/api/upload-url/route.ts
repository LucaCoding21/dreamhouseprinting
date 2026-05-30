import { NextResponse } from "next/server";
import { STORAGE_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mints short-lived signed upload URLs so the browser can push artwork straight
// to Supabase Storage, bypassing Vercel's 4.5MB serverless request-body limit
// (large multipart uploads through /api/submit were failing with 413). The
// browser uploads to these URLs; /api/submit then just records the paths.

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — must match the client cap
const KINDS = new Set(["artwork", "price-match"]);

type FileReq = { id: string; kind: string; name: string; size: number };

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const files = (body as { files?: unknown })?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }
  if (files.length > 20) {
    return NextResponse.json({ error: "Too many files" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  // No storage configured (local dev without creds) — tell the client to skip
  // direct upload and submit without files, matching the old graceful path.
  if (!supabase) {
    return NextResponse.json({ configured: false });
  }

  // One folder per submission attempt so a customer's files stay co-located.
  const uploadId = crypto.randomUUID();
  const uploads: { id: string; kind: string; path: string; token: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i] as Partial<FileReq>;
    const id = typeof f.id === "string" ? f.id : String(i);
    const kind = typeof f.kind === "string" ? f.kind : "";
    const name = typeof f.name === "string" ? f.name : "file";
    const size = typeof f.size === "number" ? f.size : 0;

    if (!KINDS.has(kind)) {
      return NextResponse.json({ error: `Bad file kind: ${kind}` }, { status: 400 });
    }
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `"${name}" is over the 25MB limit.` },
        { status: 413 },
      );
    }

    const path = `${uploadId}/${kind}/${i}-${sanitizeFileName(name)}`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[upload-url] sign failed", { path, error });
      return NextResponse.json(
        { error: "Could not prepare upload." },
        { status: 500 },
      );
    }
    uploads.push({ id, kind, path, token: data.token });
  }

  return NextResponse.json({ configured: true, uploads });
}
