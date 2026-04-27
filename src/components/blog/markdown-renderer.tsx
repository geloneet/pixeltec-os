'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css';
import type { Components } from 'react-markdown';
import MermaidDiagram from './mermaid-diagram';

// The AI generator sometimes prepends a YAML frontmatter block (raw or code-fenced).
// Strip it before rendering so it doesn't appear as a code block at the top of the post.
function stripFrontmatter(content: string): string {
  return content
    .replace(/^```(?:yaml|yml)?\s*\n---[\s\S]*?---\s*\n```\s*\n?/, '')
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
}

const components: Components = {
  h1({ children }) {
    return (
      <h1 className="not-prose mb-4 mt-10 text-3xl font-extrabold text-white md:text-4xl">
        {children}
      </h1>
    );
  },
  h2({ children }) {
    return (
      <h2 className="not-prose mb-4 mt-10 border-b border-white/10 pb-2 text-2xl font-bold text-white md:text-3xl">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="not-prose mb-3 mt-8 text-xl font-semibold text-white md:text-2xl">
        {children}
      </h3>
    );
  },
  h4({ children }) {
    return (
      <h4 className="not-prose mb-2 mt-6 text-lg font-semibold text-zinc-200">
        {children}
      </h4>
    );
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        className="text-blue-400 underline underline-offset-4 transition-colors hover:text-blue-300"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="not-prose my-6 rounded-r-lg border-l-4 border-blue-500/40 bg-white/5 py-3 pl-4 italic text-zinc-400">
        {children}
      </blockquote>
    );
  },
  code({ className, children }) {
    // Block code has a language class (e.g. "language-js"); inline code does not.
    if (!className) {
      return (
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-blue-300">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  pre({ children }) {
    // Intercept mermaid blocks before rehype-highlight touches them.
    const child = React.Children.toArray(children)[0];
    if (React.isValidElement(child)) {
      const { className, children: codeChildren } = child.props as {
        className?: string;
        children?: React.ReactNode;
      };
      if (className?.includes('language-mermaid')) {
        const content = Array.isArray(codeChildren)
          ? codeChildren.join('')
          : String(codeChildren ?? '');
        return <MermaidDiagram content={content.trim()} />;
      }
    }
    return (
      <pre className="not-prose my-6 overflow-x-auto rounded-lg border border-white/10 bg-zinc-950/80 p-4 text-sm">
        {children}
      </pre>
    );
  },
  table({ children }) {
    return (
      <div className="not-prose my-6 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full border-collapse">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border-b border-white/10 bg-white/5 px-4 py-2 text-left font-semibold text-zinc-300">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border-b border-white/5 px-4 py-2 text-zinc-400">{children}</td>
    );
  },
  hr() {
    return <hr className="not-prose my-10 border-white/10" />;
  },
  ul({ children }) {
    return (
      <ul className="not-prose my-4 list-inside list-disc space-y-1 marker:text-blue-400">
        {children}
      </ul>
    );
  },
  ol({ children }) {
    return (
      <ol className="not-prose my-4 list-inside list-decimal space-y-1">{children}</ol>
    );
  },
  li({ children }) {
    return <li className="text-zinc-300">{children}</li>;
  },
};

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeHighlight, { ignoreMissing: true }]]}
      components={components}
    >
      {stripFrontmatter(content)}
    </ReactMarkdown>
  );
}
