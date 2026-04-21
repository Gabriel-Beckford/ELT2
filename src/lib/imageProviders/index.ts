import { ImageProvider, ImageGenerationRequest, ImageGenerationResult } from "./types";
import { Nanobana2Provider } from "./nanobana2";
import { GeminiImageProvider } from "./gemini";

const providers: Record<string, ImageProvider> = {
  nanobana2: new Nanobana2Provider(),
  gemini: new GeminiImageProvider(),
};

/**
 * Gets the configured image provider based on VITE_IMAGE_PROVIDER env var.
 * Defaults to nanobana2 if not set or invalid.
 */
export function getProvider(): ImageProvider {
  const providerId = (import.meta as any).env.VITE_IMAGE_PROVIDER || "nanobana2";
  return providers[providerId] || providers.nanobana2;
}

/**
 * Generates an image using the configured provider with optional fallback.
 */
export async function generateImage(req: ImageGenerationRequest, signal?: AbortSignal, traceId?: string): Promise<ImageGenerationResult | undefined> {
  const primaryProvider = getProvider();
  
  try {
    const result = await primaryProvider.generateImage(req, signal, traceId);
    if (result) return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    console.error(`Provider ${primaryProvider.id} failed, attempting fallback...`, error);
  }

  // Fallback to gemini if primary was nanobana2
  if (primaryProvider.id === "nanobana2") {
    return providers.gemini.generateImage(req, signal, traceId);
  }

  return undefined;
}

export * from "./types";
