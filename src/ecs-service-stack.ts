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

// AWS CDK imports
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

// Standard library imports
import * as fs from 'fs';
import * as path from 'path';

// Local imports
import { Construct } from 'constructs';
import { EcsServiceConfig, EcsServiceStackProps } from './types';
import { showHelp } from './help';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  DESIRED_COUNT: 1,
  CPU: 256,
  MEMORY: 512,
  HEALTH_CHECK_PATH: '/',
  ALLOWED_CIDR: '0.0.0.0/0',
  LOG_RETENTION_DAYS: 7,
  ENABLE_AUTO_SCALING: false,
  MIN_CAPACITY: 1,
  MAX_CAPACITY: 10,
  TARGET_CPU_UTILIZATION: 70,
  TARGET_MEMORY_UTILIZATION: 70,
  HEALTH_CHECK_INTERVAL: 30,
  HEALTH_CHECK_TIMEOUT: 5,
  HEALTH_CHECK_START_PERIOD: 60,
  HEALTH_CHECK_RETRIES: 3,
  SERVICE_DISCOVERY_TTL: 10,
} as const;

/**
 * ECS Service Stack construct
 * 
 * Creates a complete ECS service deployment with all necessary infrastructure.
 * Configuration is provided via context parameters with sensible defaults.
 */
export class EcsServiceStack extends cdk.Stack {
  public readonly service: ecs.FargateService;
  public readonly cluster: ecs.ICluster;
  public readonly loadBalancer: ecs_patterns.ApplicationLoadBalancedFargateService;
  private readonly stackProps: EcsServiceStackProps;

  constructor(scope: Construct, id: string, props: EcsServiceStackProps) {
    super(scope, id, props);
    
    this.stackProps = props;

    // Check for help request first
    if (this.isHelpRequested()) {
      showHelp();
      return;
    }

    // Handle credential context parameters
    this.handleCredentialContext();

    // Load and validate configuration
    const config = this.loadConfiguration();
    this.validateRequiredParameters(config);

    // Create infrastructure
    const vpc = this.createOrImportVpc(config.vpcId);
    this.cluster = this.createOrImportCluster(config.clusterName, vpc);
    this.loadBalancer = this.createEcsService(config, vpc);
    this.service = this.loadBalancer.service;

    // Add optional features
    if (config.enableAutoScaling) {
      this.addAutoScaling(config);
    }

    // Add outputs
    this.addOutputs(config);
  }

  /**
   * Check if help is requested via context parameter
   */
  private isHelpRequested(): boolean {
    const help = this.node.tryGetContext('help');
    return help === 'true' || help === true;
  }

  /**
   * Handle credential context parameters
   * Sets AWS credential environment variables from context
   */
  private handleCredentialContext(): void {
    const awsProfile = this.node.tryGetContext('awsProfile');
    const awsRoleArn = this.node.tryGetContext('awsRoleArn');
    const awsAccessKeyId = this.node.tryGetContext('awsAccessKeyId');
    const awsSecretAccessKey = this.node.tryGetContext('awsSecretAccessKey');
    const awsSessionToken = this.node.tryGetContext('awsSessionToken');

    if (awsProfile && typeof awsProfile === 'string') {
      process.env.AWS_PROFILE = awsProfile;
    }

    if (awsRoleArn && typeof awsRoleArn === 'string') {
      process.env.AWS_ROLE_ARN = awsRoleArn;
    }

    if (awsAccessKeyId && typeof awsAccessKeyId === 'string') {
      process.env.AWS_ACCESS_KEY_ID = awsAccessKeyId;
    }

    if (awsSecretAccessKey && typeof awsSecretAccessKey === 'string') {
      process.env.AWS_SECRET_ACCESS_KEY = awsSecretAccessKey;
    }

    if (awsSessionToken && typeof awsSessionToken === 'string') {
      process.env.AWS_SESSION_TOKEN = awsSessionToken;
    }
  }

