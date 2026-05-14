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
