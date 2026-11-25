import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export const MAX_DATABASE_INT = 2_147_483_647;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const Trim = () => Transform(({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value,
);

const NormalizeEmail = () => Transform(({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value,
);

export const NormalizeUuid = () => Transform(({ value }: { value: unknown }) =>
  typeof value === "string" ? value.toLowerCase() : value,
);

export class LoginDto {
  @ApiProperty({ format: "email" })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ maxLength: 120 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  storeName!: string;

  @ApiProperty({ maxLength: 63, pattern: SLUG_PATTERN.source })
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(63)
  slug!: string;
}

export class ProductOptionInputDto {
  @ApiProperty({ maxLength: 60 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 30 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(60, { each: true })
  values!: string[];
}

export class ProductVariantInputDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @NormalizeUuid()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 120 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ maxLength: 80 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku!: string;

  @ApiProperty({ minimum: 0, maximum: MAX_DATABASE_INT })
  @IsInt()
  @Min(0)
  @Max(MAX_DATABASE_INT)
  priceCents!: number;

  @ApiProperty({ minimum: 0, maximum: MAX_DATABASE_INT })
  @IsInt()
  @Min(0)
  @Max(MAX_DATABASE_INT)
  stock!: number;

  @ApiProperty({ type: "object", additionalProperties: { type: "string" } })
  @IsObject()
  selectedOptions!: Record<string, string>;
}

export class CreateProductDto {
  @ApiProperty({ maxLength: 160 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ maxLength: 5000 })
  @Trim()
  @IsString()
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ maxLength: 80 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku!: string;

  @ApiProperty({ minimum: 0, maximum: MAX_DATABASE_INT })
  @IsInt()
  @Min(0)
  @Max(MAX_DATABASE_INT)
  priceCents!: number;

  @ApiProperty({ minimum: 0, maximum: MAX_DATABASE_INT })
  @IsInt()
  @Min(0)
  @Max(MAX_DATABASE_INT)
  stock!: number;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  @NormalizeUuid()
  @ValidateIf((_object: unknown, value: unknown) => value !== null && value !== undefined)
  @IsUUID()
  imageId?: string | null;

  @ApiPropertyOptional({ type: [ProductOptionInputDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionInputDto)
  options?: ProductOptionInputDto[];

  @ApiPropertyOptional({ type: [ProductVariantInputDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantInputDto)
  variants?: ProductVariantInputDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto, { skipNullProperties: false }) {}

export class FulfillmentDto {
  @ApiProperty({ enum: ["fulfilled"] })
  @IsIn(["fulfilled"])
  status!: "fulfilled";
}

export class UpdateTenantStatusDto {
  @ApiProperty({ enum: ["active", "suspended"] })
  @IsIn(["active", "suspended"])
  status!: "active" | "suspended";

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class CheckoutItemDto {
  @ApiProperty({ format: "uuid" })
  @NormalizeUuid()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @NormalizeUuid()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

class CheckoutCustomerDto {
  @ApiProperty({ maxLength: 160 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ format: "email" })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ maxLength: 500 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;
}

export class CheckoutDto {
  @ApiProperty({ format: "uuid" })
  @NormalizeUuid()
  @IsUUID()
  checkoutKey!: string;

  @ApiProperty({ type: [CheckoutItemDto], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty({ type: CheckoutCustomerDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer!: CheckoutCustomerDto;

  @ApiProperty({ enum: ["approved", "declined"] })
  @IsIn(["approved", "declined"])
  payment!: "approved" | "declined";
}

export function isTenantSlug(slug: string): boolean {
  return slug.length <= 63 && SLUG_PATTERN.test(slug);
}
