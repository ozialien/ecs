/**
 * Type definitions for @matson/ecs package
 * 
 * All configuration is done via context parameters following 12-factor principles.
 * No hardcoded values or environment logic in the code.
 */

import * as cdk from 'aws-cdk-lib';

/**
 * Container port mapping
 */
export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  protocol: 'tcp' | 'udp';
}

/**
 * Container environment variable
 */
export interface EnvironmentVariable {
  name: string;
  value: string;
}

/**
 * Container secret
 */
export interface Secret {
  name: string;
  valueFrom: string;
}

/**
 * Container health check
 */
export interface ContainerHealthCheck {
  enabled?: boolean;
  command?: string[];
  interval?: cdk.Duration;
  timeout?: cdk.Duration;
  startPeriod?: cdk.Duration;
  retries?: number;
}

/**
 * Container mount point
 */
export interface MountPoint {
  sourceVolume: string;
  containerPath: string;
  readOnly?: boolean;
}

/**
 * Container definition
 */
export interface Container {
  name: string;
  image: string;
  portMappings?: PortMapping[];
  environment?: EnvironmentVariable[];
  secrets?: Secret[];
  healthCheck?: ContainerHealthCheck;
  mountPoints?: MountPoint[];
  essential?: boolean;
  readonlyRootFilesystem?: boolean;
  entryPoint?: string[];
  command?: string[];
}

/**
 * Volume configuration
 */
export interface Volume {
  name: string;
  efsVolumeConfiguration?: {
    fileSystemId: string;
    transitEncryption?: 'ENABLED' | 'DISABLED';
    authorizationConfig?: {
      accessPointId: string;
      iam: 'ENABLED' | 'DISABLED';
    };
  };
}

/**
 * Load balancer target group configuration
 */
export interface TargetGroup {
  healthCheckPath?: string;
  healthCheckPort?: number;
  healthyHttpCodes?: string;
  interval?: number;
  timeout?: number;
  healthyThresholdCount?: number;
  unhealthyThresholdCount?: number;
  deregistrationDelay?: number;
  stickiness?: boolean;
}

/**
 * Load balancer configuration
 */
export interface LoadBalancer {
  type: 'APPLICATION' | 'NETWORK';
  scheme?: 'internal' | 'internet-facing';
  protocol?: 'HTTP' | 'HTTPS';
  port?: number;
  certificateArn?: string;
  targetGroup?: TargetGroup;
  allowedCidr?: string;
}

/**
 * Deployment configuration
 */
export interface Deployment {
  strategy?: 'ROLLING' | 'BLUE_GREEN' | 'CANARY';
  minimumHealthyPercent?: number;
  maximumPercent?: number;
  healthCheckGracePeriodSeconds?: number;
  waitForSteadyState?: boolean;
}

/**
 * Network configuration
 */
export interface NetworkConfiguration {
  assignPublicIp?: boolean;
  securityGroups?: string[];
}

/**
 * Service configuration
 */
export interface Service {
  type: 'LOAD_BALANCED' | 'DAEMON' | 'SCHEDULED';
  desiredCount: number;
  deployment?: Deployment;
  healthCheckGracePeriodSeconds?: number;
  networkConfiguration?: NetworkConfiguration;
}

/**
 * IAM policy
 */
export interface IamPolicy {
  name: string;
  actions: string[];
  resources: string[];
}

/**
 * IAM role configuration
 */
export interface IamRole {
  policies: IamPolicy[];
}

/**
 * IAM configuration
 */
export interface Iam {
  taskRole?: IamRole;
  taskExecutionRole?: IamRole;
}

/**
 * Service discovery namespace
 */
export interface ServiceDiscoveryNamespace {
  name: string;
  type: 'private' | 'public' | 'http';
}

/**
 * Service discovery service
 */
export interface ServiceDiscoveryService {
  name: string;
  dnsType: 'A' | 'SRV';
  ttl?: number;
  routingPolicy?: 'MULTIVALUE' | 'WEIGHTED';
}

/**
 * Service discovery configuration
 */
export interface ServiceDiscovery {
  enabled?: boolean;
  namespace?: ServiceDiscoveryNamespace;
  service?: ServiceDiscoveryService;
}

/**
 * Auto scaling metric
 */
export interface AutoScalingMetric {
  type: 'CPUUtilization' | 'MemoryUtilization';
  target: number;
}

/**
 * Auto scaling configuration
 */
export interface AutoScaling {
  enabled?: boolean;
  minCapacity?: number;
  maxCapacity?: number;
  targetCpuUtilization?: number;
  targetMemoryUtilization?: number;
  metrics?: AutoScalingMetric[];
}

/**
 * ECS Cluster configuration
 */
export interface Cluster {
  name: string;
  containerInsights?: boolean;
}

/**
 * Task Definition configuration
 */
export interface TaskDefinition {
  type: 'FARGATE' | 'EC2';
  cpu: number;
  memory: number;
  runtimePlatform?: {
    cpuArchitecture: 'X86_64' | 'ARM64';
    os: 'LINUX' | 'WINDOWS_SERVER_2019_CORE' | 'WINDOWS_SERVER_2019_FULL' | 'WINDOWS_SERVER_2022_CORE' | 'WINDOWS_SERVER_2022_FULL';
  };
  containers: Container[];
  volumes?: Volume[];
  additionalContainers?: Container[];
}

/**
 * VPC configuration
 */
export interface VpcConfig {
  id?: string;
  createNew?: boolean;
  subnets?: string[];
  subnetType?: 'public' | 'private';
}

/**
 * Security group rule
 */
export interface SecurityGroupRule {
  port: number;
  cidr: string;
  description?: string;
  protocol?: 'tcp' | 'udp' | 'icmp';
}

/**
 * Security group configuration
 */
export interface SecurityGroup {
  name: string;
  rules: SecurityGroupRule[];
}

/**
 * Infrastructure configuration
 */
export interface Infrastructure {
  vpc: VpcConfig;
  securityGroups?: SecurityGroup[];
}

/**
 * Metadata section (like Chart.yaml)
 */
export interface Metadata {
  name: string;
  version: string;
  description?: string;
}

/**
 * Structured configuration interface for ECS service deployment
 * Follows ECS object hierarchy for better organization
 */
export interface EcsServiceConfig {
  /** Metadata section */
  metadata?: Metadata;
  
  /** Infrastructure configuration */
  infrastructure: Infrastructure;
  
  /** ECS Cluster configuration */
  cluster: Cluster;
  
  /** Task Definition configuration */
  taskDefinition: TaskDefinition;
  
  /** Service configuration */
  service: Service;
  
  /** Load balancer configuration */
  loadBalancer: LoadBalancer;
  
  /** Auto scaling configuration */
  autoScaling?: AutoScaling;
  
  /** IAM configuration */
  iam?: Iam;
  
  /** Service discovery configuration */
  serviceDiscovery?: ServiceDiscovery;
  
  /** Values file path for loading configuration */
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