import { notFound } from "next/navigation";
import { getProposalByToken } from "@/lib/documents/proposals-admin";
import { ProposalClient } from "./proposal-client";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const proposal = await getProposalByToken(token);
  if (!proposal) return { title: "Propuesta · PixelTEC" };
  return {
    title: `${proposal.title} · PixelTEC`,
    robots: { index: false, follow: false },
  };
}

export default async function ProposalPublicPage({ params }: PageProps) {
  const { token } = await params;
  const proposal = await getProposalByToken(token);
  if (!proposal) notFound();

  return <ProposalClient proposal={proposal} token={token} />;
}
