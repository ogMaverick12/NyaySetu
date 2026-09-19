import { useSyncExternalStore } from "react";

/**
 * Shared in-memory and persistent reactive store for lawyer-prep checklist questions.
 * Bridges Consultation Q&A ("Add to Lawyer-Prep Checklist") with the Legal Memo & Export view.
 */
export class LawyerChecklistStore {
  private questions: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();
  private storageKey = "nyaysetu_lawyer_prep_questions";
  private cachedSnapshot: string[] = [];

  constructor() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(this.storageKey);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((q: unknown) => {
              if (typeof q === "string" && q.trim()) {
                this.questions.add(q.trim());
              }
            });
          }
        }
      } catch {
        // Fallback silently if localStorage is restricted
      }
    }
    this.updateSnapshot();
  }

  private updateSnapshot(): void {
    this.cachedSnapshot = Array.from(this.questions);
  }

  private persist(): void {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.questions)));
      } catch {
        // Ignore storage quotas or restrictions
      }
    }
  }

  private notify(): void {
    this.updateSnapshot();
    this.persist();
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): string[] {
    return this.cachedSnapshot;
  }

  addQuestion(question: string): void {
    const clean = question.replace(/^Question:\s*/i, "").trim();
    if (clean && !this.questions.has(clean)) {
      this.questions.add(clean);
      this.notify();
    }
  }

  removeQuestion(question: string): void {
    const clean = question.replace(/^Question:\s*/i, "").trim();
    if (clean && this.questions.has(clean)) {
      this.questions.delete(clean);
      this.notify();
    }
  }

  toggleQuestion(question: string, explicitState?: boolean): boolean {
    const clean = question.replace(/^Question:\s*/i, "").trim();
    if (!clean) return false;

    const shouldAdd = explicitState !== undefined ? explicitState : !this.questions.has(clean);
    if (shouldAdd) {
      this.questions.add(clean);
    } else {
      this.questions.delete(clean);
    }
    this.notify();
    return shouldAdd;
  }

  hasQuestion(question: string): boolean {
    const clean = question.replace(/^Question:\s*/i, "").trim();
    return this.questions.has(clean);
  }

  clear(): void {
    this.questions.clear();
    this.notify();
  }
}

// Global shared store singleton
export const lawyerChecklistStore = new LawyerChecklistStore();

/**
 * React hook subscribing to the shared lawyer checklist store.
 */
export function useLawyerChecklist() {
  const questions = useSyncExternalStore(
    (callback) => lawyerChecklistStore.subscribe(callback),
    () => lawyerChecklistStore.getSnapshot(),
    () => [] // Server snapshot for SSR hydration
  );

  return {
    questions,
    addQuestion: (q: string) => lawyerChecklistStore.addQuestion(q),
    removeQuestion: (q: string) => lawyerChecklistStore.removeQuestion(q),
    toggleQuestion: (q: string, state?: boolean) => lawyerChecklistStore.toggleQuestion(q, state),
    hasQuestion: (q: string) => lawyerChecklistStore.hasQuestion(q),
    clearQuestions: () => lawyerChecklistStore.clear(),
  };
}
