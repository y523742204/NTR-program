import type { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { assertUploadedImage, detectImageExtension, type UploadedImageFile } from './image-file';

interface ImageStorageOptions {
  directory: string;
  label: string;
  maxBytes: number;
}

export class ImageStorage {
  private readonly imageRoot: string;
  private readonly publicPrefix: string;

  constructor(
    config: ConfigService,
    private readonly options: ImageStorageOptions,
  ) {
    const uploadRoot = resolve(config.get<string>('UPLOAD_ROOT') || 'uploads');
    this.imageRoot = resolve(uploadRoot, options.directory);
    this.publicPrefix = `/uploads/${options.directory}`;
  }

  async save(file?: UploadedImageFile): Promise<string> {
    assertUploadedImage(file, this.options.maxBytes, this.options.label);
    const extension = detectImageExtension(file.buffer);

    await mkdir(this.imageRoot, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(resolve(this.imageRoot, filename), file.buffer, { flag: 'wx' });
    return `${this.publicPrefix}/${filename}`;
  }

  async remove(imageUrl: string): Promise<void> {
    const prefix = `${this.publicPrefix}/`;
    if (!imageUrl.startsWith(prefix)) return;
    const filename = imageUrl.slice(prefix.length);
    if (!/^[0-9a-f-]+\.(?:jpe?g|png|webp)$/.test(filename)) return;
    await rm(resolve(this.imageRoot, filename), { force: true });
  }
}
