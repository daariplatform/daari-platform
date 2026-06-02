import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OtpService } from './otp.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        const isProd = config.get<string>('NODE_ENV') === 'production';
        // ارفض الإقلاع بسرّ مفقود أو افتراضي أو قصير — توكنات موقّعة بسرّ ضعيف
        // قابلة للتزوير. نشدّد على الطول/القيمة الافتراضية في الإنتاج فقط.
        if (!secret || (isProd && (secret.length < 32 || secret === 'CHANGE_ME'))) {
          throw new Error(
            'JWT_SECRET is missing or insecure — set a strong value (>= 32 chars). Refusing to start.',
          );
        }
        return {
          secret,
          signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OtpService],
  exports: [AuthService, OtpService],
})
export class AuthModule {}
