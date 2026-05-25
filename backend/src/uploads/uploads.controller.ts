import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { RequireCapability } from '../common/decorators/capabilities.decorator';

/**
 * UploadsController — proof-of-delivery photo uploads for drivers.
 *
 * Storage: local disk under `${UPLOADS_DIR}/proof/`. nginx serves the file
 * back to clients via `${APP_URL}/uploads/proof/<filename>` — set up the
 * static-file mapping when deploying. For MVP this avoids the cost and
 * complexity of S3; switching later only changes this controller.
 *
 * Auth: only drivers can upload. The form-data field name must be `photo`.
 */
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/var/uploads';
const PROOF_SUBDIR = 'proof';
const PROOF_DIR = join(UPLOADS_DIR, PROOF_SUBDIR);

// Ensure the directory exists at boot — multer won't create it.
try {
  mkdirSync(PROOF_DIR, { recursive: true });
} catch {
  // Permission errors surface at request time; that's acceptable for MVP.
}

const ACCEPTED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB — phones take large JPEGs

@ApiBearerAuth()
@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  @RequireCapability('driver')
  @Post('proof')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: PROOF_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '.jpg').toLowerCase() || '.jpg';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ACCEPTED_MIME.has(file.mimetype)) {
          cb(new BadRequestException('نوع الملف غير مدعوم — JPEG/PNG/WebP فقط'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadProof(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('لا يوجد ملف — احرص على إرسال field اسمه "photo"');
    }
    // Public URL the driver app can store on the order. nginx-served.
    const appUrl = process.env.APP_URL ?? '';
    const url = `${appUrl}/uploads/${PROOF_SUBDIR}/${file.filename}`;
    return { url };
  }
}
