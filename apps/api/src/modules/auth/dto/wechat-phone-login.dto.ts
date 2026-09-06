import { IsNotEmpty, IsString } from 'class-validator';

export class WechatPhoneLoginDto {
  @IsString()
  @IsNotEmpty()
  loginCode: string;

  @IsString()
  @IsNotEmpty()
  phoneCode: string;
}
