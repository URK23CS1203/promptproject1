import type { PromptHistoryEntry } from "../types/promptDoctor";
import { EVALUATION_CRITERIA_META } from "../types/promptDoctor";

export interface DiffToken {
  type: "equal" | "added" | "removed";
  value: string;
}

/**
 * Computes a clean word-level diff using Longest Common Subsequence (LCS).
 * Falls back to line-level chunks if token count exceeds threshold to keep UI instantaneous.
 */
export function computeWordDiff(originalText: string, updatedText: string): DiffToken[] {
  const tokenize = (str: string) => str.split(/(\s+)/).filter((part) => part.length > 0);

  const a = tokenize(originalText);
  const b = tokenize(updatedText);

  if (a.length * b.length > 250_000) {
    // Fallback for very long prompts: line-based comparison
    const linesA = originalText.split("\n");
    const linesB = updatedText.split("\n");
    return computeLcsTokens(
      linesA.map((l, idx) => (idx < linesA.length - 1 ? `${l}\n` : l)),
      linesB.map((l, idx) => (idx < linesB.length - 1 ? `${l}\n` : l))
    );
  }

  return computeLcsTokens(a, b);
}

function computeLcsTokens(a: string[], b: string[]): DiffToken[] {
  const m = a.length;
  const n = b.length;
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const raw: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ type: "equal", value: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: "removed", value: a[i] });
      i++;
    } else {
      raw.push({ type: "added", value: b[j] });
      j++;
    }
  }
  while (i < m) {
    raw.push({ type: "removed", value: a[i++] });
  }
  while (j < n) {
    raw.push({ type: "added", value: b[j++] });
  }

  // Merge adjacent tokens of the same type
  const merged: DiffToken[] = [];
  for (const token of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === token.type) {
      prev.value += token.value;
    } else {
      merged.push({ ...token });
    }
  }

  return merged;
}

export function buildMarkdownReport(entry: PromptHistoryEntry): string {
  const activeOptimized = entry.editedOptimizedPrompt ?? entry.optimization.optimizedPrompt;
  const lines: string[] = [
    `# Prompt Doctor Diagnostic & Benchmark Report`,
    ``,
    `- **Generated**: ${new Date(entry.createdAt).toLocaleString()}`,
    `- **Model**: ${entry.model}`,
    `- **Optimization Strategy**: ${entry.strategy}`,
    `- **Initial Prompt Health Score**: ${entry.analysis.overallScore}/100`,
    ``,
    `## 1. Original Prompt`,
    ``,
    "```text",
    entry.originalPrompt,
    "```",
    ``,
    `## 2. Prompt Diagnosis`,
    ``,
    `**Detected Intent**: ${entry.analysis.detectedIntent}`,
    ``,
    `- Clarity: ${entry.analysis.dimensions.clarity}/100`,
    `- Context: ${entry.analysis.dimensions.context}/100`,
    `- Constraints: ${entry.analysis.dimensions.constraints}/100`,
    `- Structure: ${entry.analysis.dimensions.structure}/100`,
    ``,
  ];

  if (entry.analysis.issues.length > 0) {
    lines.push(`### Diagnostic Issues`);
    for (const issue of entry.analysis.issues) {
      lines.push(`- **[${issue.severity.toUpperCase()} · ${issue.dimension}] ${issue.title}**: ${issue.description} *(Fix: ${issue.fixSuggestion})*`);
    }
    lines.push(``);
  }

  lines.push(
    `## 3. Optimized Prompt`,
    ``,
    "```text",
    activeOptimized,
    "```",
    ``,
    `**Optimization Rationale**: ${entry.optimization.rationale}`,
    ``
  );

  if (entry.responses) {
    lines.push(
      `## 4. Model Responses (${entry.responses.model})`,
      ``,
      `### Original Prompt Response (${entry.responses.originalResponse.wordCount} words · ${entry.responses.originalResponse.durationMs} ms)`,
      ``,
      entry.responses.originalResponse.text,
      ``,
      `### Optimized Prompt Response (${entry.responses.optimizedResponse.wordCount} words · ${entry.responses.optimizedResponse.durationMs} ms)`,
      ``,
      entry.responses.optimizedResponse.text,
      ``
    );
  }

  if (entry.evaluation) {
    const ev = entry.evaluation;
    const verdictLabel =
      ev.winner === "optimized"
        ? "Optimized Response Scored Higher"
        : ev.winner === "original"
        ? "Original Response Scored Higher"
        : "Tied Score";

    lines.push(
      `## 5. Blind Rubric Evaluation`,
      ``,
      `- **Verdict**: ${verdictLabel}`,
      `- **Original Overall Score**: ${ev.original.overallScore}/100`,
      `- **Optimized Overall Score**: ${ev.optimized.overallScore}/100`,
      `- **Score Delta**: ${ev.scoreDelta > 0 ? `+${ev.scoreDelta}` : ev.scoreDelta}`,
      `- **Blind Assignment**: Original evaluated as ${ev.blindAssignment.originalAssignedTo}; Optimized evaluated as ${ev.blindAssignment.optimizedAssignedTo}`,
      ``,
      `| Criterion | Weight | Original | Optimized | Delta |`,
      `| :--- | :---: | :---: | :---: | :---: |`
    );

    for (const c of EVALUATION_CRITERIA_META) {
      const origVal = ev.original.criteria[c.key];
      const optVal = ev.optimized.criteria[c.key];
      const diff = optVal - origVal;
      lines.push(
        `| ${c.label} | ${c.weightPct}% | ${origVal} | ${optVal} | ${diff > 0 ? `+${diff}` : diff} |`
      );
    }

    lines.push(``, `**Summary**: ${ev.comparativeSummary}`, ``);
  }

  return lines.join("\n");
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
