import { ImageProvider, ImageGenerationRequest, ImageGenerationResult } from "./types";
import { generateImage } from "../gemini";

export class Nanobana2Provider implements ImageProvider {
  id = "nanobana2";

  async generateImage(req: ImageGenerationRequest, signal?: AbortSignal, traceId?: string): Promise<ImageGenerationResult | undefined> {
    const result = await generateImage(
      req.prompt,
      "gemini-3.1-flash-image-preview",
      {
        aspectRatio: req.aspectRatio || "1:1",
        imageSize: req.quality === "high" ? "2K" : "1K",
      },
      signal,
      traceId
    );
 
    if (!result) return undefined;
 
    return {
      url: result.url,
      traceId: result.traceId,
      provider: this.id,
      providerMetadata: {
        model: "gemini-3.1-flash-image-preview",
      },
    };
  }
}
