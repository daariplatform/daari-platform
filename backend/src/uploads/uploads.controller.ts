import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  Controller,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { diskStorage, MulterError } from 'multer';
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

// 5 MB hard cap. Phone JPEGs at 12 MP typically land between 2–4 MB after
// in-app compression; 5 MB leaves headroom for low-end devices that skip
// re-encode. Above this we bounce the request with a clean Arabic message.
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Multer surfaces size violations as `MulterError(code='LIMIT_FILE_SIZE')`,
 * which Nest doesn't translate to a clean HTTP response by default —
 * the driver app would see a generic 500. This filter intercepts that
 * specific case and any HttpExceptions that bubble out of our fileFilter,
 * and returns a friendly Arabic JSON payload with the right status code.
 */
@Catch(MulterError, HttpException)
class UploadExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError | HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: 'حجم الملف يتجاوز 5 ميجابايت',
        });
      }
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message,
      });
    }
    // Pass-through for our own HttpExceptions (fileFilter rejection,
    // missing-file BadRequest, etc.) with their original status + body.
    const status = exception.getStatus();
    const body = exception.getResponse();
    return res.status(status).json(
      typeof body === 'string' ? { statusCode: status, message: body } : body,
    );
  }
}

@ApiBearerAuth()
@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  @RequireCapability('driver')
  @Post('proof')
  @UseFilters(UploadExceptionFilter)
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
          // HttpException(400) — caught by UploadExceptionFilter and
          // returned as a clean JSON body.
          cb(new BadRequestException('نوع ملف غير مدعوم'), false);
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
