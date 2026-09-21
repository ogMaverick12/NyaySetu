import { type ComparisonResult } from "@/features/compare/types";

type Listener = () => void;

class FairnessStore {
  private compareResult: ComparisonResult | null = null;
  private listeners = new Set<Listener>();
  private listenerInstalled = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.installFetchInterceptor();
    }
  }

  public getSnapshot = (): ComparisonResult | null => {
    return this.compareResult;
  };

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public setCompareResult(result: ComparisonResult | null): void {
    this.compareResult = result;
    this.notify();
  }

  public clear(): void {
    this.compareResult = null;
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  /**
   * Non-invasively intercepts successful client fetch responses from /api/compare.
   * This allows the Fairness Score to silently recompute the moment Compare completes
   * without modifying any existing compare-feature files.
   */
  private installFetchInterceptor(): void {
    if (this.listenerInstalled || typeof window === "undefined" || !window.fetch) {
      return;
    }

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch.apply(window, args);

      try {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
        if (url.includes("/api/compare") && response.ok) {
          const clone = response.clone();
          clone
            .json()
            .then((data: { result?: ComparisonResult }) => {
              if (data?.result) {
                this.setCompareResult(data.result);
              }
            })
            .catch(() => {});
        }
      } catch {
        // Ignore parsing errors in interceptor
      }

      return response;
    };

    this.listenerInstalled = true;
  }
}

export const fairnessStore = new FairnessStore();
