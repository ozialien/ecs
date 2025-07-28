/**
 * Configuration mapper for converting between structured and legacy formats
 * Maintains backward compatibility while supporting new Helm-like structure
 */
import { EcsServiceConfig } from './types';
import { StructuredEcsConfig } from './structured-types';
/**
 * Configuration mapper class
 */
export declare class ConfigMapper {
    /**
     * Convert structured configuration to legacy format
     * This allows the existing CDK code to work with structured configs
     */
    static structuredToLegacy(structured: StructuredEcsConfig): EcsServiceConfig;
    /**
     * Map IAM policies from structured format to legacy format
     */
    private static mapIamPolicies;
    /**
     * Detect if configuration is in structured format
     */
    static isStructuredConfig(config: any): config is StructuredEcsConfig;
}
