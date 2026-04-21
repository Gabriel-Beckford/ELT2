import { ImageProvider, ImageGenerationRequest, ImageGenerationResult } from "./types";
import { generateImage } from "../gemini";

export class GeminiImageProvider implements ImageProvider {
  id = "gemini";

  async generateImage(req: ImageGenerationRequest, signal?: AbortSignal, traceId?: string): Promise<ImageGenerationResult | undefined> {
    const result = await generateImage(
      req.prompt,
      "gemini-2.5-flash-image",
      {
        aspectRatio: req.aspectRatio || "1:1",
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
        model: "gemini-2.5-flash-image",
      },
    };
  }
}
