import { Dto, Field, t } from "adorn-api";

@Dto({ name: "BiometricPoint", description: "Single qx point of a biometric table version." })
export class BiometricPointDto {
  @Field(t.integer({ minimum: 0, maximum: 130 })) age!: number;
  @Field(t.string()) sex!: string;
  @Field(t.number({ minimum: 0, maximum: 1 })) qx!: number;
}

@Dto({ name: "CreateBiometricTable", description: "Create an immutable first version of a biometric table." })
export class CreateBiometricTableDto {
  @Field(t.string({ minLength: 1 })) code!: string;
  @Field(t.string({ minLength: 1 })) name!: string;
  @Field(t.string({ minLength: 1 })) kind!: string;
  @Field(t.string({ minLength: 1 })) sexScope!: string;
  @Field(t.optional(t.string())) source?: string;
  @Field(t.optional(t.string())) description?: string;
  @Field(t.optional(t.string({ minLength: 1 }))) version?: string;
  @Field(t.optional(t.string({ format: "date" }))) effectiveFrom?: string;
  @Field(t.array(t.ref(BiometricPointDto), { minItems: 1 })) points!: BiometricPointDto[];
}

@Dto({ name: "BiometricTableSummary", description: "Biometric table library summary." })
export class BiometricTableSummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) code!: string;
  @Field(t.string()) name!: string;
  @Field(t.string()) kind!: string;
  @Field(t.string()) sexScope!: string;
  @Field(t.nullable(t.string())) source!: string | null;
  @Field(t.nullable(t.string())) description!: string | null;
  @Field(t.integer({ minimum: 0 })) versionCount!: number;
  @Field(t.nullable(t.string({ format: "uuid" }))) latestVersionId!: string | null;
  @Field(t.nullable(t.string())) latestVersion!: string | null;
  @Field(t.integer({ minimum: 0 })) pointCount!: number;
  @Field(t.nullable(t.integer())) minAge!: number | null;
  @Field(t.nullable(t.integer())) maxAge!: number | null;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
}

@Dto({ name: "BiometricVersion", description: "Version metadata with derivation provenance." })
export class BiometricVersionDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) version!: string;
  @Field(t.string()) status!: string;
  @Field(t.nullable(t.string({ format: "date" }))) effectiveFrom!: string | null;
  @Field(t.nullable(t.string({ format: "date" }))) effectiveTo!: string | null;
  @Field(t.nullable(t.string({ format: "uuid" }))) parentVersionId!: string | null;
  @Field(t.nullable(t.string())) derivationType!: string | null;
  @Field(t.string()) derivationParametersJson!: string;
  @Field(t.integer({ minimum: 0 })) minAge!: number;
  @Field(t.integer({ minimum: 0 })) maxAge!: number;
  @Field(t.integer({ minimum: 0 })) pointCount!: number;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
}

@Dto({ name: "BiometricTableDetail", description: "Biometric table and all of its immutable versions." })
export class BiometricTableDetailDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) code!: string;
  @Field(t.string()) name!: string;
  @Field(t.string()) kind!: string;
  @Field(t.string()) sexScope!: string;
  @Field(t.nullable(t.string())) source!: string | null;
  @Field(t.nullable(t.string())) description!: string | null;
  @Field(t.boolean()) enabled!: boolean;
  @Field(t.string({ format: "date-time" })) createdAt!: string;
  @Field(t.string({ format: "date-time" })) updatedAt!: string;
  @Field(t.array(t.ref(BiometricVersionDto))) versions!: BiometricVersionDto[];
}

@Dto({ name: "BiometricVersionPoints", description: "Biometric version including all qx points." })
export class BiometricVersionPointsDto {
  @Field(t.ref(BiometricVersionDto)) version!: BiometricVersionDto;
  @Field(t.array(t.ref(BiometricPointDto))) points!: BiometricPointDto[];
}

@Dto({ name: "BiometricTableParams" })
export class BiometricTableParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "BiometricVersionParams" })
export class BiometricVersionParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "DeriveBiometricVersion", description: "Create a derived immutable biometric version." })
export class DeriveBiometricVersionDto {
  @Field(t.string({ format: "uuid" })) parentVersionId!: string;
  @Field(t.string({ minLength: 1 })) version!: string;
  @Field(t.string({ minLength: 1 })) transform!: string;
  @Field(t.optional(t.number({ exclusiveMinimum: 0, maximum: 5 }))) factor?: number;
  @Field(t.optional(t.integer({ minimum: -20, maximum: 20 }))) years?: number;
  @Field(t.optional(t.string({ format: "date" }))) effectiveFrom?: string;
}
