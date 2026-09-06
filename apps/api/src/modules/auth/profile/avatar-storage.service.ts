import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { UploadedImageFile } from '../../../common/utils/image-file';
import { ImageStorage } from '../../../common/utils/image-storage';

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
export type AvatarFile = UploadedImageFile;

@Injectable()
export class AvatarStorageService {
  private readonly storage: ImageStorage;

  constructor(config: ConfigService) {
    this.storage = new ImageStorage(config, {
      directory: 'avatars',
      label: '头像',
      maxBytes: MAX_AVATAR_SIZE_BYTES,
    });
  }

  save(file?: AvatarFile): Promise<string> {
    return this.storage.save(file);
  }
}
