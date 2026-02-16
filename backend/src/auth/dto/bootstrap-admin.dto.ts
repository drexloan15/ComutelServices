import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class BootstrapAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @MinLength(8)
  bootstrapSecret!: string;
}
