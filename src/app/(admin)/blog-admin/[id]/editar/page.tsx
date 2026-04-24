import { notFound } from "next/navigation";
import { getPostById } from "@/lib/blog/queries/posts";
import { PostEditorClient } from "./post-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarPostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPostById(id);

  if (!post) notFound();

  return <PostEditorClient post={post} />;
}
