"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { NotificationSchema, type Notification } from "@/lib/notifications/schemas";

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const user = useUser();
  const db = useFirestore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Notification[] = [];
        snapshot.forEach((docSnap) => {
          const parsed = NotificationSchema.safeParse({
            id: docSnap.id,
            ...docSnap.data(),
          });
          if (parsed.success) items.push(parsed.data);
        });
        setNotifications(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useNotifications error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!db) return;
      try {
        await updateDoc(doc(db, "notifications", id), {
          read: true,
          readAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("[useNotifications] markAsRead error:", err);
      }
    },
    [db]
  );

  const markAllAsRead = useCallback(async () => {
    if (!db) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), {
          read: true,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("[useNotifications] markAllAsRead error:", err);
    }
  }, [db, notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead };
}
