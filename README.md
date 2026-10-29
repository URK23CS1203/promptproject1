# 🩺 Prompt Doctor

> **Diagnostic prompt analyzer, optimizer, and blind side-by-side AI response evaluation workbench powered by Google Gemini.**

---

## 🌟 Overview

**Prompt Doctor** diagnoses structural weaknesses in any LLM prompt, generates a targeted intent-preserving rewrite, executes both prompts in parallel against Gemini under identical settings, and runs a randomized double-blind rubric evaluation on the outputs.

---

## 🚀 Key Features

- **Structural Prompt Diagnosis (0–100):** Evaluates prompts across 4 rubric dimensions:
  - *Clarity & Specificity*
  - *Context & Scope*
  - *Boundaries & Constraints*
  - *Output Structure*
- **Targeted Rewriting:** 4 optimization strategies:
  - ⚖️ *Balanced*
  - ✂️ *Concise*
  - 🗂️ *Structured*
  - 🔍 *Analytical*
- **Word Diff Visualizer:** Longest Common Subsequence (LCS) diff highlighting exact prompt edits.
- **Symmetric Model Generation:** Executes Original and Optimized prompts concurrently on Gemini (`gemini-3.1-flash-lite`, `gemini-3.8-flash`, `gemini-flash-latest`).
- **Unbiased Blind Evaluation:** Randomizes outputs into anonymous Candidate A / Candidate B to eliminate self-preference scoring bias.
- **One-Click Export:** Download comprehensive diagnostic and evaluation reports in Markdown (`.md`) or JSON (`.json`).

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend:** Node.js, Express 4, Vercel Serverless Functions (`/api/*`)
- **AI Model:** Google Gemini via `@google/genai`
- **Build Tool:** Vite 8

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY="your-gemini-api-key"
```

---

## 💻 Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

4. **Production Build:**
   ```bash
   npm run build
   ```

---

## ☁️ Deployment on Vercel

1. Push your repository to GitHub.
2. Import the project on [Vercel](https://vercel.com/new).
3. Set the Environment Variable:
   - `GEMINI_API_KEY` = your Gemini API Key
4. Click **Deploy**.

---

## 📄 License

Apache-2.0
