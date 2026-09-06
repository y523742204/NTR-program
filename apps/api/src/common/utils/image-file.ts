import { BadRequestException } from '@nestjs/common';

export type ImageExtension = 'jpg' | 'png' | 'webp';

export interface UploadedImageFile {
  buffer: Buffer;
  size: number;
}

export function detectImageExtension(buffer: Buffer): ImageExtension | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isWebp ? 'webp' : null;
}

export function assertUploadedImage(
  file: UploadedImageFile | undefined,
  maxBytes: number,
  label: string,
): asserts file is UploadedImageFile {
  if (!file?.buffer.length) throw new BadRequestException(`请选择${label}图片`);
  if (file.size > maxBytes)
    throw new BadRequestException(`${label}不能超过 ${maxBytes / 1024 / 1024}MB`);
  const extension = detectImageExtension(file.buffer);
  if (!extension) throw new BadRequestException(`${label}仅支持 JPEG、PNG 或 WebP 格式`);
}