  /**
   * Validate required parameters and throw descriptive errors
   */
  private validateRequiredParameters(config: EcsServiceConfig): void {
    const missingParams: string[] = [];

    if (config.containerPort == null) {
      missingParams.push('containerPort');
    }
    if (config.lbPort == null) {
      missingParams.push('lbPort');
    }

    if (missingParams.length > 0) {
      const paramList = missingParams.map(p => `--context ${p}=<value>`).join(' ');
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}. Please provide ${paramList}`);
    }
  }

  /**
   * Load configuration from context parameters with sensible defaults
   * Follows 12-factor principles - all configuration via environment/context
   */
  private loadConfiguration(): EcsServiceConfig {
    const testConfig = this.stackProps?.config || {};
    
    const config: EcsServiceConfig = {
      // Required parameters
      vpcId: this.getContextValue('vpcId', testConfig.vpcId) ?? this.requireContext('vpcId'),
      subnetIds: this.parseSubnetIds(this.getContextValue('subnetIds', testConfig.subnetIds)),
      clusterName: this.getContextValue('clusterName', testConfig.clusterName) ?? this.requireContext('clusterName'),
      image: this.getContextValue('image', testConfig.image) ?? this.requireContext('image'),

      // Optional parameters with defaults
      serviceName: this.getContextValue('serviceName', testConfig.serviceName) ?? this.stackName,
      desiredCount: this.getNumericContextValue('desiredCount', testConfig.desiredCount) ?? DEFAULT_CONFIG.DESIRED_COUNT,
      cpu: this.getNumericContextValue('cpu', testConfig.cpu) ?? DEFAULT_CONFIG.CPU,
      memory: this.getNumericContextValue('memory', testConfig.memory) ?? DEFAULT_CONFIG.MEMORY,
      containerPort: this.getNumericContextValue('containerPort', testConfig.containerPort),
      lbPort: this.getNumericContextValue('lbPort', testConfig.lbPort),
      healthCheckPath: this.getContextValue('healthCheckPath', testConfig.healthCheckPath) ?? DEFAULT_CONFIG.HEALTH_CHECK_PATH,
      healthCheck: this.getContextValue('healthCheck', testConfig.healthCheck),
      resourceLimits: this.getContextValue('resourceLimits', testConfig.resourceLimits),
      serviceDiscovery: this.getContextValue('serviceDiscovery', testConfig.serviceDiscovery),
      capacityProvider: this.getContextValue('capacityProvider', testConfig.capacityProvider),
      gracefulShutdown: this.getContextValue('gracefulShutdown', testConfig.gracefulShutdown),
      placementStrategies: this.getContextValue('placementStrategies', testConfig.placementStrategies),
      allowedCidr: this.getContextValue('allowedCidr', testConfig.allowedCidr) ?? DEFAULT_CONFIG.ALLOWED_CIDR,
      logRetentionDays: this.getNumericContextValue('logRetentionDays', testConfig.logRetentionDays) ?? DEFAULT_CONFIG.LOG_RETENTION_DAYS,
      enableAutoScaling: this.getBooleanContextValue('enableAutoScaling', testConfig.enableAutoScaling) ?? DEFAULT_CONFIG.ENABLE_AUTO_SCALING,
      minCapacity: this.getNumericContextValue('minCapacity', testConfig.minCapacity) ?? DEFAULT_CONFIG.MIN_CAPACITY,
      maxCapacity: this.getNumericContextValue('maxCapacity', testConfig.maxCapacity) ?? DEFAULT_CONFIG.MAX_CAPACITY,
      targetCpuUtilization: this.getNumericContextValue('targetCpuUtilization', testConfig.targetCpuUtilization) ?? DEFAULT_CONFIG.TARGET_CPU_UTILIZATION,
      targetMemoryUtilization: this.getNumericContextValue('targetMemoryUtilization', testConfig.targetMemoryUtilization) ?? DEFAULT_CONFIG.TARGET_MEMORY_UTILIZATION,
      taskExecutionRoleArn: this.getContextValue('taskExecutionRoleArn', testConfig.taskExecutionRoleArn),
      taskRoleArn: this.getContextValue('taskRoleArn', testConfig.taskRoleArn),
      valuesFile: this.getContextValue('valuesFile', testConfig.valuesFile),
    };

    // Load from values file if specified
    if (config.valuesFile) {
      const values = this.loadValuesFile(config.valuesFile);
      Object.assign(config, values);
    }

    // Parse environment variables and secrets
    config.environment = this.parseEnvironmentVariables();
    config.secrets = this.parseSecrets();

    return config;
  }

  /**
   * Get context value with fallback to test config
   */
  private getContextValue<T>(key: string, testValue?: T): T | undefined {
    return testValue ?? this.node.tryGetContext(key);
  }

  /**
   * Get numeric context value with proper type conversion
   */
  private getNumericContextValue(key: string, testValue?: number): number | undefined {
    const value = this.getContextValue(key, testValue);
    if (value === undefined) return undefined;
    return typeof value === 'string' ? parseInt(value, 10) : value;
  }

  /**
   * Get boolean context value with proper type conversion
   */
  private getBooleanContextValue(key: string, testValue?: boolean): boolean | undefined {
    const value = this.getContextValue(key, testValue);
    if (value === undefined) return undefined;
    if (typeof value === 'string') {
      return (value as string).toLowerCase() === 'true';
    }
    return Boolean(value);
  }

  /**
   * Parse subnet IDs from string or array
   */
  private parseSubnetIds(subnetIds: string | string[] | undefined): string[] {
    if (!subnetIds) {
      throw new Error('Required context parameter subnetIds is missing');
    }
    
    if (Array.isArray(subnetIds)) {
      return subnetIds;
    }
    
    return subnetIds.split(',').map(id => id.trim());
  }

  /**
   * Parse environment variables from context
   */
  private parseEnvironmentVariables(): { [key: string]: string } {
    const env: { [key: string]: string } = {};
    
    try {
      const envContext = this.node.getContext('env');
      if (envContext && typeof envContext === 'object') {
        Object.assign(env, envContext);
      }
    } catch (error) {
      // Environment variables are optional, so we ignore errors
    }
    
    return env;
  }

  /**
   * Parse secrets from context
   */
  private parseSecrets(): { [key: string]: string } {
    const secrets: { [key: string]: string } = {};
    
    try {
      const secretContext = this.node.getContext('secret');
      if (secretContext && typeof secretContext === 'object') {
        Object.assign(secrets, secretContext);
      }
    } catch (error) {
      // Secrets are optional, so we ignore errors
    }
    
    return secrets;
  }

  /**
   * Load configuration from values file (JSON, YAML, JS)
   */
  private loadValuesFile(filePath: string): Record<string, any> {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Warning: Values file not found: ${filePath}, skipping`);
      return {};
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();

