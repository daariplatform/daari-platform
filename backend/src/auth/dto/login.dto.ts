import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @Matches(/^07\d{9}$/, { message: 'Phone must be a valid Iraqi number (07XXXXXXXXX)' })
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class OtpLoginDto {
  @Matches(/^07\d{9}$/)
  phone!: string;

  @IsString()
  @MinLength(4)
  otp!: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @Matches(/^07\d{9}$/, { message: 'Phone must be 07XXXXXXXXX' })
  phone!: string;
}

export class VerifyOtpDto {
  @Matches(/^07\d{9}$/)
  phone!: string;

  @IsString()
  @MinLength(6)
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
