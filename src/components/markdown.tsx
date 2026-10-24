"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="absolute right-2 top-2 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-muted hover:text-fg"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="cp-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {label}
            </a>
          ),
          code: ({ className, children: codeChildren }) => {
            const text = String(codeChildren ?? "").replace(/\n$/, "");
            const isBlock = Boolean(className) || text.includes("\n");
            if (!isBlock) return <code>{text}</code>;
            return (
              <div className="relative">
                <pre>
                  <code className={className}>{text}</code>
                </pre>
                <CopyButton text={text} />
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
