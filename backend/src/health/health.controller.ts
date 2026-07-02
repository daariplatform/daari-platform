import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * /health — used by nginx + monitoring to confirm the process is alive.
 * /ready — confirms downstreams (DB) respond. Used by deployment scripts
 * to decide if a new pod/process is safe to send traffic to.
 *
 * Both are public (no JWT) and excluded from throttling so external probes
 * can hit them as often as they need.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  constructor(private prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @SkipThrottle()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'ok' };
    } catch (err) {
      // Log the detailed driver error server-side only — the response is public
      // and unauthenticated, so it must not leak DB host/schema/connection info.
      this.logger.error(`/ready DB check failed: ${(err as Error).message}`);
      return {
        status: 'degraded',
        db: 'unreachable',
      };
    }
  }
}
