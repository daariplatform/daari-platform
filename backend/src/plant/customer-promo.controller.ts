import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PromoService } from './promo.service';

/**
 * Customer-facing read for "is there an active promo for my plant right now?".
 * The mobile customer app polls this on the home screen to morph the
 * "اطلب الآن" CTA into the discounted variant. Returns null when there's
 * no active campaign — UI keeps the regular price.
 */
@ApiTags('customer-promo')
@ApiBearerAuth()
@Controller('customers/me')
export class CustomerPromoController {
  constructor(private promo: PromoService) {}

  /** GET /customers/me/active-promo */
  @Get('active-promo')
  @Roles(UserRole.CUSTOMER)
  async active(@CurrentUser() user: AuthUser) {
    if (!user.tenantId) return null;
    return this.promo.getActiveForTenant(user.tenantId);
  }
}
