import { genUploader } from "uploadthing/client";

const UPLOADTHING_SERVER_URL = "/api/uploadthing";

const { uploadFiles: utUpload } = genUploader({
  url: UPLOADTHING_SERVER_URL,
});

export async function uploadFiles(opts: {
  files: File[];
  token?: string;
  description?: string;
  brand?: string;
}) {
  const headers: Record<string, string> = {};
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }
  if (opts.description) {
    headers["x-description"] = opts.description;
  }
  if (opts.brand) {
    headers["x-brand"] = opts.brand;
  }
  return utUpload("pngUploader", {
    files: opts.files,
    headers,
  });
}
