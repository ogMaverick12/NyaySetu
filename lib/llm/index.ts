import { type LLMProvider } from "./types";
import { GeminiProvider } from "./gemini-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import { FallbackLLMProvider } from "./fallback-provider";

export * from "./types";
export { GeminiProvider } from "./gemini-provider";
export { OpenRouterProvider } from "./openrouter-provider";
export { FallbackLLMProvider } from "./fallback-provider";

/**
 * Returns the configured default LLM provider.
 * Implements primary Gemini with automatic fallback to OpenRouter.
 *
 * Production invariant: throws immediately if neither API key is present,
 * so misconfiguration is surfaced at request time with a clear error rather
 * than silently failing mid-analysis.
 */
export function getDefaultLLMProvider(): LLMProvider {
  const isProduction = process.env.NODE_ENV === "production";
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY);

  if (isProduction && !hasGeminiKey && !hasOpenRouterKey) {
    throw new Error(
      "LLM_KEYS_NOT_CONFIGURED: No GEMINI_API_KEY or OPENROUTER_API_KEY is set. " +
        "Analysis is unavailable until at least one key is configured."
    );
  }

  const gemini = new GeminiProvider();
  const openRouter = new OpenRouterProvider();

  return new FallbackLLMProvider(gemini, openRouter);
}
