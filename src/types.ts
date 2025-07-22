/**
 * Type definitions for @matson/ecs package
 * 
 * All configuration is done via context parameters following 12-factor principles.
 * No hardcoded values or environment logic in the code.
 */

import * as cdk from 'aws-cdk-lib';

/**
 * Configuration interface for ECS service deployment
 * All values are provided via context parameters with sensible defaults
 */
export interface EcsServiceConfig {
  /** VPC ID where the ECS service will be deployed */
  vpcId: string;
  
  /** Subnet IDs for the ECS service (comma-separated string or array) */
  subnetIds: string | string[];
  
  /** ECS cluster name where the service will be deployed */
  clusterName: string;
  
  /** Container image URI or path to Containerfile */
  image: string;
  
  /** Service name (defaults to stack name) */
  serviceName?: string;
  
  /** Number of tasks to run (default: 1) */
  desiredCount?: number;
  
  /** CPU units for the task (default: 256) */
  cpu?: number;
  
  /** Memory in MiB for the task (default: 512) */
  memory?: number;
  
  /** Port that the container exposes (default: 80) */
  containerPort?: number;
  
  /** Load balancer port (default: 80) */
  lbPort?: number;
  
  /** Health check path (default: '/') */
  healthCheckPath?: string;
  
  /** Allowed CIDR for ALB security group (default: '0.0.0.0/0') */
  allowedCidr?: string;
  
  /** Environment variables for the container */
  environment?: { [key: string]: string };
  
  /** Secrets for the container */
  secrets?: { [key: string]: string };
  
  /** Log group name (defaults to service name) */
  logGroupName?: string;
  
  /** Log retention days (default: 7) */
  logRetentionDays?: number;
  
  /** Whether to enable auto scaling (default: false) */
  enableAutoScaling?: boolean;
  
  /** Minimum capacity for auto scaling (default: 1) */
  minCapacity?: number;
  
  /** Maximum capacity for auto scaling (default: 10) */
  maxCapacity?: number;
  
  /** Target CPU utilization for auto scaling (default: 70) */
  targetCpuUtilization?: number;
  
  /** Target memory utilization for auto scaling (default: 70) */
  targetMemoryUtilization?: number;
  
  /** Task execution role ARN (optional) */
  taskExecutionRoleArn?: string;
  
  /** Task role ARN (optional) */
  taskRoleArn?: string;
  
  /** Values file path for loading configuration from file */
  valuesFile?: string;
}

/**
 * Props for the EcsServiceStack construct
 */
export interface EcsServiceStackProps extends cdk.StackProps {
  /** Configuration for the ECS service */
  config: EcsServiceConfig;
}

/**
 * Values file interface for loading configuration from JSON/JS files
 */
export interface ValuesFile {
  [key: string]: any;
}

/**
 * Help configuration interface
 */
export interface HelpConfig {
  /** Whether to show help information */
  help?: boolean;
} 