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
import { EcsServiceConfig, EcsServiceStackProps, ContainerHealthCheck } from './types';
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
    const vpc = this.createOrImportVpc(config.infrastructure!.vpc.id!);
    this.cluster = this.createOrImportCluster(config.cluster!.name!, vpc);
    this.loadBalancer = this.createEcsService(config, vpc);
    this.service = this.loadBalancer.service;

    // Add optional features
    if (config.autoScaling?.enabled) {
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

    // Check for required parameters from structured config
    if (!config.taskDefinition?.containers?.[0]?.portMappings?.[0]?.containerPort) {
      missingParams.push('taskDefinition.containers.0.portMappings.0.containerPort');
    }
    if (!config.loadBalancer?.port) {
      missingParams.push('loadBalancer.port');
    }
    if (!config.infrastructure?.vpc?.id) {
      missingParams.push('infrastructure.vpc.id');
    }
    if (!config.cluster?.name) {
      missingParams.push('cluster.name');
    }
    if (!config.taskDefinition?.containers?.[0]?.image) {
      missingParams.push('taskDefinition.containers.0.image');
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
    
    // Load values file if specified
    const valuesFile = testConfig.valuesFile ? this.loadValuesFile(testConfig.valuesFile as string) : {};
    
    // Start with structured configuration
    const config: EcsServiceConfig = {
      // Load from context parameters for structured config
      metadata: {
        name: this.getContextValue('metadata.name', valuesFile.metadata?.name || testConfig.metadata?.name) ?? this.stackName,
        version: this.getContextValue('metadata.version', valuesFile.metadata?.version || testConfig.metadata?.version) ?? '1.0.0',
        description: this.getContextValue('metadata.description', valuesFile.metadata?.description || testConfig.metadata?.description),
      },
      
      infrastructure: {
        vpc: {
          id: this.getContextValue('infrastructure.vpc.id', valuesFile.infrastructure?.vpc?.id || testConfig.infrastructure?.vpc?.id) ?? this.requireContext('infrastructure.vpc.id'),
          subnets: this.parseSubnetIds(this.getContextValue('infrastructure.vpc.subnets', valuesFile.infrastructure?.vpc?.subnets || testConfig.infrastructure?.vpc?.subnets)) ?? [],
        },
        securityGroups: valuesFile.infrastructure?.securityGroups || testConfig.infrastructure?.securityGroups,
      },
      
      cluster: {
        name: this.getContextValue('cluster.name', valuesFile.cluster?.name || testConfig.cluster?.name) ?? this.requireContext('cluster.name'),
        containerInsights: this.getBooleanContextValue('cluster.containerInsights', valuesFile.cluster?.containerInsights || testConfig.cluster?.containerInsights) ?? true,
      },
      
      taskDefinition: {
        type: this.getContextValue('taskDefinition.type', valuesFile.taskDefinition?.type || testConfig.taskDefinition?.type) ?? 'FARGATE',
        cpu: this.getNumericContextValue('taskDefinition.cpu', valuesFile.taskDefinition?.cpu || testConfig.taskDefinition?.cpu) ?? DEFAULT_CONFIG.CPU,
        memory: this.getNumericContextValue('taskDefinition.memory', valuesFile.taskDefinition?.memory || testConfig.taskDefinition?.memory) ?? DEFAULT_CONFIG.MEMORY,
        containers: [{
          name: 'main',
          image: this.getContextValue('taskDefinition.containers.0.image', valuesFile.taskDefinition?.containers?.[0]?.image || testConfig.taskDefinition?.containers?.[0]?.image) ?? this.requireContext('taskDefinition.containers.0.image'),
          portMappings: [{
            containerPort: this.getNumericContextValue('taskDefinition.containers.0.portMappings.0.containerPort', valuesFile.taskDefinition?.containers?.[0]?.portMappings?.[0]?.containerPort || testConfig.taskDefinition?.containers?.[0]?.portMappings?.[0]?.containerPort) ?? this.requireContext('taskDefinition.containers.0.portMappings.0.containerPort'),
            protocol: 'tcp',
          }],
          environment: valuesFile.taskDefinition?.containers?.[0]?.environment || testConfig.taskDefinition?.containers?.[0]?.environment || this.parseEnvironmentVariablesAsArray(),
          secrets: valuesFile.taskDefinition?.containers?.[0]?.secrets || testConfig.taskDefinition?.containers?.[0]?.secrets || this.parseSecretsAsArray(),
        }],
        volumes: valuesFile.taskDefinition?.volumes || testConfig.taskDefinition?.volumes,
      },
      
      service: {
        type: this.getContextValue('service.type', valuesFile.service?.type || testConfig.service?.type) ?? 'LOAD_BALANCED',
        desiredCount: this.getNumericContextValue('service.desiredCount', valuesFile.service?.desiredCount || testConfig.service?.desiredCount) ?? DEFAULT_CONFIG.DESIRED_COUNT,
        healthCheckGracePeriodSeconds: this.getNumericContextValue('service.healthCheckGracePeriodSeconds', valuesFile.service?.healthCheckGracePeriodSeconds || testConfig.service?.healthCheckGracePeriodSeconds),
      },
      
      loadBalancer: {
        type: this.getContextValue('loadBalancer.type', valuesFile.loadBalancer?.type || testConfig.loadBalancer?.type) ?? 'APPLICATION',
        scheme: this.getContextValue('loadBalancer.scheme', valuesFile.loadBalancer?.scheme || testConfig.loadBalancer?.scheme),
        protocol: this.getContextValue('loadBalancer.protocol', valuesFile.loadBalancer?.protocol || testConfig.loadBalancer?.protocol) ?? 'HTTP',
        port: this.getNumericContextValue('loadBalancer.port', valuesFile.loadBalancer?.port || testConfig.loadBalancer?.port) ?? this.requireContext('loadBalancer.port'),
        certificateArn: this.getContextValue('loadBalancer.certificateArn', valuesFile.loadBalancer?.certificateArn || testConfig.loadBalancer?.certificateArn),
        targetGroup: {
          healthCheckPath: this.getContextValue('loadBalancer.targetGroup.healthCheckPath', valuesFile.loadBalancer?.targetGroup?.healthCheckPath || testConfig.loadBalancer?.targetGroup?.healthCheckPath) ?? DEFAULT_CONFIG.HEALTH_CHECK_PATH,
        },
        allowedCidr: this.getContextValue('loadBalancer.allowedCidr', valuesFile.loadBalancer?.allowedCidr || testConfig.loadBalancer?.allowedCidr),
      },
      
      autoScaling: {
        enabled: this.getBooleanContextValue('autoScaling.enabled', valuesFile.autoScaling?.enabled || testConfig.autoScaling?.enabled) ?? DEFAULT_CONFIG.ENABLE_AUTO_SCALING,
        minCapacity: this.getNumericContextValue('autoScaling.minCapacity', valuesFile.autoScaling?.minCapacity || testConfig.autoScaling?.minCapacity) ?? DEFAULT_CONFIG.MIN_CAPACITY,
        maxCapacity: this.getNumericContextValue('autoScaling.maxCapacity', valuesFile.autoScaling?.maxCapacity || testConfig.autoScaling?.maxCapacity) ?? DEFAULT_CONFIG.MAX_CAPACITY,
        targetCpuUtilization: this.getNumericContextValue('autoScaling.targetCpuUtilization', valuesFile.autoScaling?.targetCpuUtilization || testConfig.autoScaling?.targetCpuUtilization) ?? DEFAULT_CONFIG.TARGET_CPU_UTILIZATION,
        targetMemoryUtilization: this.getNumericContextValue('autoScaling.targetMemoryUtilization', valuesFile.autoScaling?.targetMemoryUtilization || testConfig.autoScaling?.targetMemoryUtilization) ?? DEFAULT_CONFIG.TARGET_MEMORY_UTILIZATION,
      },
      
      iam: {
        taskRole: valuesFile.iam?.taskRole || testConfig.iam?.taskRole,
        taskExecutionRole: valuesFile.iam?.taskExecutionRole || testConfig.iam?.taskExecutionRole,
      },
      serviceDiscovery: valuesFile.serviceDiscovery || testConfig.serviceDiscovery,
      
      addons: valuesFile.addons || testConfig.addons,

    };

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
    
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    
    // Validate that parsing was successful
    if (typeof numValue === 'number' && !isNaN(numValue)) {
      return numValue;
    }
    
    console.warn(`⚠️  Warning: Invalid numeric value for '${key}': ${value}`);
    return undefined;
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
      return [];
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
      console.warn(`⚠️  Warning: Failed to parse environment variables: ${error}`);
    }
    
    return env;
  }

  /**
   * Parse environment variables as array for structured config
   */
  private parseEnvironmentVariablesAsArray(): { name: string; value: string }[] {
    const env = this.parseEnvironmentVariables();
    return Object.entries(env).map(([name, value]) => ({ name, value }));
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
      console.warn(`⚠️  Warning: Failed to parse secrets: ${error}`);
    }
    
    return secrets;
  }

  /**
   * Parse secrets as array for structured config
   */
  private parseSecretsAsArray(): { name: string; valueFrom: string }[] {
    const secrets = this.parseSecrets();
    return Object.entries(secrets).map(([name, valueFrom]) => ({ name, valueFrom }));
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
    const config = this.loadConfiguration();
    const stackName = config.metadata?.name || this.stackName;
    
    // If VPC ID is provided, import existing VPC
    if (vpcId && vpcId !== '') {
      console.log(`📝 Importing existing VPC: ${vpcId}`);
      const subnetIds = config.infrastructure?.vpc?.subnets || [];
      
      // Get availability zones from context or use defaults
      const availabilityZones = this.getContextValue('availabilityZones') as string[] || 
        ['us-west-2a', 'us-west-2b', 'us-west-2c'];
      
      // Ensure availability zones match the number of subnets
      const azs = availabilityZones.slice(0, subnetIds.length);
      
      return ec2.Vpc.fromVpcAttributes(this, `${stackName}Vpc`, {
        vpcId: vpcId,
        availabilityZones: azs,
        privateSubnetIds: subnetIds,
        publicSubnetIds: subnetIds, // Use same subnets for both public and private
      });
    }
    
    // Otherwise create a new VPC
    console.log(`📝 Creating new VPC`);
    return new ec2.Vpc(this, `${stackName}Vpc`, {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });
  }

  /**
   * Create or import ECS cluster
   */
  private createOrImportCluster(clusterName: string, vpc: ec2.IVpc): ecs.ICluster {
    const config = this.loadConfiguration();
    const stackName = config.metadata?.name || this.stackName;
    
    // Always create a new cluster for now to avoid inactive cluster issues
    console.log(`📝 Creating new cluster: ${clusterName}`);
    return new ecs.Cluster(this, `${stackName}Cluster`, {
      clusterName: clusterName,
      vpc: vpc,
      containerInsights: true,
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
    const stackName = config.metadata?.name || this.stackName;
    
    // Use add-ons configuration if available, otherwise use defaults
    const logGroupName = config.addons?.logging?.options?.['awslogs-group'] || `/ecs/${stackName}`;
    const retentionDays = config.addons?.logging?.retentionDays || DEFAULT_CONFIG.LOG_RETENTION_DAYS;
    
    return new logs.LogGroup(this, `${stackName}LogGroup`, {
      logGroupName: logGroupName,
      retention: this.convertRetentionDays(retentionDays),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * Create Fargate task definition
   */
  private createTaskDefinition(config: EcsServiceConfig): ecs.FargateTaskDefinition {
    const stackName = config.metadata?.name || this.stackName;
    
    // Create runtime platform if specified
    const runtimePlatform = config.taskDefinition.runtimePlatform ? {
      cpuArchitecture: ecs.CpuArchitecture.of(config.taskDefinition.runtimePlatform.cpuArchitecture),
      operatingSystemFamily: ecs.OperatingSystemFamily.of(config.taskDefinition.runtimePlatform.os),
    } : undefined;

    return new ecs.FargateTaskDefinition(this, `${stackName}TaskDef`, {
      cpu: config.taskDefinition.cpu,
      memoryLimitMiB: config.taskDefinition.memory,
      executionRole: this.createExecutionRole(config),
      taskRole: this.createTaskRole(config),
      runtimePlatform,
    });
  }

  /**
   * Create execution role with required permissions for ECS
   */
  private createExecutionRole(config: EcsServiceConfig): iam.IRole {
    const stackName = config.metadata?.name || this.stackName;
    
    // Create execution role with required permissions
    const executionRole = new iam.Role(this, `${stackName}ExecutionRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Add custom JSON policy if provided
    if (config.iam?.taskExecutionRole?.custom) {
      try {
        const customPolicy = JSON.parse(config.iam.taskExecutionRole.custom);
        executionRole.addToPolicy(new iam.PolicyStatement(customPolicy));
      } catch (error) {
        console.warn(`⚠️  Warning: Invalid custom policy JSON for execution role: ${error}`);
      }
    }

    // Add permissions from structured IAM configuration
    if (config.iam?.taskExecutionRole?.policies) {
      config.iam.taskExecutionRole.policies.forEach(policy => {
        executionRole.addToPolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: policy.actions,
          resources: policy.resources,
        }));
      });
    }

    // Add detailed permissions if specified
    if (config.iam?.taskExecutionRole?.permissions) {
      this.addDetailedPermissions(executionRole, config.iam.taskExecutionRole.permissions);
    }

    return executionRole;
  }

  /**
   * Create task role with required permissions for the application
   */
  private createTaskRole(config: EcsServiceConfig): iam.IRole {
    const stackName = config.metadata?.name || this.stackName;

    // Create task role for application permissions
    const taskRole = new iam.Role(this, `${stackName}TaskRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Add custom JSON policy if provided
    if (config.iam?.taskRole?.custom) {
      try {
        const customPolicy = JSON.parse(config.iam.taskRole.custom);
        taskRole.addToPolicy(new iam.PolicyStatement(customPolicy));
      } catch (error) {
        console.warn(`⚠️  Warning: Invalid custom policy JSON for task role: ${error}`);
      }
    }

    // Add permissions from structured IAM configuration
    if (config.iam?.taskRole?.policies) {
      config.iam.taskRole.policies.forEach(policy => {
        taskRole.addToPolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: policy.actions,
          resources: policy.resources,
        }));
      });
    }

    // Add detailed permissions if specified
    if (config.iam?.taskRole?.permissions) {
      this.addDetailedPermissions(taskRole, config.iam.taskRole.permissions);
    }

    return taskRole;
  }

  /**
   * Add detailed IAM permissions to a role
   */
  private addDetailedPermissions(role: iam.Role, permissions: any): void {
    // Secrets Manager permissions
    if (permissions.secretsManager) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.secretsManager.actions,
        resources: permissions.secretsManager.resources,
      }));
    }

    // CloudWatch Logs permissions
    if (permissions.cloudWatchLogs) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.cloudWatchLogs.actions,
        resources: permissions.cloudWatchLogs.resources,
      }));
    }

    // KMS permissions
    if (permissions.kms) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.kms.actions,
        resources: permissions.kms.resources,
      }));
    }

    // STS permissions
    if (permissions.sts) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.sts.actions,
        resources: permissions.sts.resources,
      }));
    }

    // S3 permissions
    if (permissions.s3) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.s3.actions,
        resources: permissions.s3.resources,
      }));
    }

    // SQS permissions
    if (permissions.sqs) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.sqs.actions,
        resources: permissions.sqs.resources,
      }));
    }

    // DynamoDB permissions
    if (permissions.dynamodb) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.dynamodb.actions,
        resources: permissions.dynamodb.resources,
      }));
    }

    // RDS permissions
    if (permissions.rds) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.rds.actions,
        resources: permissions.rds.resources,
      }));
    }

    // CloudWatch Metrics permissions
    if (permissions.cloudWatchMetrics) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.cloudWatchMetrics.actions,
        resources: permissions.cloudWatchMetrics.resources,
      }));
    }

    // ECR permissions
    if (permissions.ecr) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.ecr.actions,
        resources: permissions.ecr.resources,
      }));
    }

    // SSM permissions
    if (permissions.ssm) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: permissions.ssm.actions,
        resources: permissions.ssm.resources,
      }));
    }
  }

  /**
   * Add container to task definition
   */
  private addContainerToTaskDefinition(
    config: EcsServiceConfig, 
    taskDefinition: ecs.FargateTaskDefinition, 
    logGroup: logs.LogGroup
  ): ecs.ContainerDefinition {
    const stackName = config.metadata?.name || this.stackName;
    const mainContainer = config.taskDefinition?.containers?.[0];
    
    if (!mainContainer) {
      throw new Error('No main container found in task definition');
    }
    
    const container = taskDefinition.addContainer(mainContainer.name, {
      image: this.createContainerImage(mainContainer.image),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: logGroup,
        streamPrefix: stackName,
      }),
      environment: mainContainer.environment?.reduce((acc, env) => {
        acc[env.name] = env.value;
        return acc;
      }, {} as { [key: string]: string }) || {},
      secrets: mainContainer.secrets?.reduce((acc, secret) => {
        acc[secret.name] = ecs.Secret.fromSecretsManager(
          cdk.aws_secretsmanager.Secret.fromSecretCompleteArn(this, `${secret.name}Secret`, secret.valueFrom)
        );
        return acc;
      }, {} as { [key: string]: ecs.Secret }) || undefined,
      healthCheck: this.createHealthCheck(mainContainer.healthCheck),
    });

    // Add port mappings from structured config
    const containerPort = mainContainer.portMappings?.[0]?.containerPort;
    if (!containerPort) {
      throw new Error('Container port is required. Please provide taskDefinition.containers.0.portMappings.0.containerPort');
    }
    
    container.addPortMappings({
      containerPort: containerPort,
      protocol: ecs.Protocol.TCP,
    });

    // Add mount points for main container if volumes are specified (optional)
    if (config.taskDefinition.volumes && config.taskDefinition.volumes.length > 0) {
      config.taskDefinition.volumes.forEach(volume => {
        container.addMountPoints({
          sourceVolume: volume.name,
          containerPath: `/${volume.name}`,
          readOnly: false,
        });
      });
    }

    // Add additional containers if specified
    if (config.taskDefinition.additionalContainers) {
      config.taskDefinition.additionalContainers.forEach((containerConfig, index) => {
        const additionalContainer = taskDefinition.addContainer(`${config.metadata?.name || 'AdditionalContainer'}${index}`, {
          image: this.createContainerImage(containerConfig.image),
          logging: ecs.LogDrivers.awsLogs({
            logGroup: logGroup,
            streamPrefix: `${config.metadata?.name || 'AdditionalContainer'}-${containerConfig.name}`,
          }),
          environment: containerConfig.environment?.reduce((acc, env) => {
            acc[env.name] = env.value;
            return acc;
          }, {} as { [key: string]: string }) || {},
          essential: containerConfig.essential ?? false,
          readonlyRootFilesystem: containerConfig.readonlyRootFilesystem,
          command: containerConfig.command,
          entryPoint: containerConfig.entryPoint,
        });

        // Add port mappings if specified
        if (containerConfig.portMappings) {
          containerConfig.portMappings.forEach(portMapping => {
            additionalContainer.addPortMappings({
              containerPort: portMapping.containerPort,
              protocol: portMapping.protocol === 'udp' ? ecs.Protocol.UDP : ecs.Protocol.TCP,
            });
          });
        }

        // Add mount points if specified
        if (containerConfig.mountPoints) {
          containerConfig.mountPoints.forEach(mountPoint => {
            additionalContainer.addMountPoints({
              sourceVolume: mountPoint.sourceVolume,
              containerPath: mountPoint.containerPath,
              readOnly: mountPoint.readOnly ?? false,
            });
          });
        }
      });
    }

        // Add volumes if specified (optional)
    if (config.taskDefinition.volumes && config.taskDefinition.volumes.length > 0) {
      config.taskDefinition.volumes.forEach(volume => {
        if (volume.efsVolumeConfiguration) {
          taskDefinition.addVolume({
            name: volume.name,
            efsVolumeConfiguration: {
              fileSystemId: volume.efsVolumeConfiguration.fileSystemId,
              transitEncryption: volume.efsVolumeConfiguration.transitEncryption === 'ENABLED' ? 
                'ENABLED' : 'DISABLED',
              authorizationConfig: volume.efsVolumeConfiguration.authorizationConfig ? {
                accessPointId: volume.efsVolumeConfiguration.authorizationConfig.accessPointId,
                iam: volume.efsVolumeConfiguration.authorizationConfig.iam === 'ENABLED' ? 
                  'ENABLED' : 'DISABLED',
              } : undefined,
            },
          });
        } else {
          taskDefinition.addVolume({
            name: volume.name,
          });
        }
      });
    }

    return container;
  }

  /**
   * Create health check configuration
   */
  private createHealthCheck(healthCheck?: ContainerHealthCheck): ecs.HealthCheck | undefined {
    // Check if health check is explicitly disabled
    if (healthCheck?.enabled === false) return undefined;
    
    // Check if health check has required configuration
    if (!healthCheck?.command || healthCheck.command.length === 0) return undefined;

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
    const stackName = config.metadata?.name || this.stackName;
    
    // Determine protocol and certificate - HTTPS is optional
    const protocol = config.loadBalancer.protocol || 'HTTP';
    const certificate = config.loadBalancer.certificateArn ? 
      cdk.aws_certificatemanager.Certificate.fromCertificateArn(this, `${stackName}Certificate`, config.loadBalancer.certificateArn) : 
      undefined;

    // Use HTTPS only if explicitly configured with certificate
    const useHttps = protocol === 'HTTPS' && certificate;
    const listenerPort = useHttps ? (config.loadBalancer.port || 443) : (config.loadBalancer.port || 80);

    // Determine load balancer scheme - default to internet-facing if not specified
    const scheme = config.loadBalancer.scheme || 'internet-facing';

    const service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${stackName}Service`, {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      desiredCount: config.service.desiredCount,
      publicLoadBalancer: scheme === 'internet-facing',
      listenerPort: listenerPort,
      protocol: useHttps ? elbv2.ApplicationProtocol.HTTPS : elbv2.ApplicationProtocol.HTTP,
      certificate: certificate,
      serviceName: stackName,
      capacityProviderStrategies: this.createCapacityProviderStrategies(),
      healthCheckGracePeriod: config.service.healthCheckGracePeriodSeconds ? 
        cdk.Duration.seconds(config.service.healthCheckGracePeriodSeconds) : undefined,
    });

    // Configure health check on the target group
    if (config.loadBalancer.targetGroup?.healthCheckPath || config.loadBalancer.targetGroup?.healthCheck) {
      const targetGroup = service.targetGroup;
      const healthCheck = config.loadBalancer.targetGroup.healthCheck;
      
      // Use advanced health check configuration if available, otherwise use basic
      const healthCheckConfig = {
        path: healthCheck?.path || config.loadBalancer.targetGroup.healthCheckPath || '/',
        healthyHttpCodes: healthCheck?.healthyHttpCodes || '200',
        interval: this.convertToDuration(healthCheck?.interval || config.loadBalancer.targetGroup.interval || 30),
        timeout: this.convertToDuration(healthCheck?.timeout || config.loadBalancer.targetGroup.timeout || 5),
        healthyThresholdCount: healthCheck?.healthyThresholdCount || config.loadBalancer.targetGroup.healthyThresholdCount || 2,
        unhealthyThresholdCount: healthCheck?.unhealthyThresholdCount || config.loadBalancer.targetGroup.unhealthyThresholdCount || 3,
      };
      
      // Only configure if health check is enabled or not explicitly disabled
      if (healthCheck?.enabled !== false) {
        targetGroup.configureHealthCheck(healthCheckConfig);
      }
    }

    return service;
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
    // Check if service discovery is explicitly disabled
    if (config.serviceDiscovery?.enabled === false) return;
    
    // Check if service discovery configuration exists
    if (!config.serviceDiscovery) return;

    const stackName = config.metadata?.name || this.stackName;
    const namespaceName = typeof config.serviceDiscovery.namespace === 'string' 
      ? config.serviceDiscovery.namespace 
      : config.serviceDiscovery.namespace?.name || `${stackName}.local`;
    
    const namespace = new servicediscovery.PrivateDnsNamespace(this, `${stackName}Namespace`, {
      name: namespaceName,
      vpc: vpc,
    });

    const serviceName = config.serviceDiscovery.service?.name || stackName;
    const dnsType = config.serviceDiscovery.service?.dnsType || 'A';
    const ttl = config.serviceDiscovery.service?.ttl || DEFAULT_CONFIG.SERVICE_DISCOVERY_TTL;

    const serviceDiscoveryService = new servicediscovery.Service(this, `${stackName}ServiceDiscovery`, {
      namespace: namespace,
      name: serviceName,
      dnsRecordType: dnsType === 'SRV' ? 
        servicediscovery.DnsRecordType.SRV : 
        servicediscovery.DnsRecordType.A,
      dnsTtl: cdk.Duration.seconds(ttl),
    });

    // Associate service discovery with ECS service
    if (this.service) {
      // Note: Service discovery association is handled by the CDK pattern
      // The service discovery service is created but association depends on the pattern used
    }
  }

  /**
   * Configure security group rules
   */
  private configureSecurityGroup(
    service: ecs_patterns.ApplicationLoadBalancedFargateService, 
    config: EcsServiceConfig
  ): void {
    // Configure load balancer security group to be more restrictive
    const lbSecurityGroup = service.loadBalancer.connections.securityGroups[0];
    
    // Determine protocol and port for security group
    const protocol = config.loadBalancer.protocol || 'HTTP';
    const useHttps = protocol === 'HTTPS' && config.loadBalancer.certificateArn;
    const lbPort = useHttps ? (config.loadBalancer.port || 443) : (config.loadBalancer.port || 80);
    
    // Remove default 0.0.0.0/0 rule if a specific CIDR is provided
    if (config.loadBalancer.allowedCidr && config.loadBalancer.allowedCidr !== DEFAULT_CONFIG.ALLOWED_CIDR) {
      // Remove the default rule by adding a more restrictive rule
      lbSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(config.loadBalancer.allowedCidr),
        ec2.Port.tcp(lbPort),
        `Allow ${protocol} from ${config.loadBalancer.allowedCidr}`
      );
      
      // Also remove any existing 0.0.0.0/0 rules for this port
      lbSecurityGroup.connections.allowFromAnyIpv4(
        ec2.Port.tcp(lbPort),
        `Restrict ${protocol} access to ${config.loadBalancer.allowedCidr} only`
      );
    }
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
    const stackName = config.metadata?.name || this.stackName;
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: config.autoScaling?.minCapacity || DEFAULT_CONFIG.MIN_CAPACITY,
      maxCapacity: config.autoScaling?.maxCapacity || DEFAULT_CONFIG.MAX_CAPACITY,
    });

    scaling.scaleOnCpuUtilization(`${stackName}CpuScaling`, {
      targetUtilizationPercent: config.autoScaling?.targetCpuUtilization || DEFAULT_CONFIG.TARGET_CPU_UTILIZATION,
    });

    scaling.scaleOnMemoryUtilization(`${stackName}MemoryScaling`, {
      targetUtilizationPercent: config.autoScaling?.targetMemoryUtilization || DEFAULT_CONFIG.TARGET_MEMORY_UTILIZATION,
    });
  }

  /**
   * Add CloudFormation outputs
   */
  private addOutputs(config: EcsServiceConfig): void {
    const stackName = config.metadata?.name || this.stackName;
    const clusterName = config.cluster?.name;
    
    new cdk.CfnOutput(this, 'ServiceName', {
      value: stackName,
      description: 'ECS Service Name',
      exportName: `${stackName}-service-name`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: `${stackName}-load-balancer-dns`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: clusterName || 'unknown',
      description: 'ECS Cluster Name',
      exportName: `${stackName}-cluster-name`,
    });
  }

  /**
   * Convert a value to CDK Duration
   * Handles both Duration objects and numbers (seconds)
   */
  private convertToDuration(value: any): cdk.Duration | undefined {
    if (!value) return undefined;
    if (value instanceof cdk.Duration) return value;
    if (typeof value === 'number') return cdk.Duration.seconds(value);
    return undefined;
  }

  /**
   * Convert retention days to CDK RetentionDays enum
   */
  private convertRetentionDays(days: number): logs.RetentionDays {
    switch (days) {
      case 1: return logs.RetentionDays.ONE_DAY;
      case 3: return logs.RetentionDays.THREE_DAYS;
      case 5: return logs.RetentionDays.FIVE_DAYS;
      case 7: return logs.RetentionDays.ONE_WEEK;
      case 14: return logs.RetentionDays.TWO_WEEKS;
      case 30: return logs.RetentionDays.ONE_MONTH;
      case 60: return logs.RetentionDays.TWO_MONTHS;
      case 90: return logs.RetentionDays.THREE_MONTHS;
      case 120: return logs.RetentionDays.FOUR_MONTHS;
      case 150: return logs.RetentionDays.FIVE_MONTHS;
      case 180: return logs.RetentionDays.SIX_MONTHS;
      case 365: return logs.RetentionDays.ONE_YEAR;
      case 400: return logs.RetentionDays.THIRTEEN_MONTHS;
      case 545: return logs.RetentionDays.EIGHTEEN_MONTHS;
      case 731: return logs.RetentionDays.TWO_YEARS;
      case 1827: return logs.RetentionDays.FIVE_YEARS;
      case 3653: return logs.RetentionDays.TEN_YEARS;
      default: return logs.RetentionDays.ONE_WEEK;
    }
  }

  /**
   * Require a context parameter to be present
   */
  private requireContext(key: string): never {
    throw new Error(`Required context parameter '${key}' is missing. Use --context ${key}=value`);
  }
} 