import { type NegotiationEmailDraft } from "../types";

type Listener = () => void;

class NegotiationEmailStore {
  private drafts = new Map<string, NegotiationEmailDraft>();
  private listeners = new Set<Listener>();
  private storageKey = "nyaysetu_negotiation_email_cache";

  constructor() {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const saved = window.sessionStorage.getItem(this.storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, NegotiationEmailDraft>;
          if (parsed && typeof parsed === "object") {
            Object.entries(parsed).forEach(([key, draft]) => {
              this.drafts.set(key, draft);
            });
          }
        }
      } catch {
        // Fallback silently if sessionStorage is unavailable
      }
    }
  }

  public getDraft(docKey: string): NegotiationEmailDraft | null {
    return this.drafts.get(docKey) || null;
  }

  public setDraft(docKey: string, draft: NegotiationEmailDraft): void {
    this.drafts.set(docKey, draft);
    this.persist();
    this.notify();
  }

  public clear(): void {
    this.drafts.clear();
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(this.storageKey);
      } catch {
        // Ignore
      }
    }
    this.notify();
  }

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  private persist(): void {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const obj: Record<string, NegotiationEmailDraft> = {};
        this.drafts.forEach((draft, key) => {
          obj[key] = draft;
        });
        window.sessionStorage.setItem(this.storageKey, JSON.stringify(obj));
      } catch {
        // Ignore storage limits
      }
    }
  }
}

export const negotiationEmailStore = new NegotiationEmailStore();
