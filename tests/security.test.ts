import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateFileSecurity,
  sanitizeFileName,
  InMemorySessionStore,
  RateLimiter,
  securityLogger,
  sanitizeLogMetadata,
} from "@/lib/security";
import nextConfig from "../next.config.mjs";

describe("NyaySetu Security Suite (02-TRD.md Compliance)", () => {
  // --------------------------------------------------------------------------
  // 1. Binary Magic Bytes & File Upload Security
  // --------------------------------------------------------------------------
  describe("1. Binary Magic Byte & Anti-Spoofing Validation", () => {
    it("should accept authentic PDF documents matching %PDF- signature", () => {
      // %PDF-1.7 header
      const validPdfBytes = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
      ]);

      const result = validateFileSecurity(validPdfBytes, "rental_agreement.pdf", "application/pdf");
      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe("application/pdf");
      expect(result.error).toBeUndefined();
    });

    it("should accept authentic PNG images matching 89PNG signature", () => {
      const validPngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52,
      ]);

      const result = validateFileSecurity(validPngBytes, "contract_scan.png", "image/png");
      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe("image/png");
    });

    it("should accept authentic JPEG images matching FFD8FF signature", () => {
      const validJpgBytes = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);

      const result = validateFileSecurity(validJpgBytes, "photo.jpeg", "image/jpeg");
      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe("image/jpeg");
    });

    it("should reject malicious executables spoofed as PDF files (e.g. malware.exe renamed to agreement.pdf)", () => {
      // Windows PE MZ header disguised as PDF
      const spoofedExeBytes = new Uint8Array([
        0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00,
        0x00,
      ]);

      const result = validateFileSecurity(
        spoofedExeBytes,
        "malicious_agreement.pdf",
        "application/pdf"
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/Executable files are strictly forbidden/i);
    });

    it("should reject Linux ELF binaries disguised as PNG files", () => {
      // ELF header: 0x7F 0x45 0x4C 0x46
      const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);

      const result = validateFileSecurity(elfBytes, "trojan.png", "image/png");
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/Executable files are strictly forbidden/i);
    });

    it("should reject files exceeding the 10MB size ceiling", () => {
      // Exceed 10MB (10 * 1024 * 1024 + 1 bytes)
      const hugeBuffer = new Uint8Array(10 * 1024 * 1024 + 100);
      hugeBuffer[0] = 0x25;
      hugeBuffer[1] = 0x50;
      hugeBuffer[2] = 0x44;
      hugeBuffer[3] = 0x46;

      const result = validateFileSecurity(hugeBuffer, "huge.pdf", "application/pdf");
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/exceeds maximum allowed limit of 10MB/i);
    });

    it("should neutralize directory traversal attacks in uploaded file names", () => {
      expect(sanitizeFileName("../../../etc/passwd.pdf")).toBe("passwd.pdf");
      expect(sanitizeFileName("..\\..\\windows\\system32\\calc.pdf")).toBe("calc.pdf");
      expect(sanitizeFileName("legal///contract***test.pdf")).toBe("contract___test.pdf");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Ephemeral Session Store & TTL Auto-Purge
  // --------------------------------------------------------------------------
  describe("2. Ephemeral Session Store with Rolling TTL & Manual Purge", () => {
    let store: InMemorySessionStore;

    beforeEach(() => {
      // 1-minute TTL for deterministic unit testing
      store = new InMemorySessionStore(1);
    });

    it("should store and retrieve session data for an active session", () => {
      const sessionId = "session-citizen-101";
      store.set(sessionId, {
        document: {
          id: "doc-1",
          filename: "test.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 1024,
          pageCount: 1,
          pages: [{ text: "test", pageNumber: 1, charCount: 4, wordCount: 1 }],
          fullText: "test",
          isOcr: false,
          createdAt: new Date().toISOString(),
        },
      });

      const retrieved = store.get(sessionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.document?.filename).toBe("test.pdf");
      expect(store.has(sessionId)).toBe(true);
    });

    it("should support instant permanent purge when citizen requests 'Delete My Data'", () => {
      const sessionId = "session-citizen-102";
      store.set(sessionId, {
        document: {
          id: "doc-2",
          filename: "nda.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 2048,
          pageCount: 1,
          pages: [{ text: "secret", pageNumber: 1, charCount: 6, wordCount: 1 }],
          fullText: "secret",
          isOcr: false,
          createdAt: new Date().toISOString(),
        },
        clauses: [
          {
            id: "clause-1",
            page: 1,
            type: "restrictive_covenant",
            sourceText: "Secret verbatim",
            plainSummary: "Secret summary",
            riskLevel: "high-risk",
            rationale: "Onerous non-compete term",
          },
        ],
      });

      expect(store.has(sessionId)).toBe(true);
      const purged = store.deleteSession(sessionId);
      expect(purged).toBe(true);
      expect(store.get(sessionId)).toBeNull();
      expect(store.has(sessionId)).toBe(false);
    });

    it("should automatically expire sessions when TTL has elapsed", () => {
      const sessionId = "session-citizen-103";
      store.set(sessionId, {
        document: {
          id: "doc-3",
          filename: "expired.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 1024,
          pageCount: 1,
          pages: [{ text: "expired", pageNumber: 1, charCount: 7, wordCount: 1 }],
          fullText: "expired",
          isOcr: false,
          createdAt: new Date().toISOString(),
        },
      });

      // Simulate passage of 2 minutes (TTL is 1 minute)
      const expiredTime = Date.now() + 2 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(expiredTime);

      expect(store.get(sessionId)).toBeNull();
      expect(store.has(sessionId)).toBe(false);

      vi.restoreAllMocks();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Rate Limiting Protection (Upload & LLM Endpoints)
  // --------------------------------------------------------------------------
  describe("3. Sliding-Window Rate Limiting Protection", () => {
    it("should allow requests under the configured threshold", () => {
      const limiter = new RateLimiter(5, 60_000); // 5 requests per minute
      const clientId = "client-ip-1";

      for (let i = 0; i < 5; i++) {
        const check = limiter.checkLimit(clientId);
        expect(check.allowed).toBe(true);
        expect(check.remaining).toBe(4 - i);
      }
    });

    it("should block requests exceeding the threshold with HTTP 429 Retry-After metadata", () => {
      const limiter = new RateLimiter(3, 60_000); // 3 requests per minute
      const clientId = "client-ip-abuse";

      // 3 successful requests
      limiter.checkLimit(clientId);
      limiter.checkLimit(clientId);
      limiter.checkLimit(clientId);

      // 4th request must be rate-limited
      const blockedCheck = limiter.checkLimit(clientId);
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.remaining).toBe(0);
      expect(blockedCheck.retryAfterSeconds).toBeGreaterThan(0);
      expect(blockedCheck.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it("should isolate rate limits across distinct client identities", () => {
      const limiter = new RateLimiter(2, 60_000);
      const userA = "192.168.1.10";
      const userB = "192.168.1.20";

      limiter.checkLimit(userA);
      limiter.checkLimit(userA);
      expect(limiter.checkLimit(userA).allowed).toBe(false);

      // userB is unaffected
      expect(limiter.checkLimit(userB).allowed).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Privacy-First Logging (Zero Document Content in Logs)
  // --------------------------------------------------------------------------
  describe("4. Privacy-First Sanitized Audit Logging", () => {
    it("should strictly redact sensitive contract text, questions, and prompt payloads", () => {
      const rawPayload = {
        docId: "doc-test-123",
        pageCount: 3,
        sourceText: "This agreement is between Party A and Party B for $500,000.",
        question: "Can my landlord evict me without notice?",
        answer: "Under clause 4, the landlord must provide 30 days notice.",
        apiKey: "AIzaSySecretApiKey123",
        extractedClauses: [
          {
            verbatimExcerpt: "Arbitration will be held in New York only.",
            title: "Arbitration",
          },
        ],
      };

      const sanitized = sanitizeLogMetadata(rawPayload) as Record<string, unknown>;

      // Operational non-sensitive fields must be preserved
      expect(sanitized.docId).toBe("doc-test-123");
      expect(sanitized.pageCount).toBe(3);

      // Sensitive text fields must be redacted
      expect(sanitized.sourceText).toBe("[REDACTED_FOR_PRIVACY]");
      expect(sanitized.question).toBe("[REDACTED_FOR_PRIVACY]");
      expect(sanitized.answer).toBe("[REDACTED_FOR_PRIVACY]");
      expect(sanitized.apiKey).toBe("[REDACTED_FOR_PRIVACY]");

      // Nested structures must also be recursively sanitized
      const nestedClauses = sanitized.extractedClauses as Array<Record<string, unknown>>;
      expect(nestedClauses[0].verbatimExcerpt).toBe("[REDACTED_FOR_PRIVACY]");
      expect(nestedClauses[0].title).toBe("Arbitration");
    });

    it("should sanitize buffer and array payloads", () => {
      const bufferPayload = {
        action: "ocr_parse",
        buffer: Buffer.from("confidential data"),
      };

      const sanitized = sanitizeLogMetadata(bufferPayload) as Record<string, unknown>;
      expect(sanitized.action).toBe("ocr_parse");
      expect(sanitized.buffer).toBe("[BUFFER_REDACTED]");
    });

    it("should safely log audit events without throwing", () => {
      expect(() => {
        securityLogger.info("TEST_AUDIT_LOG", { docId: "doc-123", fullText: "secret" });
        securityLogger.warn("TEST_AUDIT_WARN", { reason: "rate limit warning" });
      }).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // 5. HTTP Security Headers Configuration
  // --------------------------------------------------------------------------
  describe("5. HTTP Security Headers Configuration (next.config.mjs)", () => {
    it("should define enterprise security headers for all routes", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      const headersConfig = nextConfig.headers ? await nextConfig.headers() : [];
      expect(headersConfig.length).toBeGreaterThan(0);

      const rootRoute = headersConfig.find((entry) => entry.source === "/(.*)");
      expect(rootRoute).toBeDefined();

      const headerMap = new Map(
        rootRoute?.headers.map((h: { key: string; value: string }) => [h.key, h.value])
      );

      // Strict-Transport-Security (HSTS)
      expect(headerMap.get("Strict-Transport-Security")).toContain("max-age=63072000");
      expect(headerMap.get("Strict-Transport-Security")).toContain("includeSubDomains");

      // Anti-clickjacking & MIME sniffing
      expect(headerMap.get("X-Frame-Options")).toBe("DENY");
      expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");

      // Content Security Policy (CSP)
      const csp = headerMap.get("Content-Security-Policy");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");

      // Permissions-Policy
      const permissions = headerMap.get("Permissions-Policy");
      expect(permissions).toContain("camera=()");
      expect(permissions).toContain("microphone=(self)");
    });
  });
});
