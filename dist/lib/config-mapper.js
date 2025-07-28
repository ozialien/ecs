"use strict";
/**
 * Configuration mapper for converting between structured and legacy formats
 * Maintains backward compatibility while supporting new Helm-like structure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigMapper = void 0;
const cdk = require("aws-cdk-lib");
/**
 * Configuration mapper class
 */
class ConfigMapper {
    /**
     * Convert structured configuration to legacy format
     * This allows the existing CDK code to work with structured configs
     */
    static structuredToLegacy(structured) {
        const legacy = {
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
                command: structured.taskDefinition.containers[0].healthCheck.command,
                interval: structured.taskDefinition.containers[0].healthCheck.interval ?
                    cdk.Duration.seconds(structured.taskDefinition.containers[0].healthCheck.interval) : undefined,
                timeout: structured.taskDefinition.containers[0].healthCheck.timeout ?
                    cdk.Duration.seconds(structured.taskDefinition.containers[0].healthCheck.timeout) : undefined,
                startPeriod: structured.taskDefinition.containers[0].healthCheck.startPeriod ?
                    cdk.Duration.seconds(structured.taskDefinition.containers[0].healthCheck.startPeriod) : undefined,
                retries: structured.taskDefinition.containers[0].healthCheck.retries,
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
                }, {}),
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
            }, {}),
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
    static mapIamPolicies(policies) {
        if (!policies)
            return undefined;
        const mapped = {};
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
    static isStructuredConfig(config) {
        return config && (config.infrastructure !== undefined ||
            config.cluster !== undefined ||
            config.taskDefinition !== undefined ||
            config.service !== undefined ||
            config.loadBalancer !== undefined ||
            config.autoScaling !== undefined ||
            config.iam !== undefined ||
            config.serviceDiscovery !== undefined ||
            config.addons !== undefined);
    }
}
exports.ConfigMapper = ConfigMapper;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLW1hcHBlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9jb25maWctbWFwcGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUVILG1DQUFtQztBQWdCbkM7O0dBRUc7QUFDSCxNQUFhLFlBQVk7SUFFdkI7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLGtCQUFrQixDQUFDLFVBQStCO1FBQ3ZELE1BQU0sTUFBTSxHQUFxQjtZQUMvQixrQkFBa0I7WUFDbEIsS0FBSyxFQUFFLFVBQVUsQ0FBQyxjQUFjLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxFQUFFO1lBQzlDLFNBQVMsRUFBRSxVQUFVLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxPQUFPLElBQUksRUFBRTtZQUN2RCxXQUFXLEVBQUUsVUFBVSxDQUFDLE9BQU8sRUFBRSxJQUFJLElBQUksRUFBRTtZQUMzQyxLQUFLLEVBQUUsVUFBVSxDQUFDLGNBQWMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM5RCxTQUFTLEVBQUUsVUFBVSxDQUFDLFFBQVEsRUFBRSxJQUFJLElBQUksRUFBRTtZQUUxQyxnQ0FBZ0M7WUFDaEMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxjQUFjLEVBQUUsR0FBRztZQUNuQyxNQUFNLEVBQUUsVUFBVSxDQUFDLGNBQWMsRUFBRSxNQUFNO1lBQ3pDLFlBQVksRUFBRSxVQUFVLENBQUMsT0FBTyxFQUFFLFlBQVk7WUFFOUMsMEJBQTBCO1lBQzFCLGFBQWEsRUFBRSxVQUFVLENBQUMsY0FBYyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWE7WUFDM0YsTUFBTSxFQUFFLFVBQVUsQ0FBQyxZQUFZLEVBQUUsSUFBSTtZQUVyQyw4QkFBOEI7WUFDOUIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLFlBQVksRUFB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Q0FBQztRQUNILE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFJRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxNQUFXO1FBQ25DLE9BQU8sTUFBTSxJQUFJLENBQ2YsTUFBTSxDQUFDLGNBQWMsS0FBSyxTQUFTO1lBQ25DLE1BQU0sQ0FBQyxPQUFPLEtBQUssU0FBUztZQUM1QixNQUFNLENBQUMsY0FBYyxLQUFLLFNBQVM7WUFDbkMsTUFBTSxDQUFDLE9BQU8sS0FBSyxTQUFTO1lBQzVCLE1BQU0sQ0FBQyxZQUFZLEtBQUssU0FBUztZQUNqQyxNQUFNLENBQUMsV0FBVyxLQUFLLFNBQVM7WUFDaEMsTUFBTSxDQUFDLEdBQUcsS0FBSyxTQUFTO1lBQ3hCLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTO1lBQ3JDLE1BQU0sQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUM1QixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBaEtELG9DQWdLQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29uZmlndXJhdGlvbiBtYXBwZXIgZm9yIGNvbnZlcnRpbmcgYmV0d2VlbiBzdHJ1Y3R1cmVkIGFuZCBsZWdhY3kgZm9ybWF0c1xuICogTWFpbnRhaW5zIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkgd2hpbGUgc3VwcG9ydGluZyBuZXcgSGVsbS1saWtlIHN0cnVjdHVyZVxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBFY3NTZXJ2aWNlQ29uZmlnIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBcbiAgU3RydWN0dXJlZEVjc0NvbmZpZywgXG4gIEluZnJhc3RydWN0dXJlLCBcbiAgQ2x1c3RlcixcbiAgVGFza0RlZmluaXRpb24sXG4gIENvbnRhaW5lciwgXG4gIFNlcnZpY2UsIFxuICBMb2FkQmFsYW5jZXIsXG4gIEF1dG9TY2FsaW5nLFxuICBJYW0sIFxuICBTZXJ2aWNlRGlzY292ZXJ5LCBcbiAgQWRkb25zIFxufSBmcm9tICcuL3N0cnVjdHVyZWQtdHlwZXMnO1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gbWFwcGVyIGNsYXNzXG4gKi9cbmV4cG9ydCBjbGFzcyBDb25maWdNYXBwZXIge1xuICBcbiAgLyoqXG4gICAqIENvbnZlcnQgc3RydWN0dXJlZCBjb25maWd1cmF0aW9uIHRvIGxlZ2FjeSBmb3JtYXRcbiAgICogVGhpcyBhbGxvd3MgdGhlIGV4aXN0aW5nIENESyBjb2RlIHRvIHdvcmsgd2l0aCBzdHJ1Y3R1cmVkIGNvbmZpZ3NcbiAgICovXG4gIHN0YXRpYyBzdHJ1Y3R1cmVkVG9MZWdhY3koc3RydWN0dXJlZDogU3RydWN0dXJlZEVjc0NvbmZpZyk6IEVjc1NlcnZpY2VDb25maWcge1xuICAgIGNvbnN0IGxlZ2FjeTogRWNzU2VydmljZUNvbmZpZyA9IHtcbiAgICAgIC8vIFJlcXVpcmVkIGZpZWxkc1xuICAgICAgdnBjSWQ6IHN0cnVjdHVyZWQuaW5mcmFzdHJ1Y3R1cmU/LnZwYy5pZCB8fCAnJyxcbiAgICAgIHN1Ym5ldElkczogc3RydWN0dXJlZC5pbmZyYXN0cnVjdHVyZT8udnBjLnN1Ym5ldHMgfHwgW10sXG4gICAgICBjbHVzdGVyTmFtZTogc3RydWN0dXJlZC5jbHVzdGVyPy5uYW1lIHx8ICcnLFxuICAgICAgaW1hZ2U6IHN0cnVjdHVyZWQudGFza0RlZmluaXRpb24/LmNvbnRhaW5lcnM/LlswXT8uaW1hZ2UgfHwgJycsXG4gICAgICBzdGFja05hbWU6IHN0cnVjdHVyZWQubWV0YWRhdGE/Lm5hbWUgfHwgJycsXG4gICAgICBcbiAgICAgIC8vIFRhc2sgRGVmaW5pdGlvbiBjb25maWd1cmF0aW9uXG4gICAgICBjcHU6IHN0cnVjdHVyZWQudGFza0RlZmluaXRpb24/LmNwdSxcbiAgICAgIG1lbW9yeTogc3RydWN0dXJlZC50YXNrRGVmaW5pdGlvbj8ubWVtb3J5LFxuICAgICAgZGVzaXJlZENvdW50OiBzdHJ1Y3R1cmVkLnNlcnZpY2U/LmRlc2lyZWRDb3VudCxcbiAgICAgIFxuICAgICAgLy8gQ29udGFpbmVyIGNvbmZpZ3VyYXRpb25cbiAgICAgIGNvbnRhaW5lclBvcnQ6IHN0cnVjdHVyZWQudGFza0RlZmluaXRpb24/LmNvbnRhaW5lcnM/LlswXT8ucG9ydE1hcHBpbmdzPy5bMF0/LmNvbnRhaW5lclBvcnQsXG4gICAgICBsYlBvcnQ6IHN0cnVjdHVyZWQubG9hZEJhbGFuY2VyPy5wb3J0LFxuICAgICAgXG4gICAgICAvLyBMb2FkIGJhbGFuY2VyIGNvbmZpZ3VyYXRpb25cbiAgICAgIHB1YmxpY0xvYWRCYWxhbmNlcjogc3RydWN0dXJlZC5sb2FkQmFsYW5jZXI/LnNjaGVtZSAhPT0gJ2ludGVybmFsJyxcbiAgICAgIGxiUHJvdG9jb2w6IHN0cnVjdHVyZWQubG9hZEJhbGFuY2VyPy5wcm90b2NvbCxcbiAgICAgIGNlcnRpZmljYXRlQXJuOiBzdHJ1Y3R1cmVkLmxvYWRCYWxhbmNlcj8uY2VydGlmaWNhdGVBcm4sXG4gICAgICBcbiAgICAgIC8vIEhlYWx0aCBjaGVjayBjb25maWd1cmF0aW9uXG4gICAgICBoZWFsdGhDaGVja1BhdGg6IHN0cnVjdHVyZWQubG9hZEJhbGFuY2VyPy50YXJnZXRHcm91cD8uaGVhbHRoQ2hlY2tQYXRoLFxuICAgICAgaGVhbHRoQ2hlY2tHcmFjZVBlcmlvZFNlY29uZHM6IHN0cnVjdHVyZWQuc2VydmljZT8uaGVhbHRoQ2hlY2tHcmFjZVBlcmlvZFNlY29uZHMsXG4gICAgICBcbiAgICAgIC8vIExvYWQgYmFsYW5jZXIgaGVhbHRoIGNoZWNrIChlbmhhbmNlZClcbiAgICAgIGxvYWRCYWxhbmNlckhlYWx0aENoZWNrOiBzdHJ1Y3R1cmVkLmxvYWRCYWxhbmNlcj8udGFyZ2V0R3JvdXAgPyB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHBhdGg6IHN0cnVjdHVyZWQubG9hZEJhbGFuY2VyLnRhcmdldEdyb3VwLmhlYWx0aENoZWNrUGF0aCxcbiAgICAgICAgaGVhbHRoeUh0dHBDb2Rlczogc3RydWN0dXJlZC5sb2FkQmFsYW5jZXIudGFyZ2V0R3JvdXAuaGVhbHRoeUh0dHBDb2RlcyxcbiAgICAgICAgaW50ZXJ2YWw6IHN0cnVjdHVyZWQubG9hZEJhbGFuY2VyLnRhcmdldEdyb3VwLmludGVydmFsID8gXG4gICAgICAgICAgY2RrLkR1cmF0aW9uLnNlY29uZHMoc3RydWN0dXJlZC5sb2FkQmFsYW5jZXIudGFyZ2V0R3JvdXAuaW50ZXJ2YWwpIDogdW5kZWZpbmVkLFxuICAgICAgICB0aW1lb3V0OiBzdHJ1Y3R1cmVkLmxvYWRCYWxhbmNlci50YXJnZXRHcm91cC50aW1lb3V0ID8gXG4gICAgICAgICAgY2RrLkR1cmF0aW9uLnNlY29uZHMoc3RydWN0dXJlZC5sb2FkQmFsYW5jZXIudGFyZ2V0R3JvdXAudGltZW91dCkgOiB1bmRlZmluZWQsXG4gICAgICAgIGhlYWx0aHlUaHJlc2hvbGRDb3VudDogc3RydWN0dXJlZC5sb2FkQmFsYW5jZXIudGFyZ2V0R3JvdXAuaGVhbHRoeVRocmVzaG9sZENvdW50LFxuICAgICAgICB1bmhlYWx0aHlUaHJlc2hvbGRDb3VudDogc3RydWN0dXJlZC5sb2FkQmFsYW5jZXIudGFyZ2V0R3JvdXAudW5oZWFsdGh5VGhyZXNob2xkQ291bnQsXG4gICAgICB9IDogdW5kZWZpbmVkLFxuICAgICAgXG4gICAgICAvLyBDb250YWluZXIgaGVhbHRoIGNoZWNrXG4gICAgICBoZWFsdGhDaGVjazogc3RydWN0dXJlZC50YXNrRGVmaW5pdGlvbj8uY29udGFpbmVycz8uWzBdPy5oZWFsdGhDaGVjayA/IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgY29tbWFuZDogc3RydWN0dXJlZC50YXNrRGVmaW5pdGlvbi5jb250YWluZXJzWzBdLmhlYWx0aENoZWNrIS5jb21tYW5kLFxuICAgICAgICBpbnRlcnZhbDogc3RydWN0dXJlZC50YXNrRGVmaW5pdGlvbi5jb250YWluZXJzWzBdLmhlYWx0aENoZWNrIS5pbnRlcnZhbCA/IFxuICAgICAgICAgIGNkay5EdXJhdGlvbi5zZWNvbmRzKHN0cnVjdHVyZWQudGFza0RlZmluaXRpb24uY29udGFpbmVyc1swXS5oZWFsdGhDaGVjayEuaW50ZXJ2YWwpIDogdW5kZWZpbmVkLFxuICAgICAgICB0aW1lb3V0OiBzdHJ1Y3R1cmVkLnRhc2tEZWZpbml0aW9uLmNvbnRhaW5lcnNbMF0uaGVhbHRoQ2hlY2shLnRpbWVvdXQgPyBcbiAgICAgICAgICBjZGsuRHVyYXRpb24uc2Vjb25kcyhzdHJ1Y3R1cmVkLnRhc2tEZWZpbml0aW9uLmNvbnRhaW5lcnNbMF0uaGVhbHRoQ2hlY2shLnRpbWVvdXQpIDogdW5kZWZpbmVkLFxuICAgICAgICBzdGFydFBlcmlvZDogc3RydWN0dXJlZC50YXNrRGVmaW5pdGlvbi5jb250YWluZXJzWzBdLmhlYWx0aENoZWNrIS5zdGFydFBlcmlvZCA/IFxuICAgICAgICAgIGNkay5EdXJhdGlvbi5zZWNvbmRzKHN0cnVjdHVyZWQudGFza0RlZmluaXRpb24uY29udGFpbmVyc1swXS5oZWFsdGhDaGVjayEuc3RhcnRQZXJpb2QpIDogdW5kZWZpbmVkLFxuICAgICAgICByZXRyaWVzOiBzdHJ1Y3R1cmVkLnRhc2tEZWZpbml0aW9uLmNvbnRhaW5lcnNbMF0uaGVhbHRoQ2hlY2shLnJldHJpZXMsXG4gICAgICB9IDogdW5kZWZpbmVkLFxuICAgICAgXG4gICAgICAvLyBEZXBsb3ltZW50IGNvbmZpZ3VyYXRpb25cbiAgICAgIGRlcGxveW1lbnRDb25maWd1cmF0aW9uOiBzdHJ1Y3R1cmVkLnNlcnZpY2U/LmRlcGxveW1lbnQgPyB7XG4gICAgICAgIG1pbmltdW1IZWFsdGh5UGVyY2VudDogc3RydWN0dXJlZC5zZXJ2aWNlLmRlcGxveW1lbnQubWluaW11bUhlYWx0aHlQZXJjZW50LFxuICAgICAgICBtYXhpbXVtUGVyY2VudDogc3RydWN0dXJlZC5zZXJ2aWNlLmRlcGxveW1lbnQubWF4aW11bVBlcmNlbnQsXG4gICAgICB9IDogdW5kZWZpbmVkLFxuICAgICAgXG4gICAgICAvLyBWb2x1bWVzXG4gICAgICB2b2x1bWVzOiBzdHJ1Y3R1cmVkLnRhc2tEZWZpbml0aW9uPy52b2x1bWVzPy5tYXAodm9sdW1lID0+ICh7XG4gICAgICAgIG5hbWU6IHZvbHVtZS5uYW1lLFxuICAgICAgICBlZnNWb2x1bWVDb25maWd1cmF0aW9uOiB2b2x1bWUuZWZzVm9sdW1lQ29uZmlndXJhdGlvbixcbiAgICAgIH0pKSxcbiAgICAgIFxuICAgICAgLy8gQWRkaXRpb25hbCBjb250YWluZXJzXG4gICAgICBhZGRpdGlvbmFsQ29udGFpbmVyczogc3RydWN0dXJlZC50YXNrRGVmaW5pdGlvbj8uY29udGFpbmVycz8uc2xpY2UoMSkubWFwKGNvbnRhaW5lciA9PiAoe1xuICAgICAgICBuYW1lOiBjb250YWluZXIubmFtZSxcbiAgICAgICAgaW1hZ2U6IGNvbnRhaW5lci5pbWFnZSxcbiAgICAgICAgZXNzZW50aWFsOiBjb250YWluZXIuZXNzZW50aWFsLFxuICAgICAgICByZWFkb25seVJvb3RGaWxlc3lzdGVtOiBjb250YWluZXIucmVhZG9ubHlSb290RmlsZXN5c3RlbSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IGNvbnRhaW5lci5lbnZpcm9ubWVudD8ucmVkdWNlKChhY2MsIGVudikgPT4ge1xuICAgICAgICAgIGFjY1tlbnYubmFtZV0gPSBlbnYudmFsdWU7XG4gICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgfSwge30gYXMgeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSksXG4gICAgICAgIGNvbW1hbmQ6IGNvbnRhaW5lci5jb21tYW5kLFxuICAgICAgICBlbnRyeVBvaW50OiBjb250YWluZXIuZW50cnlQb2ludCxcbiAgICAgICAgcG9ydE1hcHBpbmdzOiBjb250YWluZXIucG9ydE1hcHBpbmdzPy5tYXAocG0gPT4gKHtcbiAgICAgICAgICBjb250YWluZXJQb3J0OiBwbS5jb250YWluZXJQb3J0LFxuICAgICAgICAgIHByb3RvY29sOiBwbS5wcm90b2NvbCxcbiAgICAgICAgfSkpLFxuICAgICAgICBtb3VudFBvaW50czogY29udGFpbmVyLm1vdW50UG9pbnRzLFxuICAgICAgfSkpLFxuICAgICAgXG4gICAgICAvLyBFbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICAgIGVudmlyb25tZW50OiBzdHJ1Y3R1cmVkLnRhc2tEZWZpbml0aW9uPy5jb250YWluZXJzPy5bMF0/LmVudmlyb25tZW50Py5yZWR1Y2UoKGFjYywgZW52KSA9PiB7XG4gICAgICAgIGFjY1tlbnYubmFtZV0gPSBlbnYudmFsdWU7XG4gICAgICAgIHJldHVybiBhY2M7XG4gICAgICB9LCB7fSBhcyB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9KSxcbiAgICAgIFxuICAgICAgLy8gSUFNIHBlcm1pc3Npb25zXG4gICAgICB0YXNrUm9sZVBlcm1pc3Npb25zOiB0aGlzLm1hcElhbVBvbGljaWVzKHN0cnVjdHVyZWQuaWFtPy50YXNrUm9sZT8ucG9saWNpZXMpLFxuICAgICAgdGFza0V4ZWN1dGlvblJvbGVQZXJtaXNzaW9uczogdGhpcy5tYXBJYW1Qb2xpY2llcyhzdHJ1Y3R1cmVkLmlhbT8udGFza0V4ZWN1dGlvblJvbGU/LnBvbGljaWVzKSxcbiAgICAgIFxuICAgICAgLy8gU2VydmljZSBkaXNjb3ZlcnlcbiAgICAgIHNlcnZpY2VEaXNjb3Zlcnk6IHN0cnVjdHVyZWQuc2VydmljZURpc2NvdmVyeSA/IHtcbiAgICAgICAgZW5hYmxlZDogc3RydWN0dXJlZC5zZXJ2aWNlRGlzY292ZXJ5LmVuYWJsZWQsXG4gICAgICAgIG5hbWVzcGFjZTogc3RydWN0dXJlZC5zZXJ2aWNlRGlzY292ZXJ5Lm5hbWVzcGFjZT8ubmFtZSxcbiAgICAgICAgc2VydmljZU5hbWU6IHN0cnVjdHVyZWQuc2VydmljZURpc2NvdmVyeS5zZXJ2aWNlPy5uYW1lLFxuICAgICAgICBkbnNUeXBlOiBzdHJ1Y3R1cmVkLnNlcnZpY2VEaXNjb3Zlcnkuc2VydmljZT8uZG5zVHlwZSxcbiAgICAgICAgdHRsOiBzdHJ1Y3R1cmVkLnNlcnZpY2VEaXNjb3Zlcnkuc2VydmljZT8udHRsLFxuICAgICAgfSA6IHVuZGVmaW5lZCxcbiAgICAgIFxuICAgICAgLy8gQWRkLW9uc1xuICAgICAgbG9nUmV0ZW50aW9uRGF5czogc3RydWN0dXJlZC5hZGRvbnM/LmxvZ2dpbmc/LnJldGVudGlvbkRheXMsXG4gICAgICBlbmFibGVBdXRvU2NhbGluZzogc3RydWN0dXJlZC5hdXRvU2NhbGluZz8uZW5hYmxlZCxcbiAgICAgIG1pbkNhcGFjaXR5OiBzdHJ1Y3R1cmVkLmF1dG9TY2FsaW5nPy5taW5DYXBhY2l0eSxcbiAgICAgIG1heENhcGFjaXR5OiBzdHJ1Y3R1cmVkLmF1dG9TY2FsaW5nPy5tYXhDYXBhY2l0eSxcbiAgICAgIHRhcmdldENwdVV0aWxpemF0aW9uOiBzdHJ1Y3R1cmVkLmF1dG9TY2FsaW5nPy5tZXRyaWNzPy5maW5kKG0gPT4gbS50eXBlID09PSAnQ1BVVXRpbGl6YXRpb24nKT8udGFyZ2V0LFxuICAgICAgdGFyZ2V0TWVtb3J5VXRpbGl6YXRpb246IHN0cnVjdHVyZWQuYXV0b1NjYWxpbmc/Lm1ldHJpY3M/LmZpbmQobSA9PiBtLnR5cGUgPT09ICdNZW1vcnlVdGlsaXphdGlvbicpPy50YXJnZXQsXG4gICAgICBcbiAgICAgIC8vIFNlY3VyaXR5IGdyb3Vwc1xuICAgICAgYWxsb3dlZENpZHI6IHN0cnVjdHVyZWQuaW5mcmFzdHJ1Y3R1cmU/LnNlY3VyaXR5R3JvdXBzPy5bMF0/LnJ1bGVzPy5bMF0/LmNpZHIsXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gbGVnYWN5O1xuICB9XG4gIFxuICBcbiAgXG4gIC8qKlxuICAgKiBNYXAgSUFNIHBvbGljaWVzIGZyb20gc3RydWN0dXJlZCBmb3JtYXQgdG8gbGVnYWN5IGZvcm1hdFxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgbWFwSWFtUG9saWNpZXMocG9saWNpZXM/OiB7IG5hbWU6IHN0cmluZzsgYWN0aW9uczogc3RyaW5nW107IHJlc291cmNlczogc3RyaW5nW10gfVtdKTogeyBba2V5OiBzdHJpbmddOiB7IGFjdGlvbnM6IHN0cmluZ1tdOyByZXNvdXJjZXM6IHN0cmluZ1tdIH0gfSB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKCFwb2xpY2llcykgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICBcbiAgICBjb25zdCBtYXBwZWQ6IHsgW2tleTogc3RyaW5nXTogeyBhY3Rpb25zOiBzdHJpbmdbXTsgcmVzb3VyY2VzOiBzdHJpbmdbXSB9IH0gPSB7fTtcbiAgICBwb2xpY2llcy5mb3JFYWNoKHBvbGljeSA9PiB7XG4gICAgICBtYXBwZWRbcG9saWN5Lm5hbWVdID0ge1xuICAgICAgICBhY3Rpb25zOiBwb2xpY3kuYWN0aW9ucyxcbiAgICAgICAgcmVzb3VyY2VzOiBwb2xpY3kucmVzb3VyY2VzLFxuICAgICAgfTtcbiAgICB9KTtcbiAgICByZXR1cm4gbWFwcGVkO1xuICB9XG4gIFxuXG4gIFxuICAvKipcbiAgICogRGV0ZWN0IGlmIGNvbmZpZ3VyYXRpb24gaXMgaW4gc3RydWN0dXJlZCBmb3JtYXRcbiAgICovXG4gIHN0YXRpYyBpc1N0cnVjdHVyZWRDb25maWcoY29uZmlnOiBhbnkpOiBjb25maWcgaXMgU3RydWN0dXJlZEVjc0NvbmZpZyB7XG4gICAgcmV0dXJuIGNvbmZpZyAmJiAoXG4gICAgICBjb25maWcuaW5mcmFzdHJ1Y3R1cmUgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgY29uZmlnLmNsdXN0ZXIgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgY29uZmlnLnRhc2tEZWZpbml0aW9uICE9PSB1bmRlZmluZWQgfHxcbiAgICAgIGNvbmZpZy5zZXJ2aWNlICE9PSB1bmRlZmluZWQgfHxcbiAgICAgIGNvbmZpZy5sb2FkQmFsYW5jZXIgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgY29uZmlnLmF1dG9TY2FsaW5nICE9PSB1bmRlZmluZWQgfHxcbiAgICAgIGNvbmZpZy5pYW0gIT09IHVuZGVmaW5lZCB8fFxuICAgICAgY29uZmlnLnNlcnZpY2VEaXNjb3ZlcnkgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgY29uZmlnLmFkZG9ucyAhPT0gdW5kZWZpbmVkXG4gICAgKTtcbiAgfVxufSAiXX0=