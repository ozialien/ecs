/**
 * Structured types for Helm-like ECS configuration
 * Maps to ECS/AWS resource hierarchies following the design pattern
 */

import * as cdk from 'aws-cdk-lib';

/**
 * Metadata section (like Chart.yaml)
 */
export interface Metadata {
  name: string;
  version: string;
  description?: string;
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
 * Compute configuration
 */
export interface Compute {
  type: 'FARGATE' | 'EC2';
  cpu: number;
  memory: number;
  runtimePlatform?: {
    cpuArchitecture: 'X86_64' | 'ARM64';
    os: 'LINUX' | 'WINDOWS_SERVER_2019_CORE' | 'WINDOWS_SERVER_2019_FULL' | 'WINDOWS_SERVER_2022_CORE' | 'WINDOWS_SERVER_2022_FULL';
  };
}

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
  command?: string[];
  interval?: number;
  timeout?: number;
  startPeriod?: number;
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
  clusterName: string;
  desiredCount: number;
  loadBalancer?: LoadBalancer;
  deployment?: Deployment;
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
 * Logging configuration
 */
export interface Logging {
  driver: 'awslogs' | 'fluentd' | 'gelf' | 'journald' | 'json-file' | 'logentries' | 'splunk' | 'syslog';
  options?: { [key: string]: string };
  retentionDays?: number;
}

/**
 * Monitoring configuration
 */
export interface Monitoring {
  enableCloudWatchAlarms?: boolean;
  enableXRay?: boolean;
}

/**
 * EFS configuration
 */
export interface Efs {
  enabled?: boolean;
  fileSystemId?: string;
  accessPointId?: string;
  transitEncryption?: 'ENABLED' | 'DISABLED';
  iamAuthorization?: 'ENABLED' | 'DISABLED';
}

/**
 * Cross-account configuration
 */
export interface CrossAccount {
  enabled?: boolean;
  accounts?: {
    accountId: string;
    roleName: string;
    description?: string;
  }[];
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
}

/**
 * JNLP configuration
 */
export interface Jnlp {
  enabled?: boolean;
  port?: number;
  protocol?: 'tcp' | 'udp';
}

/**
 * Add-ons configuration
 */
export interface Addons {
  logging?: Logging;
  monitoring?: Monitoring;
  efs?: Efs;
  crossAccount?: CrossAccount;
  autoScaling?: AutoScaling;
  jnlp?: Jnlp;
}

/**
 * Complete structured configuration
 */
export interface StructuredEcsConfig {
  metadata?: Metadata;
  infrastructure?: Infrastructure;
  compute?: Compute;
  containers?: Container[];
  volumes?: Volume[];
  service?: Service;
  iam?: Iam;
  serviceDiscovery?: ServiceDiscovery;
  addons?: Addons;
}

/**
 * Legacy flat configuration (for backward compatibility)
 */
export interface LegacyEcsConfig {
  vpcId?: string;
  subnetIds?: string | string[];
  securityGroupIds?: string | string[];
  clusterName?: string;
  image?: string;
  stackName?: string;
  desiredCount?: number;
  cpu?: number;
  memory?: number;
  containerPort?: number;
  lbPort?: number;
  healthCheckPath?: string;
  publicLoadBalancer?: boolean;
  lbProtocol?: 'HTTP' | 'HTTPS';
  certificateArn?: string;
  environment?: { [key: string]: string };
  secrets?: { [key: string]: string };
  additionalContainers?: any[];
  volumes?: any[];
  taskRolePermissions?: any;
  taskExecutionRolePermissions?: any;
  serviceDiscovery?: any;
  logRetentionDays?: number;
  enableAutoScaling?: boolean;
  minCapacity?: number;
  maxCapacity?: number;
  targetCpuUtilization?: number;
  targetMemoryUtilization?: number;
  healthCheckGracePeriodSeconds?: number;
  deploymentConfiguration?: any;
  loadBalancerHealthCheck?: any;
  healthCheck?: any;
  allowedCidr?: string;
  logGroupName?: string;
  taskExecutionRoleArn?: string;
  taskRoleArn?: string;
  valuesFile?: string;
  resourceLimits?: any;
  capacityProvider?: 'FARGATE' | 'FARGATE_SPOT';
  gracefulShutdown?: any;
  placementStrategies?: any[];
  registryDomain?: string;
  repositoryName?: string;
  tag?: string;
} 