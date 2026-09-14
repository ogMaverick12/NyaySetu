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
 */
export function getDefaultLLMProvider(): LLMProvider {
  const gemini = new GeminiProvider();
  const openRouter = new OpenRouterProvider();

  return new FallbackLLMProvider(gemini, openRouter);
}
