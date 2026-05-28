export interface ImageAttachment {
  id: string;
  name: string;
  mediaType: string;
  data: string;
  previewUrl: string;
  /** Blob URL — revoke when attachment removed */
  objectUrl?: string;
  /** Original file for encode-on-send */
  sourceFile?: File;
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PREVIEW_WIDTH = 1280;

/** Fast preview — returns immediately with blob URL; base64 filled async. */
export function fileToImageAttachmentFast(file: File): ImageAttachment {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be under 4 MB');
  }
  const objectUrl = URL.createObjectURL(file);
  return {
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mediaType: file.type || 'image/png',
    data: '',
    previewUrl: objectUrl,
    objectUrl,
    sourceFile: file,
  };
}

/** Ensure base64 data is ready — encodes on demand if background encode hasn't finished. */
export async function ensureAttachmentEncoded(att: ImageAttachment): Promise<ImageAttachment> {
  if (att.data) return att;
  let file = att.sourceFile;
  if (!file) {
    const url = att.objectUrl || att.previewUrl;
    if (!url) throw new Error('Missing image data');
    const res = await fetch(url);
    const blob = await res.blob();
    file = new File([blob], att.name, { type: att.mediaType || blob.type || 'image/png' });
  }
  return encodeAttachmentData(file, att);
}

export async function ensureAllAttachmentsEncoded(attachments: ImageAttachment[]): Promise<ImageAttachment[]> {
  return Promise.all(attachments.map((a) => ensureAttachmentEncoded(a)));
}

/** Encode attachment data in background (call after fast preview). */
export async function encodeAttachmentData(
  file: File,
  attachment: ImageAttachment,
): Promise<ImageAttachment> {
  const resized = await resizeImageFile(file, MAX_PREVIEW_WIDTH);
  const dataUrl = await readFileAsDataUrl(resized);
  const base64 = dataUrl.split(',')[1] || '';
  return { ...attachment, data: base64, mediaType: resized.type || attachment.mediaType };
}

export async function fileToImageAttachment(file: File): Promise<ImageAttachment> {
  const fast = fileToImageAttachmentFast(file);
  return encodeAttachmentData(file, fast);
}

export async function clipboardItemToAttachment(item: ClipboardItem): Promise<ImageAttachment | null> {
  const type = item.types.find((t) => t.startsWith('image/'));
  if (!type) return null;
  const blob = await item.getType(type);
  const file = new File([blob], `screenshot-${Date.now()}.png`, { type });
  return fileToImageAttachment(file);
}

export function revokeAttachmentPreview(att: ImageAttachment): void {
  if (att.objectUrl) URL.revokeObjectURL(att.objectUrl);
}

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

async function resizeImageFile(file: File, maxWidth: number): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 200_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width <= maxWidth) {
      bitmap.close();
      return file;
    }
    const scale = maxWidth / bitmap.width;
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function attachmentsForApi(
  attachments: ImageAttachment[],
): Array<{ mediaType: string; data: string; name?: string }> {
  return attachments
    .filter((a) => a.data)
    .map((a) => ({ mediaType: a.mediaType, data: a.data, name: a.name }));
}
