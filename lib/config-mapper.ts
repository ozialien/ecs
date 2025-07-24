/**
 * Configuration mapper for converting between structured and legacy formats
 * Maintains backward compatibility while supporting new Helm-like structure
 */

import * as cdk from 'aws-cdk-lib';
import { EcsServiceConfig } from './types';
import { 
  StructuredEcsConfig, 
  Infrastructure, 
  Cluster,
  TaskDefinition,
  Container, 
  Service, 
  LoadBalancer,
  AutoScaling,
  Iam, 
  ServiceDiscovery, 
  Addons 
} from './structured-types';

/**
 * Configuration mapper class
 */
export class ConfigMapper {
  
  /**
   * Convert structured configuration to legacy format
   * This allows the existing CDK code to work with structured configs
   */
  static structuredToLegacy(structured: StructuredEcsConfig): EcsServiceConfig {
    const legacy: EcsServiceConfig = {
      // Required fields
      vpcId: structured.infrastructure?.vpc.id || '',
      subnetIds: structured.infrastructure?.vpc.subnets || [],
      clusterName: structured.cluster?.name || '',
      image: structured.taskDefinition?.containers?.[0]?.image || '',
      stackName: structured.metadata?.name || '',
      
      // Task Definition configuration
      cpu: structured.taskDefinition?.cpu,
      memory: structured.taskDefinition?.memory,
      desiredCount: structured.service?.desiredCount,
      
      // Container configuration
      containerPort: structured.taskDefinition?.containers?.[0]?.portMappings?.[0]?.containerPort,
      lbPort: structured.loadBalancer?.port,
      
      // Load balancer configuration
      publicLoadBalancer: structured.loadBalancer?.scheme !== 'internal',
      lbProtocol: structured.loadBalancer?.protocol,
      certificateArn: structured.loadBalancer?.certificateArn,
      
      // Health check configuration
      healthCheckPath: structured.loadBalancer?.targetGroup?.healthCheckPath,
      healthCheckGracePeriodSeconds: structured.service?.healthCheckGracePeriodSeconds,
      
      // Load balancer health check (enhanced)
      loadBalancerHealthCheck: structured.loadBalancer?.targetGroup ? {
        enabled: true,
        path: structured.loadBalancer.targetGroup.healthCheckPath,
        healthyHttpCodes: structured.loadBalancer.targetGroup.healthyHttpCodes,
        interval: structured.loadBalancer.targetGroup.interval ? 
          cdk.Duration.seconds(structured.loadBalancer.targetGroup.interval) : undefined,
        timeout: structured.loadBalancer.targetGroup.timeout ? 
          cdk.Duration.seconds(structured.loadBalancer.targetGroup.timeout) : undefined,
        healthyThresholdCount: structured.loadBalancer.targetGroup.healthyThresholdCount,
        unhealthyThresholdCount: structured.loadBalancer.targetGroup.unhealthyThresholdCount,
      } : undefined,
      
      // Container health check
      healthCheck: structured.taskDefinition?.containers?.[0]?.healthCheck ? {
        enabled: true,
        command: structured.taskDefinition.containers[0].healthCheck!.command,
        interval: structured.taskDefinition.containers[0].healthCheck!.interval ? 
          cdk.Duration.seconds(structured.taskDefinition.containers[0].healthCheck!.interval) : undefined,
        timeout: structured.taskDefinition.containers[0].healthCheck!.timeout ? 
          cdk.Duration.seconds(structured.taskDefinition.containers[0].healthCheck!.timeout) : undefined,
        startPeriod: structured.taskDefinition.containers[0].healthCheck!.startPeriod ? 
          cdk.Duration.seconds(structured.taskDefinition.containers[0].healthCheck!.startPeriod) : undefined,
        retries: structured.taskDefinition.containers[0].healthCheck!.retries,
      } : undefined,
      
      // Deployment configuration
      deploymentConfiguration: structured.service?.deployment ? {
        minimumHealthyPercent: structured.service.deployment.minimumHealthyPercent,
        maximumPercent: structured.service.deployment.maximumPercent,
      } : undefined,
      
      // Volumes
      volumes: structured.taskDefinition?.volumes?.map(volume => ({
        name: volume.name,
        efsVolumeConfiguration: volume.efsVolumeConfiguration,
      })),
      
      // Additional containers
      additionalContainers: structured.taskDefinition?.containers?.slice(1).map(container => ({
        name: container.name,
        image: container.image,
        essential: container.essential,
        readonlyRootFilesystem: container.readonlyRootFilesystem,
        environment: container.environment?.reduce((acc, env) => {
          acc[env.name] = env.value;
          return acc;
        }, {} as { [key: string]: string }),
        command: container.command,
        entryPoint: container.entryPoint,
        portMappings: container.portMappings?.map(pm => ({
          containerPort: pm.containerPort,
          protocol: pm.protocol,
        })),
        mountPoints: container.mountPoints,
      })),
      
      // Environment variables
      environment: structured.taskDefinition?.containers?.[0]?.environment?.reduce((acc, env) => {
        acc[env.name] = env.value;
        return acc;
      }, {} as { [key: string]: string }),
      
      // IAM permissions
      taskRolePermissions: this.mapIamPolicies(structured.iam?.taskRole?.policies),
      taskExecutionRolePermissions: this.mapIamPolicies(structured.iam?.taskExecutionRole?.policies),
      
      // Service discovery
      serviceDiscovery: structured.serviceDiscovery ? {
        enabled: structured.serviceDiscovery.enabled,
        namespace: structured.serviceDiscovery.namespace?.name,
        serviceName: structured.serviceDiscovery.service?.name,
        dnsType: structured.serviceDiscovery.service?.dnsType,
        ttl: structured.serviceDiscovery.service?.ttl,
      } : undefined,
      
      // Add-ons
      logRetentionDays: structured.addons?.logging?.retentionDays,
      enableAutoScaling: structured.autoScaling?.enabled,
      minCapacity: structured.autoScaling?.minCapacity,
      maxCapacity: structured.autoScaling?.maxCapacity,
      targetCpuUtilization: structured.autoScaling?.metrics?.find(m => m.type === 'CPUUtilization')?.target,
      targetMemoryUtilization: structured.autoScaling?.metrics?.find(m => m.type === 'MemoryUtilization')?.target,
      
      // Security groups
      allowedCidr: structured.infrastructure?.securityGroups?.[0]?.rules?.[0]?.cidr,
    };
    
    return legacy;
  }
  
  
  
  /**
   * Map IAM policies from structured format to legacy format
   */
  private static mapIamPolicies(policies?: { name: string; actions: string[]; resources: string[] }[]): { [key: string]: { actions: string[]; resources: string[] } } | undefined {
    if (!policies) return undefined;
    
    const mapped: { [key: string]: { actions: string[]; resources: string[] } } = {};
    policies.forEach(policy => {
      mapped[policy.name] = {
        actions: policy.actions,
        resources: policy.resources,
      };
    });
    return mapped;
  }
  

  
  /**
   * Detect if configuration is in structured format
   */
  static isStructuredConfig(config: any): config is StructuredEcsConfig {
    return config && (
      config.infrastructure !== undefined ||
      config.cluster !== undefined ||
      config.taskDefinition !== undefined ||
      config.service !== undefined ||
      config.loadBalancer !== undefined ||
      config.autoScaling !== undefined ||
      config.iam !== undefined ||
      config.serviceDiscovery !== undefined ||
      config.addons !== undefined
    );
  }
} 