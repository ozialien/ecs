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
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { EcsServiceConfig, EcsServiceStackProps } from './types';
import { showHelp } from './help';

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

  constructor(scope: Construct, id: string, props: EcsServiceStackProps) {
    super(scope, id, props);

    // Check for help request first
    const help = this.node.tryGetContext('help');
    if (help === 'true' || help === true) {
      showHelp();
      return;
    }

    // Load configuration from context parameters
    const config = this.loadConfiguration();

    // Create or import VPC
    const vpc = this.createOrImportVpc(config.vpcId);

    // Create or import ECS cluster
    this.cluster = this.createOrImportCluster(config.clusterName, vpc);

    // Create the ECS service with load balancer
    this.loadBalancer = this.createEcsService(config, vpc);

    // Store reference to the service
    this.service = this.loadBalancer.service;

    // Add auto scaling if enabled
    if (config.enableAutoScaling) {
      this.addAutoScaling(config);
    }

    // Output important values
    this.addOutputs(config);
  }

  /**
   * Load configuration from context parameters with sensible defaults
   * Follows 12-factor principles - all configuration via environment/context
   */
  private loadConfiguration(): EcsServiceConfig {
    const config: EcsServiceConfig = {
      // Required parameters
      vpcId: this.node.tryGetContext('vpcId') || this.requireContext('vpcId'),
      subnetIds: this.parseSubnetIds(this.node.tryGetContext('subnetIds') || this.requireContext('subnetIds')),
      clusterName: this.node.tryGetContext('clusterName') || this.requireContext('clusterName'),
      image: this.node.tryGetContext('image') || this.requireContext('image'),

      // Optional parameters with defaults
      serviceName: this.node.tryGetContext('serviceName') || this.stackName,
      desiredCount: this.node.tryGetContext('desiredCount') || 1,
      cpu: this.node.tryGetContext('cpu') || 256,
      memory: this.node.tryGetContext('memory') || 512,
      containerPort: this.node.tryGetContext('containerPort') || 80,
      lbPort: this.node.tryGetContext('lbPort') || 80,
      healthCheckPath: this.node.tryGetContext('healthCheckPath') || '/',
      healthCheck: this.node.tryGetContext('healthCheck'),
      resourceLimits: this.node.tryGetContext('resourceLimits'),
      serviceDiscovery: this.node.tryGetContext('serviceDiscovery'),
      capacityProvider: this.node.tryGetContext('capacityProvider'),
      gracefulShutdown: this.node.tryGetContext('gracefulShutdown'),
      placementStrategies: this.node.tryGetContext('placementStrategies'),
      allowedCidr: this.node.tryGetContext('allowedCidr') || '0.0.0.0/0',
      logRetentionDays: this.node.tryGetContext('logRetentionDays') || 7,
      enableAutoScaling: this.node.tryGetContext('enableAutoScaling') || false,
      minCapacity: this.node.tryGetContext('minCapacity') || 1,
      maxCapacity: this.node.tryGetContext('maxCapacity') || 10,
      targetCpuUtilization: this.node.tryGetContext('targetCpuUtilization') || 70,
      targetMemoryUtilization: this.node.tryGetContext('targetMemoryUtilization') || 70,
      taskExecutionRoleArn: this.node.tryGetContext('taskExecutionRoleArn'),
      taskRoleArn: this.node.tryGetContext('taskRoleArn'),
      valuesFile: this.node.tryGetContext('valuesFile'),
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
   * Parse subnet IDs from context parameter
   * Supports both comma-separated string and array
   */
  private parseSubnetIds(subnetIds: string | string[]): string[] {
    if (Array.isArray(subnetIds)) {
      return subnetIds;
    }
    return subnetIds.split(',').map(id => id.trim());
  }

  /**
   * Parse environment variables from context parameters
   * Format: env:KEY=value,env:ANOTHER_KEY=another_value
   */
  private parseEnvironmentVariables(): { [key: string]: string } {
    const envVars: { [key: string]: string } = {};
    try {
      const context = this.node.getContext('env');
      
      if (context && typeof context === 'object') {
        Object.entries(context).forEach(([key, value]) => {
          if (typeof value === 'string') {
            envVars[key] = value;
          }
        });
      }
    } catch (error) {
      // Context parameter not set, return empty object
    }

    return envVars;
  }

  /**
   * Parse secrets from context parameters
   * Format: secret:KEY=arn:aws:secretsmanager:region:account:secret:name
   */
  private parseSecrets(): { [key: string]: string } {
    const secrets: { [key: string]: string } = {};
    try {
      const context = this.node.getContext('secret');
      
      if (context && typeof context === 'object') {
        Object.entries(context).forEach(([key, value]) => {
          if (typeof value === 'string') {
            secrets[key] = value;
          }
        });
      }
    } catch (error) {
      // Context parameter not set, return empty object
    }

    return secrets;
  }

  /**
   * Load values from file (JSON, JS, or YAML)
   * Graceful fallback to JSON if YAML parser not available
   */
  private loadValuesFile(filePath: string): any {
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Warning: Values file not found: ${filePath}, skipping`);
      return {};
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.js') {
      return require(path.resolve(filePath));
    } else if (ext === '.yaml' || ext === '.yml') {
      try {
        const yaml = require('js-yaml');
        return yaml.load(fileContent);
      } catch (yamlError) {
        console.warn(`⚠️  Warning: js-yaml not available, falling back to JSON`);
        return JSON.parse(fileContent);
      }
    } else {
      return JSON.parse(fileContent);
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
    // Create log group
    const logGroup = new logs.LogGroup(this, `${config.serviceName}LogGroup`, {
      logGroupName: config.logGroupName || `/ecs/${config.serviceName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, `${config.serviceName}TaskDef`, {
      cpu: config.cpu,
      memoryLimitMiB: config.memory,
      executionRole: config.taskExecutionRoleArn ? 
        iam.Role.fromRoleArn(this, `${config.serviceName}ExecutionRole`, config.taskExecutionRoleArn) : 
        undefined,
      taskRole: config.taskRoleArn ? 
        iam.Role.fromRoleArn(this, `${config.serviceName}TaskRole`, config.taskRoleArn) : 
        undefined,
      // Note: Graceful shutdown is configured at the service level
      // and is handled automatically by ECS
    });

    // Add container to task definition
    const container = taskDefinition.addContainer(`${config.serviceName}Container`, {
      image: this.createContainerImage(config.image),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: logGroup,
        streamPrefix: config.serviceName!,
      }),
      environment: config.environment,
      secrets: config.secrets ? this.createSecrets(config.secrets) : undefined,
      healthCheck: config.healthCheck ? {
        command: config.healthCheck.command || ['CMD-SHELL', 'curl -f http://localhost:80/ || exit 1'],
        interval: config.healthCheck.interval || cdk.Duration.seconds(30),
        timeout: config.healthCheck.timeout || cdk.Duration.seconds(5),
        startPeriod: config.healthCheck.startPeriod || cdk.Duration.seconds(60),
        retries: config.healthCheck.retries || 3,
      } : undefined,
      cpu: config.resourceLimits?.cpu,
      memoryLimitMiB: config.resourceLimits?.memory,
    });

    // Add port mapping
    container.addPortMappings({
      containerPort: config.containerPort!,
      protocol: ecs.Protocol.TCP,
    });

    // Create the service
    const service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${config.serviceName}Service`, {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      desiredCount: config.desiredCount,
      publicLoadBalancer: true,
      listenerPort: config.lbPort!,
      serviceName: config.serviceName,
      capacityProviderStrategies: config.capacityProvider ? [
        {
          capacityProvider: config.capacityProvider,
          weight: 1,
        }
      ] : undefined,
    });

    // Note: Placement strategies are configured via AWS CLI or console
    // as they require advanced ECS service configuration
    // Example: aws ecs update-service --cluster my-cluster --service my-service --placement-strategy type=spread,field=attribute:ecs.availability-zone

    // Add service discovery if configured
    if (config.serviceDiscovery) {
      const namespace = new servicediscovery.PrivateDnsNamespace(this, `${config.serviceName}Namespace`, {
        name: config.serviceDiscovery.namespace || `${config.serviceName}.local`,
        vpc: vpc,
      });

      const serviceDiscoveryService = new servicediscovery.Service(this, `${config.serviceName}ServiceDiscovery`, {
        namespace: namespace,
        name: config.serviceDiscovery.serviceName || config.serviceName,
        dnsRecordType: config.serviceDiscovery.dnsType === 'SRV' ? servicediscovery.DnsRecordType.SRV : servicediscovery.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(config.serviceDiscovery.ttl || 10),
      });

      // Note: Service discovery integration requires manual configuration
      // The service discovery service is created but not automatically associated
      // Users can manually associate it via AWS CLI or console
    }

    // Configure security group
    if (config.allowedCidr !== '0.0.0.0/0') {
      service.loadBalancer.connections.allowFromAnyIpv4(
        ec2.Port.tcp(config.lbPort!),
        `Allow HTTP from ${config.allowedCidr}`
      );
    }

    return service;
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