import type { OptimizationStrategy } from "../types/promptDoctor";

export interface SamplePromptPreset {
  id: string;
  label: string;
  domain: string;
  recommendedStrategy: OptimizationStrategy;
  prompt: string;
}

export const SAMPLE_PROMPTS: SamplePromptPreset[] = [
  {
    id: "vague-debug",
    label: "Vague React Bug",
    domain: "Software Engineering",
    recommendedStrategy: "structured",
    prompt:
      "my react useEffect keeps running in an infinite loop when fetching user profile data, how do i fix it?",
  },
  {
    id: "product-email",
    label: "Ambiguous Launch Brief",
    domain: "Product Communication",
    recommendedStrategy: "balanced",
    prompt:
      "write an email to customers announcing our new CSV export and audit log features for enterprise accounts.",
  },
  {
    id: "architecture-tradeoff",
    label: "Broad System Design",
    domain: "Architecture",
    recommendedStrategy: "reasoning",
    prompt: "how should i design database multi-tenancy for a B2B SaaS app?",
  },
  {
    id: "data-extraction",
    label: "Unstructured Summary",
    domain: "Data Analysis",
    recommendedStrategy: "structured",
    prompt:
      "explain how to review a vendor SaaS security questionnaire and flag the main compliance blockers.",
  },
  {
    id: "strong-control",
    label: "Well-Scoped Control",
    domain: "Benchmark Control",
    recommendedStrategy: "concise",
    prompt:
      "Provide a concise comparison between PostgreSQL B-tree indexes and GIN indexes for a backend engineer. Cover: (1) ideal data types and query operators for each, (2) write-amplification and storage trade-offs, and (3) one concrete SQL CREATE INDEX example for each. Keep the total response under 280 words using two short sections and a summary table.",
  },
  {
    id: "ml-explainer",
    label: "ML Concept Explainer",
    domain: "Machine Learning",
    recommendedStrategy: "balanced",
    prompt: "explain how transformers work",
  },
  {
    id: "code-review",
    label: "Open-ended Code Review",
    domain: "Software Engineering",
    recommendedStrategy: "structured",
    prompt: "can you review my python code and make it better?",
  },
];
