/**
 * File Type and Magic-Byte Validator for NyaySetu Ingestion
 * Strict Invariant (02-TRD.md): "File type/size validation on upload."
 * Prevents extension-spoofing and malicious file execution by verifying header magic bytes.
 */

export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB maximum

export type AllowedMimeType = "application/pdf" | "image/png" | "image/jpeg";

export interface FileValidationResult {
  isValid: boolean;
  detectedType?: AllowedMimeType;
  resolvedMime?: AllowedMimeType;
  sanitizedFilename?: string;
  error?: string;
}

/**
 * Checks if the first bytes match known binary magic byte signatures.
 */
export function detectMagicBytes(
  buffer: Buffer | Uint8Array
): AllowedMimeType | "executable" | "unknown" {
  if (!buffer || buffer.length < 4) {
    return "unknown";
  }

  // 1. PDF Signature: %PDF (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf";
  }

  // 2. PNG Signature: \x89PNG\r\n\x1a\n (0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // 3. JPEG Signature: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // Detect malicious Windows executable (MZ header)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return "executable";
  }

  // Detect Linux ELF binary (0x7F 'E' 'L' 'F')
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return "executable";
  }

  return "unknown";
}

/**
 * Sanitizes uploaded filename to prevent directory traversal and script injection.
 */
export function sanitizeFilename(filename: string): string {
  // Strip null bytes and control chars
  let clean = filename.replace(/[\0\x00-\x1F\x7F]/g, "");

  // Strip path separators and relative segments
  clean = clean.replace(/^.*[\\/]/, "").replace(/\.\.+/g, ".");

  // Replace potentially hazardous characters with underscores
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, "_");

  return clean || "uploaded_document";
}

/**
 * Validates an uploaded document's size, filename, and binary signature.
 */
export function validateUploadedDocument(
  buffer: Buffer | Uint8Array,
  filename: string,
  _declaredMime?: string
): FileValidationResult {
  // 1. Size Validation
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "Empty file provided." };
  }

  if (buffer.length > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `Document exceeds maximum allowed limit of 10MB (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // 2. Filename Sanitization & Extension Verification
  const safeFilename = sanitizeFilename(filename);
  const extMatch = safeFilename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "";

  const allowedExtensions = new Set(["pdf", "png", "jpg", "jpeg"]);
  if (!allowedExtensions.has(ext)) {
    return {
      isValid: false,
      error: "Unsupported file extension. Only .pdf, .png, .jpg, and .jpeg files are accepted.",
    };
  }

  // 3. Magic-Byte Signature Verification
  const detectedFormat = detectMagicBytes(buffer);

  if (detectedFormat === "executable") {
    return {
      isValid: false,
      error: "Malicious executable binary detected. Executable files are strictly forbidden.",
    };
  }

  if (detectedFormat === "unknown") {
    return {
      isValid: false,
      error: "Invalid file signature. File header does not match valid PDF, PNG, or JPEG content.",
    };
  }

  // 4. Cross-verify extension with detected magic bytes
  if (ext === "pdf" && detectedFormat !== "application/pdf") {
    return {
      isValid: false,
      error:
        "Extension mismatch: file is named as PDF but does not contain valid PDF binary headers.",
    };
  }

  if (ext === "png" && detectedFormat !== "image/png") {
    return {
      isValid: false,
      error:
        "Extension mismatch: file is named as PNG but does not contain valid PNG binary headers.",
    };
  }

  if ((ext === "jpg" || ext === "jpeg") && detectedFormat !== "image/jpeg") {
    return {
      isValid: false,
      error:
        "Extension mismatch: file is named as JPEG but does not contain valid JPEG binary headers.",
    };
  }

  return {
    isValid: true,
    detectedType: detectedFormat,
    resolvedMime: detectedFormat,
    sanitizedFilename: safeFilename,
  };
}

// Aliases for compatibility
export const validateFileSecurity = validateUploadedDocument;
export const sanitizeFileName = sanitizeFilename;
