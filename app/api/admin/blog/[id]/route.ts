import { NextResponse } from "next/server";

import { gate, jsonError, parseBody } from "@/lib/admin/api";
import { writeAuditLog } from "@/lib/admin/queries";
import { deletePost, getPost, updatePost } from "@/lib/blog";
import { BlogPostSchema, revalidateBlog } from "@/lib/blog-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("editor");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BlogPostSchema);
  if ("response" in body) return body.response;

  const { id } = await params;
  try {
    const before = await getPost(id);
    const post = await updatePost(id, body.data);
    if (!post) return jsonError("not_found", 404);
    const action = before?.status !== post.status ? (post.status === "published" ? "blog.publish" : "blog.unpublish") : "blog.update";
    await writeAuditLog(action, `${post.locale}/${post.slug}`);
    revalidateBlog(post.locale, post.slug);
    // A changed slug or language leaves the old URL cached until it's revalidated too.
    if (before && (before.slug !== post.slug || before.locale !== post.locale)) revalidateBlog(before.locale, before.slug);
    return NextResponse.json({ ok: true, post });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return jsonError("slug_taken", 409);
    console.error("[admin/blog] update failed:", err);
    return jsonError("storage_failed", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("editor");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const post = await getPost(id);
  if (!post) return jsonError("not_found", 404);
  try {
    await deletePost(id);
    await writeAuditLog("blog.delete", `${post.locale}/${post.slug}`);
    revalidateBlog(post.locale, post.slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/blog] delete failed:", err);
    return jsonError("storage_failed", 500);
  }
}
