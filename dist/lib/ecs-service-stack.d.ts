/**
 * ECS Service Stack - Helm-style CDK construct for ECS deployments
 *
 * This construct creates a complete ECS service deployment with:
 * - ECS Cluster (if not existing)
 * - Application Load Balancer
 * - ECS Service with Fargate tasks
 * - Auto Scaling (optional)
 * - CloudWatch Logs
 * - Security Groups
 *
 * All configuration is done via context parameters following 12-factor principles.
 * No hardcoded values or environment logic in the code.
 */
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { Construct } from 'constructs';
import { EcsServiceStackProps } from './types';
/**
 * ECS Service Stack construct
 *
 * Creates a complete ECS service deployment with all necessary infrastructure.
 * Configuration is provided via context parameters with sensible defaults.
 */
export declare class EcsServiceStack extends cdk.Stack {
    readonly service: ecs.FargateService;
    readonly cluster: ecs.ICluster;
    readonly loadBalancer: ecs_patterns.ApplicationLoadBalancedFargateService;
    private readonly stackProps;
    constructor(scope: Construct, id: string, props: EcsServiceStackProps);
    /**
     * Check if help is requested via context parameter
     */
    private isHelpRequested;
    /**
     * Handle credential context parameters
     * Sets AWS credential environment variables from context
     */
    private handleCredentialContext;
    /**
     * Validate required parameters and throw descriptive errors
     */
    private validateRequiredParameters;
    /**
     * Load configuration from context parameters with sensible defaults
     * Follows 12-factor principles - all configuration via environment/context
     */
    private loadConfiguration;
    /**
     * Get context value with fallback to test config
     */
    private getContextValue;
    /**
     * Get numeric context value with proper type conversion
     */
    private getNumericContextValue;
    /**
     * Get boolean context value with proper type conversion
     */
    private getBooleanContextValue;
    /**
     * Parse subnet IDs from string or array
     */
    private parseSubnetIds;
    /**
     * Parse environment variables from context
     */
    private parseEnvironmentVariables;
    /**
     * Parse environment variables as array for structured config
     */
    private parseEnvironmentVariablesAsArray;
    /**
     * Parse secrets from context
     */
    private parseSecrets;
    /**
     * Parse secrets as array for structured config
     */
    private parseSecretsAsArray;
    /**
     * Load configuration from values file (JSON, YAML, JS)
     */
    private loadValuesFile;
    /**
     * Parse YAML content with fallback to JSON
     */
    private parseYaml;
    /**
     * Create or import VPC based on VPC ID
     */
    private createOrImportVpc;
    /**
     * Create or import ECS cluster
     */
    private createOrImportCluster;
    /**
     * Create ECS service with application load balancer
     */
    private createEcsService;
    /**
     * Create CloudWatch log group for the service
     */
    private createLogGroup;
    /**
     * Create Fargate task definition
     */
    private createTaskDefinition;
    /**
     * Create execution role with required permissions for ECS
     */
    private createExecutionRole;
    /**
     * Create task role with required permissions for the application
     */
    private createTaskRole;
    /**
     * Add detailed IAM permissions to a role
     */
    private addDetailedPermissions;
    /**
     * Add container to task definition
     */
    private addContainerToTaskDefinition;
    /**
     * Create health check configuration
     */
    private createHealthCheck;
    /**
     * Create load balanced service
     */
    private createLoadBalancedService;
    /**
     * Create capacity provider strategies
     */
    private createCapacityProviderStrategies;
    /**
     * Configure service discovery if enabled
     */
    private configureServiceDiscovery;
    /**
     * Configure security group rules
     */
    private configureSecurityGroup;
    /**
     * Create container image from various sources
     * Supports ECR, external registries, and local Containerfiles
     */
    private createContainerImage;
    /**
     * Create secrets for the container
     */
    private createSecrets;
    /**
     * Add auto scaling to the service
     */
    private addAutoScaling;
    /**
     * Add CloudFormation outputs
     */
    private addOutputs;
    /**
     * Convert a value to CDK Duration
     * Handles both Duration objects and numbers (seconds)
     */
    private convertToDuration;
    /**
     * Convert retention days to CDK RetentionDays enum
     */
    private convertRetentionDays;
    /**
     * Require a context parameter to be present
     */
    private requireContext;
}
