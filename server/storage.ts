import admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";

/**
 * Uploads a buffer to Firebase Storage and returns a public URL.
 */
export async function uploadImage(buffer: Buffer, mimeType: string, folder: string = "generated-images"): Promise<string> {
  const bucket = getStorage().bucket();
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  const file = bucket.file(filename);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000',
    },
    public: true,
  });

  return `https://storage.googleapis.com/${bucket.name}/${filename}`;
}