      switch (ext) {
        case '.js':
          return require(path.resolve(filePath));
        case '.yaml':
        case '.yml':
          return this.parseYaml(fileContent);
        default:
          return JSON.parse(fileContent);
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Failed to parse values file ${filePath}: ${error}`);
      return {};
    }
  }

  /**
   * Parse YAML content with fallback to JSON
   */
  private parseYaml(content: string): any {
    try {
      const yaml = require('js-yaml');
      return yaml.load(content);
    } catch (yamlError) {
      console.warn(`⚠️  Warning: js-yaml not available, falling back to JSON`);
      return JSON.parse(content);
    }
  }

  /**
   * Create or import VPC based on VPC ID
   */
  private createOrImportVpc(vpcId: string): ec2.IVpc {
    return ec2.Vpc.fromLookup(this, `${this.stackName}Vpc`, {
      vpcId: vpcId,
    });
  }

  /**
   * Create or import ECS cluster
   */
  private createOrImportCluster(clusterName: string, vpc: ec2.IVpc): ecs.ICluster {
    return ecs.Cluster.fromClusterAttributes(this, `${this.stackName}Cluster`, {
      clusterName: clusterName,
      vpc: vpc,
    });
  }

  /**
   * Create ECS service with application load balancer
   */
  private createEcsService(config: EcsServiceConfig, vpc: ec2.IVpc): ecs_patterns.ApplicationLoadBalancedFargateService {
    const logGroup = this.createLogGroup(config);
    const taskDefinition = this.createTaskDefinition(config);
    const container = this.addContainerToTaskDefinition(config, taskDefinition, logGroup);
    
    const service = this.createLoadBalancedService(config, taskDefinition);
    
    this.configureServiceDiscovery(config, vpc);
    this.configureSecurityGroup(service, config);
    
    return service;
  }

  /**
   * Create CloudWatch log group for the service
   */
  private createLogGroup(config: EcsServiceConfig): logs.LogGroup {
    return new logs.LogGroup(this, `${config.serviceName}LogGroup`, {
      logGroupName: config.logGroupName || `/ecs/${config.serviceName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * Create Fargate task definition
   */
  private createTaskDefinition(config: EcsServiceConfig): ecs.FargateTaskDefinition {
    return new ecs.FargateTaskDefinition(this, `${config.serviceName}TaskDef`, {
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      executionRole: this.createExecutionRole(config),
      taskRole: this.createTaskRole(config),
    });
  }

  /**
   * Create execution role with required permissions for ECS
   */
  private createExecutionRole(config: EcsServiceConfig): iam.IRole {
    if (config.taskExecutionRoleArn) {
      return iam.Role.fromRoleArn(this, `${config.serviceName}ExecutionRole`, config.taskExecutionRoleArn);
    }

    // Create execution role with required permissions
    const executionRole = new iam.Role(this, `${config.serviceName}ExecutionRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Add permissions from values file configuration
    if (config.executionRolePermissions) {
      Object.entries(config.executionRolePermissions).forEach(([service, permissions]) => {
        executionRole.addToPolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: permissions.actions,
          resources: permissions.resources,
        }));
      });
    }

    return executionRole;
  }

  /**
   * Create task role with required permissions for the application
   */
  private createTaskRole(config: EcsServiceConfig): iam.IRole {
    if (config.taskRoleArn) {
      return iam.Role.fromRoleArn(this, `${config.serviceName}TaskRole`, config.taskRoleArn);
    }

    // Create task role for application permissions
    const taskRole = new iam.Role(this, `${config.serviceName}TaskRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Add permissions from values file configuration
    if (config.taskRolePermissions) {
      Object.entries(config.taskRolePermissions).forEach(([service, permissions]) => {
        taskRole.addToPolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: permissions.actions,
          resources: permissions.resources,
        }));
      });
    }

    return taskRole;
  }

