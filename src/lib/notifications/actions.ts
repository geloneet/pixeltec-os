"use server";

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebase-admin";
import {
  CreateNotificationInputSchema,
  type CreateNotificationInput,
} from "./schemas";

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const parsed = CreateNotificationInputSchema.parse(input);
  const db = getFirestore(getAdminApp());

  await db.collection("notifications").add({
    ...parsed,
    read: false,
    readAt: null,
    createdAt: Timestamp.now(),
  });
}
