import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';

interface ActivityLog {
    type: 'project' | 'sale' | 'support' | 'finance';
    message: string;
    link?: string;
}

/**
 * Creates an activity log entry in Firestore.
 * @param db - The Firestore instance.
 * @param log - An object containing the log details (type, message, link).
 */
export const createActivityLog = async (db: Firestore, log: ActivityLog) => {
    if (!db) {
        console.error("Firestore instance is not available. Cannot create activity log.");
        return;
    }
    
    try {
        await addDoc(collection(db, 'activity'), {
            ...log,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error creating activity log:", error);
    }
};
