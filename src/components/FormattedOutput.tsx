import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface FormattedOutputProps {
  text: string;
}

function renderInlineFormatting(line: string): React.ReactNode[] {
  const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={idx}
          className="font-mono text-[12.5px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  return (
    <div className="my-3 rounded-lg border border-slate-200 bg-slate-950 text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800 text-xs text-slate-400">
        <span className="font-mono">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1.5 py-0.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function FormattedOutput({ text }: FormattedOutputProps) {
  const segments = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-slate-700 break-words">
      {segments.map((segment, segIdx) => {
        if (segment.startsWith("```") && segment.endsWith("```")) {
          const inner = segment.slice(3, -3);
          const firstNewline = inner.indexOf("\n");
          const language = firstNewline >= 0 ? inner.slice(0, firstNewline).trim() : "";
          const code = firstNewline >= 0 ? inner.slice(firstNewline + 1) : inner;
          return <CodeBlock key={segIdx} language={language} code={code.replace(/\n$/, "")} />;
        }

        const lines = segment.split("\n");
        const blocks: React.ReactNode[] = [];
        let listBuffer: { ordered: boolean; items: string[] } | null = null;

        const flushList = (keyPrefix: string) => {
          if (!listBuffer) return;
          if (listBuffer.ordered) {
            blocks.push(
              <ol key={keyPrefix} className="list-decimal pl-5 space-y-1.5 text-slate-700">
                {listBuffer.items.map((item, i) => (
                  <li key={i}>{renderInlineFormatting(item)}</li>
                ))}
              </ol>
            );
          } else {
            blocks.push(
              <ul key={keyPrefix} className="list-disc pl-5 space-y-1.5 text-slate-700">
                {listBuffer.items.map((item, i) => (
                  <li key={i}>{renderInlineFormatting(item)}</li>
                ))}
              </ul>
            );
          }
          listBuffer = null;
        };

        lines.forEach((rawLine, lineIdx) => {
          const line = rawLine.trimEnd();
          const trimmed = line.trim();

          if (!trimmed) {
            flushList(`list-${segIdx}-${lineIdx}`);
            return;
          }

          const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
          if (headingMatch) {
            flushList(`list-${segIdx}-${lineIdx}`);
            const level = headingMatch[1].length;
            const titleText = headingMatch[2];
            const headingClass =
              level === 1
                ? "text-base font-bold text-slate-900 pt-2"
                : level === 2
                ? "text-[15px] font-semibold text-slate-900 pt-1.5"
                : "text-sm font-semibold text-slate-900 pt-1";
            blocks.push(
              <h4 key={`h-${segIdx}-${lineIdx}`} className={headingClass}>
                {renderInlineFormatting(titleText)}
              </h4>
            );
            return;
          }

          const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
          if (bulletMatch) {
            if (!listBuffer || listBuffer.ordered) {
              flushList(`list-${segIdx}-${lineIdx}`);
              listBuffer = { ordered: false, items: [] };
            }
            listBuffer.items.push(bulletMatch[1]);
            return;
          }

          const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
          if (orderedMatch) {
            if (!listBuffer || !listBuffer.ordered) {
              flushList(`list-${segIdx}-${lineIdx}`);
              listBuffer = { ordered: true, items: [] };
            }
            listBuffer.items.push(orderedMatch[1]);
            return;
          }

          flushList(`list-${segIdx}-${lineIdx}`);
          blocks.push(
            <p key={`p-${segIdx}-${lineIdx}`} className="text-slate-700">
              {renderInlineFormatting(trimmed)}
            </p>
          );
        });

        flushList(`list-end-${segIdx}`);
        return <React.Fragment key={segIdx}>{blocks}</React.Fragment>;
      })}
    </div>
  );
}
