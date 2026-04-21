/**
 * Configuration for image generation requests.
 */
export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "1:4" | "1:8" | "4:1" | "8:1";
  styleConstraints?: string;
  seed?: number;
  quality?: "standard" | "high";
}

/**
 * Result of an image generation operation.
 */
export interface ImageGenerationResult {
  url: string;
  traceId: string;
  provider: string;
  mimeType?: string;
  providerMetadata?: Record<string, any>;
}

/**
 * Common interface for image generation providers.
 */
export interface ImageProvider {
  id: string;
  generateImage(req: ImageGenerationRequest, signal?: AbortSignal, traceId?: string): Promise<ImageGenerationResult | undefined>;
}
