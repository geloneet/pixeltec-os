import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { Proposal, ProposalVersion } from "@/types/documents";

const COL = "proposals";

export async function getProposals(
  firestore: Firestore,
  uid: string,
  clientId?: string,
): Promise<Proposal[]> {
  const ref = collection(firestore, COL);
  const constraints = clientId
    ? [where("uid", "==", uid), where("clientId", "==", clientId), orderBy("createdAt", "desc")]
    : [where("uid", "==", uid), orderBy("createdAt", "desc")];
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Proposal));
}

export async function createProposal(
  firestore: Firestore,
  uid: string,
  clientId: string,
  clientName: string,
  data: Omit<Proposal, "id" | "uid" | "clientId" | "clientName" | "reference" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const ref = await addDoc(collection(firestore, COL), {
    ...data,
    uid,
    clientId,
    clientName,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now,
  });
  // Set reference after we have the doc ID
  const reference = `PT-${year}-${ref.id.slice(0, 6).toUpperCase()}`;
  await updateDoc(ref, { reference });
  return ref.id;
}

export async function updateProposal(
  firestore: Firestore,
  id: string,
  data: Partial<Omit<Proposal, "id" | "uid" | "clientId" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/** Generate or refresh the public token for a proposal. Creates a version snapshot. */
export async function publishProposal(
  firestore: Firestore,
  proposal: Proposal,
): Promise<string> {
  const now = new Date().toISOString();

  // Generate token: 16 hex chars from random bytes
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const token = Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");

  const nextVersion = (proposal.currentVersion ?? 1) + (proposal.publicToken ? 1 : 0);

  const versionSnapshot: ProposalVersion = {
    version: nextVersion,
    savedAt: now,
    title: proposal.title,
    scope: proposal.scope,
    solution: proposal.solution,
    deliverables: proposal.deliverables,
    benefits: proposal.benefits,
    budget: proposal.budget,
    timeline: proposal.timeline,
  };

  const prevVersions: ProposalVersion[] = proposal.versions ?? [];
  const newVersions = [...prevVersions, versionSnapshot].slice(-10); // keep last 10

  const updates: Partial<Proposal> = {
    publicToken: token,
    currentVersion: nextVersion,
    versions: newVersions,
    updatedAt: now,
    ...(proposal.status === "borrador" ? { status: "enviada" as const } : {}),
    ...(!proposal.sentAt ? { sentAt: now } : {}),
  };

  await updateDoc(doc(firestore, COL, proposal.id), updates);
  return token;
}
