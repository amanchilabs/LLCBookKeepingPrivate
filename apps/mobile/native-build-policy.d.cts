export interface NativeBuildPolicy {
  sqlCipherEnabled: boolean;
  securityNegativeBuild: boolean;
}

export function nativeBuildPolicy(environment: Record<string, string | undefined>): NativeBuildPolicy;