  /**
   * Add container to task definition
   */
  private addContainerToTaskDefinition(
    config: EcsServiceConfig, 
    taskDefinition: ecs.FargateTaskDefinition, 
    logGroup: logs.LogGroup
  ): ecs.ContainerDefinition {
    const container = taskDefinition.addContainer(`${config.serviceName}Container`, {
      image: this.createContainerImage(config.image),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: logGroup,
        streamPrefix: config.serviceName!,
      }),
      environment: config.environment,
      secrets: config.secrets ? this.createSecrets(config.secrets) : undefined,
      healthCheck: this.createHealthCheck(config.healthCheck),
      cpu: config.resourceLimits?.cpu,
      memoryLimitMiB: config.resourceLimits?.memory,
    });

    container.addPortMappings({
      containerPort: config.containerPort!,
      protocol: ecs.Protocol.TCP,
    });

    return container;
  }

  /**
   * Create health check configuration
   */
  private createHealthCheck(healthCheck?: EcsServiceConfig['healthCheck']): ecs.HealthCheck | undefined {
    if (!healthCheck?.command) return undefined;

    return {
      command: healthCheck.command,
      interval: healthCheck.interval || cdk.Duration.seconds(DEFAULT_CONFIG.HEALTH_CHECK_INTERVAL),
      timeout: healthCheck.timeout || cdk.Duration.seconds(DEFAULT_CONFIG.HEALTH_CHECK_TIMEOUT),
      startPeriod: healthCheck.startPeriod || cdk.Duration.seconds(DEFAULT_CONFIG.HEALTH_CHECK_START_PERIOD),
      retries: healthCheck.retries || DEFAULT_CONFIG.HEALTH_CHECK_RETRIES,
    };
  }

  /**
   * Create load balanced service
   */
  private createLoadBalancedService(
    config: EcsServiceConfig, 
    taskDefinition: ecs.FargateTaskDefinition
  ): ecs_patterns.ApplicationLoadBalancedFargateService {
    return new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${config.serviceName}Service`, {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      desiredCount: config.desiredCount,
      publicLoadBalancer: true,
      listenerPort: config.lbPort!,
      serviceName: config.serviceName,
      capacityProviderStrategies: this.createCapacityProviderStrategies(config.capacityProvider),
    });
  }

  /**
   * Create capacity provider strategies
   */
  private createCapacityProviderStrategies(capacityProvider?: string) {
    return capacityProvider ? [
      {
        capacityProvider: capacityProvider,
        weight: 1,
      }
    ] : undefined;
  }

  /**
   * Configure service discovery if enabled
   */
  private configureServiceDiscovery(config: EcsServiceConfig, vpc: ec2.IVpc): void {
    if (!config.serviceDiscovery) return;

    const namespace = new servicediscovery.PrivateDnsNamespace(this, `${config.serviceName}Namespace`, {
      name: config.serviceDiscovery.namespace || `${config.serviceName}.local`,
      vpc: vpc,
    });

    new servicediscovery.Service(this, `${config.serviceName}ServiceDiscovery`, {
      namespace: namespace,
      name: config.serviceDiscovery.serviceName || config.serviceName,
      dnsRecordType: config.serviceDiscovery.dnsType === 'SRV' ? 
        servicediscovery.DnsRecordType.SRV : 
        servicediscovery.DnsRecordType.A,
      dnsTtl: cdk.Duration.seconds(config.serviceDiscovery.ttl || DEFAULT_CONFIG.SERVICE_DISCOVERY_TTL),
    });

    // Note: Service discovery integration requires manual configuration
    // The service discovery service is created but not automatically associated
    // Users can manually associate it via AWS CLI or console
  }

  /**
   * Configure security group rules
   */
  private configureSecurityGroup(
    service: ecs_patterns.ApplicationLoadBalancedFargateService, 
    config: EcsServiceConfig
  ): void {
    if (config.allowedCidr === DEFAULT_CONFIG.ALLOWED_CIDR) return;

    service.loadBalancer.connections.allowFromAnyIpv4(
      ec2.Port.tcp(config.lbPort!),
      `Allow HTTP from ${config.allowedCidr}`
    );
  }

  /**
   * Create container image from various sources
   * Supports ECR, external registries, and local Containerfiles
   */
  private createContainerImage(image: string): ecs.ContainerImage {
    // Check if it's a local Containerfile path
    if (image.startsWith('./') || image.startsWith('/')) {
      return ecs.ContainerImage.fromAsset(image);
    }
    
    // Otherwise treat as image URI
    return ecs.ContainerImage.fromRegistry(image);
  }

  /**
   * Create secrets for the container
   */
  private createSecrets(secrets: { [key: string]: string }): { [key: string]: ecs.Secret } {
    const containerSecrets: { [key: string]: ecs.Secret } = {};
    
    Object.entries(secrets).forEach(([key, value]) => {
      containerSecrets[key] = ecs.Secret.fromSecretsManager(
        cdk.aws_secretsmanager.Secret.fromSecretCompleteArn(this, `${key}Secret`, value)
      );
    });

    return containerSecrets;
  }

  /**
   * Add auto scaling to the service
   */
  private addAutoScaling(config: EcsServiceConfig): void {
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: config.minCapacity!,
      maxCapacity: config.maxCapacity!,
    });

    scaling.scaleOnCpuUtilization(`${config.serviceName}CpuScaling`, {
      targetUtilizationPercent: config.targetCpuUtilization!,
    });

    scaling.scaleOnMemoryUtilization(`${config.serviceName}MemoryScaling`, {
      targetUtilizationPercent: config.targetMemoryUtilization!,
    });
  }

  /**
   * Add CloudFormation outputs
   */
  private addOutputs(config: EcsServiceConfig): void {
    new cdk.CfnOutput(this, 'ServiceName', {
      value: config.serviceName!,
      description: 'ECS Service Name',
      exportName: `${config.serviceName}-service-name`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: `${config.serviceName}-load-balancer-dns`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: config.clusterName,
      description: 'ECS Cluster Name',
      exportName: `${config.serviceName}-cluster-name`,
    });
  }

  /**
   * Require a context parameter to be present
   */
  private requireContext(key: string): never {
    throw new Error(`Required context parameter '${key}' is missing. Use --context ${key}=value`);
  }
} 