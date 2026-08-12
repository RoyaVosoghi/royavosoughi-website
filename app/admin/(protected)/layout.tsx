import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/admin/auth";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifySessionToken(token)) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-dvh lg:flex">
      <AdminNav />
      <main className="min-w-0 flex-1 px-5 py-8 lg:ms-64 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
