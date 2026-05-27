export interface ImageAttachment {
  id: string;
  name: string;
  mediaType: string;
  data: string;
  previewUrl: string;
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function fileToImageAttachment(file: File): Promise<ImageAttachment> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be under 4 MB');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const base64 = dataUrl.split(',')[1] || '';
  return {
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mediaType: file.type || 'image/png',
    data: base64,
    previewUrl: dataUrl,
  };
}

export async function clipboardItemToAttachment(item: ClipboardItem): Promise<ImageAttachment | null> {
  const type = item.types.find((t) => t.startsWith('image/'));
  if (!type) return null;
  const blob = await item.getType(type);
  const file = new File([blob], `screenshot-${Date.now()}.png`, { type });
  return fileToImageAttachment(file);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export function attachmentsForApi(attachments: ImageAttachment[]): Array<{ mediaType: string; data: string; name?: string }> {
  return attachments.map((a) => ({ mediaType: a.mediaType, data: a.data, name: a.name }));
}
