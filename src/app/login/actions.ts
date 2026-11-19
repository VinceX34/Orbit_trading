"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deskCookie, deskPassword, passwordMatches, sessionValue } from "@/lib/gate";

export async function unlock(formData: FormData) {
  const expected = deskPassword();
  const given = String(formData.get("password") || "");
  if (!expected || !passwordMatches(given, expected)) {
    redirect("/login?error=1");
  }

  const jar = await cookies();
  jar.set(deskCookie, sessionValue(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function lock() {
  const jar = await cookies();
  jar.delete(deskCookie);
  redirect("/login");
}
