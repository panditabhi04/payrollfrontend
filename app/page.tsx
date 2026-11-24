"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api/auth";

// First page of the app: signed in -> Home, otherwise the Login page (legacy sends a
// session-less visitor straight to Login_Page.aspx).
export default function Root() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    getMe().then((m) => { if (alive) router.replace(m ? "/Home" : "/login"); });
    return () => { alive = false; };
  }, [router]);
  return null;
}
