'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { LoaderCircle, FileText, DollarSign, LifeBuoy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  message: string;
  type: 'project' | 'sale' | 'support' | 'finance';
  timestamp: any;
  link?: string;
}

const typeConfig = {
  project: {
    icon: FileText,
    color: 'bg-cyan-500',
    label: 'Proyecto',
  },
  sale: {
    icon: DollarSign,
    color: 'bg-lime-500',
    label: 'Venta',
  },
  support: {
    icon: LifeBuoy,
    color: 'bg-red-500',
    label: 'Soporte',
  },
  finance: {
    icon: DollarSign,
    color: 'bg-yellow-500',
    label: 'Finanzas',
  },
};

export default function RecentActivityFeed() {
  const firestore = useFirestore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    setLoading(true);

    const activityQuery = query(
      collection(firestore, 'activity'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(activityQuery, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Activity));
      setActivities(activitiesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching activity feed: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-40 text-zinc-500">
          <LoaderCircle className="h-6 w-6 animate-spin mr-2" />
          Cargando actividad...
        </div>
      );
    }
    if (activities.length === 0) {
      return (
        <div className="flex items-center justify-center h-40 text-zinc-500">
          <p>No hay actividad reciente en el sistema.</p>
        </div>
      );
    }
    return (
      <ul className="space-y-1">
        {activities.map((activity) => {
          const config = typeConfig[activity.type] || typeConfig.project;
          const inner = (
            <div className="flex items-start gap-4 p-3 hover:bg-white/5 rounded-lg transition-colors">
              <div className="mt-1.5 flex-shrink-0">
                <span className={cn('h-2.5 w-2.5 rounded-full block', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 leading-snug">{activity.message}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {activity.timestamp
                    ? formatDistanceToNow(activity.timestamp.toDate(), { addSuffix: true, locale: es })
                    : 'hace un momento'}
                </p>
              </div>
            </div>
          );

          return (
            <li key={activity.id}>
              {activity.link ? (
                <Link href={activity.link} className="block cursor-pointer">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl h-full">
      <h2 className="text-base font-medium text-zinc-400 mb-4">Actividad Reciente</h2>
      {renderContent()}
    </div>
  );
}
