import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

/**
 * AI analytics module — bundles the four read-only insight endpoints
 * (demand forecast, churn risk, order clusters, driver scorecard).
 *
 * No external dependencies beyond PrismaService (provided globally), so we
 * don't need to import anything here. The controller is registered under
 * /api/v1/plant/ai/ via the global prefix + @Controller('plant/ai').
 */
@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
