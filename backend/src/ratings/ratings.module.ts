import { Module } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import {
  DriverRatingsController,
  OrderRatingController,
} from './ratings.controller';

@Module({
  controllers: [OrderRatingController, DriverRatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
