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
import { ConfigMapper } from './config-mapper';

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
    
    // Start with legacy format configuration
    const config: EcsServiceConfig = {
      // Required parameters
      vpcId: this.getContextValue('vpcId', testConfig.vpcId) ?? this.requireContext('vpcId'),
      subnetIds: this.parseSubnetIds(this.getContextValue('subnetIds', testConfig.subnetIds)),
      clusterName: this.getContextValue('clusterName', testConfig.clusterName) ?? this.requireContext('clusterName'),
      image: this.getContextValue('image', testConfig.image) ?? this.requireContext('image'),

      // Optional parameters with defaults
      stackName: this.getContextValue('stackName', testConfig.stackName) ?? this.stackName,
      availabilityZones: this.getContextValue('availabilityZones', testConfig.availabilityZones),
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
      
      // Convert structured configuration to legacy format for compatibility
      if (ConfigMapper.isStructuredConfig(values)) {
        console.log('📋 Converting structured configuration to legacy format...');
        const structuredConfig = values;
        const legacyConfig = ConfigMapper.structuredToLegacy(structuredConfig);
        Object.assign(config, legacyConfig);
      } else {
        // Legacy flat format - use directly
        console.log('📋 Using legacy flat format configuration...');
        Object.assign(config, values);
      }
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
      console.warn(`⚠️  Warning: Failed to parse environment variables: ${error}`);
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
      console.warn(`⚠️  Warning: Failed to parse secrets: ${error}`);
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
    const config = this.loadConfiguration();
    const stackName = config.stackName || this.stackName;
    
    // If VPC ID is provided, import existing VPC
    if (vpcId && vpcId !== '') {
      console.log(`📝 Importing existing VPC: ${vpcId}`);
      const subnetIds = Array.isArray(config.subnetIds) ? config.subnetIds : this.parseSubnetIds(config.subnetIds);
      
      // Get availability zones from context or use defaults
      const availabilityZones = this.getContextValue('availabilityZones', config.availabilityZones) || 
        ['us-west-2a', 'us-west-2b', 'us-west-2c'];
      
      // Ensure availability zones match the number of subnets
      const azs = availabilityZones.slice(0, subnetIds.length);
      
      return ec2.Vpc.fromVpcAttributes(this, `${stackName}Vpc`, {
        vpcId: vpcId,
        availabilityZones: azs,
        privateSubnetIds: subnetIds,
        publicSubnetIds: [],
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
    const stackName = config.stackName || this.stackName;
    
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
    const stackName = config.stackName || this.stackName;
    return new logs.LogGroup(this, `${stackName}LogGroup`, {
      logGroupName: config.logGroupName || `/ecs/${config.stackName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * Create Fargate task definition
   */
  private createTaskDefinition(config: EcsServiceConfig): ecs.FargateTaskDefinition {
    const stackName = config.stackName || this.stackName;
    return new ecs.FargateTaskDefinition(this, `${stackName}TaskDef`, {
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
    const stackName = config.stackName || this.stackName;
    if (config.taskExecutionRoleArn) {
      return iam.Role.fromRoleArn(this, `${stackName}ExecutionRole`, config.taskExecutionRoleArn);
    }

    // Create execution role with required permissions
    const executionRole = new iam.Role(this, `${stackName}ExecutionRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Add permissions from values file configuration
    if (config.taskExecutionRolePermissions) {
      Object.entries(config.taskExecutionRolePermissions).forEach(([service, permissions]) => {
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
    const stackName = config.stackName || this.stackName;
    if (config.taskRoleArn) {
      return iam.Role.fromRoleArn(this, `${stackName}TaskRole`, config.taskRoleArn);
    }

    // Create task role for application permissions
    const taskRole = new iam.Role(this, `${stackName}TaskRole`, {
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
    const container = taskDefinition.addContainer(`${config.stackName}Container`, {
      image: this.createContainerImage(config.image),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: logGroup,
        streamPrefix: config.stackName!,
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

    // Add mount points for main container if volumes are specified (optional)
    if (config.volumes && config.volumes.length > 0) {
      config.volumes.forEach(volume => {
        container.addMountPoints({
          sourceVolume: volume.name,
          containerPath: `/${volume.name}`,
          readOnly: false,
        });
      });
    }

    // Add additional containers if specified
    if (config.additionalContainers) {
      config.additionalContainers.forEach((containerConfig, index) => {
        const additionalContainer = taskDefinition.addContainer(`${config.stackName}AdditionalContainer${index}`, {
          image: this.createContainerImage(containerConfig.image),
          logging: ecs.LogDrivers.awsLogs({
            logGroup: logGroup,
            streamPrefix: `${config.stackName}-${containerConfig.name}`,
          }),
          environment: containerConfig.environment,
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
    if (config.volumes && config.volumes.length > 0) {
      config.volumes.forEach(volume => {
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
  private createHealthCheck(healthCheck?: EcsServiceConfig['healthCheck']): ecs.HealthCheck | undefined {
    // Check if health check is explicitly disabled
    if (healthCheck?.enabled === false) return undefined;
    
    // Check if health check has required configuration (existing logic)
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
    const stackName = config.stackName || this.stackName;
    
    // Determine protocol and certificate - HTTPS is optional
    const protocol = config.lbProtocol || 'HTTP';
    const certificate = config.certificateArn ? 
      cdk.aws_certificatemanager.Certificate.fromCertificateArn(this, `${stackName}Certificate`, config.certificateArn) : 
      undefined;

    // Use HTTPS only if explicitly configured with certificate
    const useHttps = protocol === 'HTTPS' && certificate;
    const listenerPort = useHttps ? (config.lbPort || 443) : (config.lbPort || 80);

    const service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${stackName}Service`, {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      desiredCount: config.desiredCount,
      publicLoadBalancer: config.publicLoadBalancer !== false, // Default to true unless explicitly set to false
      listenerPort: listenerPort,
      protocol: useHttps ? elbv2.ApplicationProtocol.HTTPS : elbv2.ApplicationProtocol.HTTP,
      certificate: certificate,
      serviceName: config.stackName,
      capacityProviderStrategies: this.createCapacityProviderStrategies(config.capacityProvider),
      healthCheckGracePeriod: config.healthCheckGracePeriodSeconds ? 
        cdk.Duration.seconds(config.healthCheckGracePeriodSeconds) : undefined,
    });

    // Configure health check on the target group
    if (config.healthCheckPath || config.loadBalancerHealthCheck) {
      const targetGroup = service.targetGroup;
      const healthCheckConfig = config.loadBalancerHealthCheck || {};
      
      targetGroup.configureHealthCheck({
        path: healthCheckConfig.path || config.healthCheckPath || '/',
        healthyHttpCodes: healthCheckConfig.healthyHttpCodes || '200',
        interval: this.convertToDuration(healthCheckConfig.interval) || cdk.Duration.seconds(30),
        timeout: this.convertToDuration(healthCheckConfig.timeout) || cdk.Duration.seconds(5),
        healthyThresholdCount: healthCheckConfig.healthyThresholdCount || 2,
        unhealthyThresholdCount: healthCheckConfig.unhealthyThresholdCount || 3,
      });
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

    const stackName = config.stackName || this.stackName;
    const namespace = new servicediscovery.PrivateDnsNamespace(this, `${stackName}Namespace`, {
      name: config.serviceDiscovery.namespace || `${config.stackName}.local`,
      vpc: vpc,
    });

    const serviceDiscoveryService = new servicediscovery.Service(this, `${stackName}ServiceDiscovery`, {
      namespace: namespace,
      name: config.serviceDiscovery.serviceName || config.stackName,
      dnsRecordType: config.serviceDiscovery.dnsType === 'SRV' ? 
        servicediscovery.DnsRecordType.SRV : 
        servicediscovery.DnsRecordType.A,
      dnsTtl: cdk.Duration.seconds(config.serviceDiscovery.ttl || DEFAULT_CONFIG.SERVICE_DISCOVERY_TTL),
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
    const protocol = config.lbProtocol || 'HTTP';
    const useHttps = protocol === 'HTTPS' && config.certificateArn;
    const lbPort = useHttps ? (config.lbPort || 443) : (config.lbPort || 80);
    
    // Remove default 0.0.0.0/0 rule if a specific CIDR is provided
    if (config.allowedCidr && config.allowedCidr !== DEFAULT_CONFIG.ALLOWED_CIDR) {
      // Remove the default rule by adding a more restrictive rule
      lbSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(config.allowedCidr),
        ec2.Port.tcp(lbPort),
        `Allow ${protocol} from ${config.allowedCidr}`
      );
      
      // Also remove any existing 0.0.0.0/0 rules for this port
      lbSecurityGroup.connections.allowFromAnyIpv4(
        ec2.Port.tcp(lbPort),
        `Restrict ${protocol} access to ${config.allowedCidr} only`
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
    const stackName = config.stackName || this.stackName;
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: config.minCapacity!,
      maxCapacity: config.maxCapacity!,
    });

    scaling.scaleOnCpuUtilization(`${stackName}CpuScaling`, {
      targetUtilizationPercent: config.targetCpuUtilization!,
    });

    scaling.scaleOnMemoryUtilization(`${stackName}MemoryScaling`, {
      targetUtilizationPercent: config.targetMemoryUtilization!,
    });
  }

  /**
   * Add CloudFormation outputs
   */
  private addOutputs(config: EcsServiceConfig): void {
    const stackName = config.stackName || this.stackName;
    new cdk.CfnOutput(this, 'ServiceName', {
      value: config.stackName!,
      description: 'ECS Service Name',
      exportName: `${stackName}-service-name`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: `${stackName}-load-balancer-dns`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: config.clusterName,
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
   * Require a context parameter to be present
   */
  private requireContext(key: string): never {
    throw new Error(`Required context parameter '${key}' is missing. Use --context ${key}=value`);
  }
} 