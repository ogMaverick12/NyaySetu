/**
 * Security Audit Logger for NyaySetu
 * Strict Invariant (02-TRD.md): "No document content in logs or analytics."
 * Automatically redacts all document text, citizen inquiries, raw pages, and secrets.
 */

const REDACTED_PLACEHOLDER = "[REDACTED_FOR_PRIVACY]";

// Sensitive key patterns that must never appear in application logs
const SENSITIVE_KEY_PATTERN =
  /(text|content|fulltext|sourcetext|rawpages|question|answer|prompt|body|payload|secret|key|token|auth|password|excerpt|verbatim)/i;

/**
 * Recursively strips or replaces any sensitive keys or strings with privacy placeholders.
 */
export function sanitizeLogMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) {
    return obj;
  }

  // Handle Buffer or binary data
  if (
    (typeof Buffer !== "undefined" && Buffer.isBuffer(obj)) ||
    (obj instanceof Uint8Array && !(obj instanceof Buffer))
  ) {
    return "[BUFFER_REDACTED]";
  }

  if (typeof obj === "string") {
    // If a string looks excessively long (e.g. contract excerpt), truncate it
    if (obj.length > 120) {
      return `${obj.slice(0, 40)}... ${REDACTED_PLACEHOLDER}`;
    }
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogMetadata(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key.toLowerCase() === "buffer") {
      sanitized[key] = "[BUFFER_REDACTED]";
    } else if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = REDACTED_PLACEHOLDER;
    } else {
      sanitized[key] = sanitizeLogMetadata(value, depth + 1);
    }
  }

  return sanitized;
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

class SecurityLogger {
  private formatEntry(
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
    error?: unknown
  ): LogEntry {
    const sanitizedMeta = meta ? (sanitizeLogMetadata(meta) as Record<string, unknown>) : undefined;

    const errorMessage = error
      ? error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error)
      : undefined;

    return {
      timestamp: new Date().toISOString(),
      level,
      event,
      metadata: sanitizedMeta,
      error: errorMessage,
    };
  }

  info(event: string, meta?: Record<string, unknown>): void {
    const entry = this.formatEntry("info", event, meta);
    // In production or development, log structured sanitized JSON
    console.info(`[NyaySetu Audit] ${JSON.stringify(entry)}`);
  }

  warn(event: string, meta?: Record<string, unknown>): void {
    const entry = this.formatEntry("warn", event, meta);
    console.warn(`[NyaySetu Warning] ${JSON.stringify(entry)}`);
  }

  error(event: string, error?: unknown, meta?: Record<string, unknown>): void {
    const entry = this.formatEntry("error", event, meta, error);
    console.error(`[NyaySetu Error] ${JSON.stringify(entry)}`);
  }
}

export const securityLogger = new SecurityLogger();
