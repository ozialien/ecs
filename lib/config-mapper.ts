/**
 * Configuration mapper for converting between structured and legacy formats
 * Maintains backward compatibility while supporting new Helm-like structure
 */

import { EcsServiceConfig } from './types';
import { 
  StructuredEcsConfig, 
  LegacyEcsConfig, 
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
        interval: structured.service.loadBalancer.targetGroup.interval,
        timeout: structured.service.loadBalancer.targetGroup.timeout,
        healthyThresholdCount: structured.service.loadBalancer.targetGroup.healthyThresholdCount,
        unhealthyThresholdCount: structured.service.loadBalancer.targetGroup.unhealthyThresholdCount,
      } : undefined,
      
      // Container health check
      healthCheck: structured.containers?.[0]?.healthCheck ? {
        enabled: true,
        command: structured.containers[0].healthCheck!.command,
        interval: structured.containers[0].healthCheck!.interval,
        timeout: structured.containers[0].healthCheck!.timeout,
        startPeriod: structured.containers[0].healthCheck!.startPeriod,
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
   * Convert legacy configuration to structured format
   * This allows migration from flat to structured format
   */
  static legacyToStructured(legacy: EcsServiceConfig): StructuredEcsConfig {
    const structured: StructuredEcsConfig = {
      // Metadata
      metadata: {
        name: legacy.stackName || 'ecs-service',
        version: '1.0.0',
        description: 'ECS Service migrated from legacy format',
      },
      
      // Infrastructure
      infrastructure: {
        vpc: {
          id: legacy.vpcId,
          subnets: Array.isArray(legacy.subnetIds) ? legacy.subnetIds : legacy.subnetIds?.split(','),
        },
        securityGroups: legacy.allowedCidr ? [{
          name: 'default-sg',
          rules: [{
            port: legacy.containerPort || 80,
            cidr: legacy.allowedCidr,
            description: 'Default security group rule',
          }],
        }] : undefined,
      },
      
      // Compute
      compute: legacy.cpu || legacy.memory ? {
        type: 'FARGATE',
        cpu: legacy.cpu || 256,
        memory: legacy.memory || 512,
      } : undefined,
      
      // Containers
      containers: legacy.image ? [{
        name: 'main',
        image: legacy.image,
        portMappings: legacy.containerPort ? [{
          containerPort: legacy.containerPort,
          protocol: 'tcp',
        }] : undefined,
        environment: legacy.environment ? Object.entries(legacy.environment).map(([name, value]) => ({
          name,
          value,
        })) : undefined,
        healthCheck: legacy.healthCheck,
        mountPoints: legacy.additionalContainers?.[0]?.mountPoints,
      }] : undefined,
      
      // Volumes
      volumes: legacy.volumes,
      
      // Service
      service: {
        type: 'LOAD_BALANCED',
        clusterName: legacy.clusterName || '',
        desiredCount: legacy.desiredCount || 1,
        loadBalancer: legacy.lbPort || legacy.lbProtocol ? {
          type: 'APPLICATION',
          scheme: legacy.publicLoadBalancer === false ? 'internal' : 'internet-facing',
          protocol: legacy.lbProtocol,
          port: legacy.lbPort,
          certificateArn: legacy.certificateArn,
          targetGroup: legacy.loadBalancerHealthCheck ? {
            healthCheckPath: legacy.loadBalancerHealthCheck.path,
            healthyHttpCodes: legacy.loadBalancerHealthCheck.healthyHttpCodes,
            interval: legacy.loadBalancerHealthCheck.interval,
            timeout: legacy.loadBalancerHealthCheck.timeout,
            healthyThresholdCount: legacy.loadBalancerHealthCheck.healthyThresholdCount,
            unhealthyThresholdCount: legacy.loadBalancerHealthCheck.unhealthyThresholdCount,
          } : undefined,
        } : undefined,
        deployment: legacy.deploymentConfiguration ? {
          minimumHealthyPercent: legacy.deploymentConfiguration.minimumHealthyPercent,
          maximumPercent: legacy.deploymentConfiguration.maximumPercent,
          healthCheckGracePeriodSeconds: legacy.healthCheckGracePeriodSeconds,
        } : undefined,
      },
      
      // IAM
      iam: {
        taskRole: legacy.taskRolePermissions ? {
          policies: this.mapLegacyIamPolicies(legacy.taskRolePermissions),
        } : undefined,
        taskExecutionRole: legacy.taskExecutionRolePermissions ? {
          policies: this.mapLegacyIamPolicies(legacy.taskExecutionRolePermissions),
        } : undefined,
      },
      
      // Service discovery
      serviceDiscovery: legacy.serviceDiscovery ? {
        enabled: legacy.serviceDiscovery.enabled,
        namespace: legacy.serviceDiscovery.namespace ? {
          name: legacy.serviceDiscovery.namespace,
          type: 'private',
        } : undefined,
        service: legacy.serviceDiscovery.serviceName ? {
          name: legacy.serviceDiscovery.serviceName,
          dnsType: legacy.serviceDiscovery.dnsType || 'A',
          ttl: legacy.serviceDiscovery.ttl,
        } : undefined,
      } : undefined,
      
      // Add-ons
      addons: {
        logging: legacy.logRetentionDays ? {
          driver: 'awslogs',
          retentionDays: legacy.logRetentionDays,
        } : undefined,
        autoScaling: legacy.enableAutoScaling ? {
          enabled: legacy.enableAutoScaling,
          minCapacity: legacy.minCapacity,
          maxCapacity: legacy.maxCapacity,
          targetCpuUtilization: legacy.targetCpuUtilization,
          targetMemoryUtilization: legacy.targetMemoryUtilization,
        } : undefined,
      },
    };
    
    return structured;
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
   * Map IAM policies from legacy format to structured format
   */
  private static mapLegacyIamPolicies(permissions: { [key: string]: { actions: string[]; resources: string[] } }): { name: string; actions: string[]; resources: string[] }[] {
    return Object.entries(permissions).map(([name, policy]) => ({
      name,
      actions: policy.actions,
      resources: policy.resources,
    }));
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
  
  /**
   * Detect if configuration is in legacy format
   */
  static isLegacyConfig(config: any): config is LegacyEcsConfig {
    return config && (
      config.vpcId !== undefined ||
      config.subnetIds !== undefined ||
      config.clusterName !== undefined ||
      config.image !== undefined ||
      config.stackName !== undefined
    );
  }
} 