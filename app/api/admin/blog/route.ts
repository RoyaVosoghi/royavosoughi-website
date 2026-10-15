import { NextResponse } from "next/server";

import { gate, jsonError, parseBody } from "@/lib/admin/api";
import { writeAuditLog } from "@/lib/admin/queries";
import { createPost } from "@/lib/blog";
import { BlogPostSchema, revalidateBlog } from "@/lib/blog-admin";

export async function POST(request: Request) {
  const auth = await gate("editor");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BlogPostSchema);
  if ("response" in body) return body.response;

  try {
    const post = await createPost(body.data, auth.admin.id);
    await writeAuditLog(post.status === "published" ? "blog.publish" : "blog.create", `${post.locale}/${post.slug}`);
    revalidateBlog(post.locale, post.slug);
    return NextResponse.json({ ok: true, post });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return jsonError("slug_taken", 409);
    console.error("[admin/blog] create failed:", err);
    return jsonError("storage_failed", 500);
  }
}
