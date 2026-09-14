import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { randomUUID } from "crypto";

export interface SessionData {
  id: string;
  createdAt: number;
  lastAccessedAt: number;
  ttlMs: number;
  document: ParsedDocument | null;
  clauses: Clause[];
  metadata: unknown;
  qaHistory: Array<{ question: string; answer: string; timestamp: number }>;
}

// Default 30-minute rolling TTL for ephemeral storage
export const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;

export class InMemorySessionStore {
  private sessions = new Map<string, SessionData>();
  private sweepInterval: NodeJS.Timeout | null = null;
  private defaultTtlMs: number;

  constructor(defaultTtlMinutes = 30) {
    this.defaultTtlMs = defaultTtlMinutes * 60 * 1000;

    // Periodically sweep and purge expired sessions every 5 minutes
    if (typeof setInterval !== "undefined") {
      this.sweepInterval = setInterval(
        () => {
          this.cleanupExpiredSessions();
        },
        5 * 60 * 1000
      );

      // Unref timer so it doesn't hold open node process in tests or edge runs
      if (this.sweepInterval && typeof this.sweepInterval.unref === "function") {
        this.sweepInterval.unref();
      }
    }
  }

  /**
   * Retrieves an existing valid session or generates a new session record.
   */
  getOrCreateSession(sessionId?: string, customTtlMs?: number): SessionData {
    const ttl = customTtlMs ?? this.defaultTtlMs;
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      if (this.isExpired(session)) {
        this.sessions.delete(sessionId);
      } else {
        session.lastAccessedAt = Date.now();
        return session;
      }
    }

    const newId = sessionId && sessionId.trim() ? sessionId : randomUUID();
    const newSession: SessionData = {
      id: newId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      ttlMs: ttl,
      document: null,
      clauses: [],
      metadata: null,
      qaHistory: [],
    };

    this.sessions.set(newId, newSession);
    return newSession;
  }

  /**
   * Convenience getter matching Map semantics.
   */
  get(sessionId: string): SessionData | null {
    return this.getSession(sessionId);
  }

  /**
   * Convenience setter to store or update session state.
   */
  set(sessionId: string, data: Partial<Omit<SessionData, "id" | "createdAt">>): SessionData {
    const session = this.getOrCreateSession(sessionId);
    return this.updateSession(sessionId, data) || session;
  }

  /**
   * Checks whether session exists and is unexpired.
   */
  has(sessionId: string): boolean {
    return this.getSession(sessionId) !== null;
  }

  /**
   * Retrieves an active session by ID, returning null if expired or missing.
   */
  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (this.isExpired(session)) {
      this.sessions.delete(sessionId);
      return null;
    }

    session.lastAccessedAt = Date.now();
    return session;
  }

  /**
   * Updates fields on an active session.
   */
  updateSession(
    sessionId: string,
    updates: Partial<Omit<SessionData, "id" | "createdAt">>
  ): SessionData | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    Object.assign(session, updates, { lastAccessedAt: Date.now() });
    return session;
  }

  /**
   * Explicit "Delete My Data" purge. Permanently wipes session from memory.
   */
  deleteSession(sessionId: string): boolean {
    const existed = this.sessions.has(sessionId);
    if (existed) {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Zero-out internal references before deletion
        session.document = null;
        session.clauses = [];
        session.qaHistory = [];
        session.metadata = null;
      }
      this.sessions.delete(sessionId);
    }
    return existed;
  }

  /**
   * Sweeps the in-memory store and evicts expired sessions.
   * Returns the count of evicted records.
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let evictedCount = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt > session.ttlMs) {
        this.sessions.delete(id);
        evictedCount++;
      }
    }

    return evictedCount;
  }

  /**
   * Checks whether a session has exceeded its rolling TTL.
   */
  private isExpired(session: SessionData): boolean {
    return Date.now() - session.lastAccessedAt > session.ttlMs;
  }

  /**
   * Total active (unexpired) session count for diagnostic telemetry.
   */
  getActiveSessionCount(): number {
    this.cleanupExpiredSessions();
    return this.sessions.size;
  }

  /**
   * Clears all sessions (primarily for unit test teardown).
   */
  clearAllSessions(): void {
    this.sessions.clear();
  }

  /**
   * Cleans up background sweep timer on shutdown.
   */
  destroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    this.clearAllSessions();
  }
}

// Export singleton session store
export const sessionStore = new InMemorySessionStore();
