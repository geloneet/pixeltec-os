import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth, getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export async function getSessionUid(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;
  if (!session) return null;
  try {
    const { uid } = await getAdminAuth().verifySessionCookie(session, true);
    return uid;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<{ uid: string }> {
  const uid = await getSessionUid();
  if (!uid) redirect("/login?redirect=/crypto-intel/admin");

  const userDoc = await getFirestore(getAdminApp()).collection("users").doc(uid).get();
  if (userDoc.data()?.role !== "admin") redirect("/crypto-intel");

  return { uid };
}
