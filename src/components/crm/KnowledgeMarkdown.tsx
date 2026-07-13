"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import "highlight.js/styles/github-dark.css";

/** Extrae el texto plano de un árbol de nodos React (para copiar código resaltado). */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode };
    return extractText(children);
  }
  return "";
}

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = extractText(children);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="group relative my-3">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 rounded-md border border-white/[0.06] bg-zinc-900/90 px-2 py-0.5 text-[11px] text-zinc-400 opacity-0 transition-opacity hover:text-zinc-200 group-hover:opacity-100"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
      <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-[#0a0a0a] p-3 text-xs leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

const components: Components = {
  h1({ children }) {
    return (
      <h1 className="mb-2 mt-4 text-base font-semibold text-foreground">
        {children}
      </h1>
    );
  },
  h2({ children }) {
    return (
      <h2 className="mb-2 mt-3 text-[13px] font-semibold text-foreground">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="mb-1 mt-2 text-[13px] font-medium text-foreground">
        {children}
      </h3>
    );
  },
  p({ children }) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
  ul({ children }) {
    return (
      <ul className="mb-2 ml-4 list-disc space-y-0.5 marker:text-muted-foreground">
        {children}
      </ul>
    );
  },
  ol({ children }) {
    return (
      <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>
    );
  },
  li({ children }) {
    return <li className="text-foreground/90">{children}</li>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        className="text-cyan-400 underline-offset-2 hover:underline"
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground">
        {children}
      </blockquote>
    );
  },
  // inline code vs bloque: el bloque tiene className "language-xxx" (puesto por rehype-highlight).
  code({ className, children }) {
    if (!className) {
      return (
        <code className="rounded bg-zinc-800/80 px-1 py-0.5 text-[12px] text-cyan-300">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  pre({ children }) {
    return <CodeBlock>{children}</CodeBlock>;
  },
  hr() {
    return <hr className="my-3 border-white/[0.08]" />;
  },
  table({ children }) {
    return (
      <div className="my-2 overflow-x-auto rounded-lg border border-white/[0.08]">
        <table className="w-full border-collapse text-xs">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-secondary">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="border-b border-white/[0.08] px-2.5 py-1.5 text-left font-semibold text-foreground">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border-t border-white/[0.06] px-2.5 py-1.5 align-top text-muted-foreground">{children}</td>;
  },
};

export function KnowledgeMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
