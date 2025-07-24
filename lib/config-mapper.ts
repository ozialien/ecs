/**
 * Configuration mapper for converting between structured and legacy formats
 * Maintains backward compatibility while supporting new Helm-like structure
 */

import * as cdk from 'aws-cdk-lib';
import { EcsServiceConfig } from './types';
import { 
  StructuredEcsConfig, 
  Infrastructure, 
  Compute, 
  Container, 
  Service, 
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
      clusterName: structured.service?.clusterName || '',
      image: structured.containers?.[0]?.image || '',
      stackName: structured.metadata?.name || '',
      
      // Compute configuration
      cpu: structured.compute?.cpu,
      memory: structured.compute?.memory,
      desiredCount: structured.service?.desiredCount,
      
      // Container configuration
      containerPort: structured.containers?.[0]?.portMappings?.[0]?.containerPort,
      lbPort: structured.service?.loadBalancer?.port,
      
      // Load balancer configuration
      publicLoadBalancer: structured.service?.loadBalancer?.scheme !== 'internal',
      lbProtocol: structured.service?.loadBalancer?.protocol,
      certificateArn: structured.service?.loadBalancer?.certificateArn,
      
      // Health check configuration
      healthCheckPath: structured.service?.loadBalancer?.targetGroup?.healthCheckPath,
      healthCheckGracePeriodSeconds: structured.service?.deployment?.healthCheckGracePeriodSeconds,
      
      // Load balancer health check (enhanced)
      loadBalancerHealthCheck: structured.service?.loadBalancer?.targetGroup ? {
        enabled: true,
        path: structured.service.loadBalancer.targetGroup.healthCheckPath,
        healthyHttpCodes: structured.service.loadBalancer.targetGroup.healthyHttpCodes,
        interval: structured.service.loadBalancer.targetGroup.interval ? 
          cdk.Duration.seconds(structured.service.loadBalancer.targetGroup.interval) : undefined,
        timeout: structured.service.loadBalancer.targetGroup.timeout ? 
          cdk.Duration.seconds(structured.service.loadBalancer.targetGroup.timeout) : undefined,
        healthyThresholdCount: structured.service.loadBalancer.targetGroup.healthyThresholdCount,
        unhealthyThresholdCount: structured.service.loadBalancer.targetGroup.unhealthyThresholdCount,
      } : undefined,
      
      // Container health check
      healthCheck: structured.containers?.[0]?.healthCheck ? {
        enabled: true,
        command: structured.containers[0].healthCheck!.command,
        interval: structured.containers[0].healthCheck!.interval ? 
          cdk.Duration.seconds(structured.containers[0].healthCheck!.interval) : undefined,
        timeout: structured.containers[0].healthCheck!.timeout ? 
          cdk.Duration.seconds(structured.containers[0].healthCheck!.timeout) : undefined,
        startPeriod: structured.containers[0].healthCheck!.startPeriod ? 
          cdk.Duration.seconds(structured.containers[0].healthCheck!.startPeriod) : undefined,
        retries: structured.containers[0].healthCheck!.retries,
      } : undefined,
      
      // Deployment configuration
      deploymentConfiguration: structured.service?.deployment ? {
        minimumHealthyPercent: structured.service.deployment.minimumHealthyPercent,
        maximumPercent: structured.service.deployment.maximumPercent,
      } : undefined,
      
      // Volumes
      volumes: structured.volumes?.map(volume => ({
        name: volume.name,
        efsVolumeConfiguration: volume.efsVolumeConfiguration,
      })),
      
      // Additional containers
      additionalContainers: structured.containers?.slice(1).map(container => ({
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
      environment: structured.containers?.[0]?.environment?.reduce((acc, env) => {
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
      enableAutoScaling: structured.addons?.autoScaling?.enabled,
      minCapacity: structured.addons?.autoScaling?.minCapacity,
      maxCapacity: structured.addons?.autoScaling?.maxCapacity,
      targetCpuUtilization: structured.addons?.autoScaling?.targetCpuUtilization,
      targetMemoryUtilization: structured.addons?.autoScaling?.targetMemoryUtilization,
      
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
      config.compute !== undefined ||
      config.containers !== undefined ||
      config.service !== undefined ||
      config.iam !== undefined ||
      config.serviceDiscovery !== undefined ||
      config.addons !== undefined
    );
  }
} 