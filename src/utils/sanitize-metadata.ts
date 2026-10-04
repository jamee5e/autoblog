const SENSITIVE_KEY_PATTERN = /(password|authorization|api[_-]?key|token|secret|cookie)/i;

export const sanitizeMetadata = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item));
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(input)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = sanitizeMetadata(nestedValue);
      }
    }

    return output;
  }

  return value;
};
