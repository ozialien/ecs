/**
 * @matson/ecs - CDK Constructs for ECS Deployments
 *
 * This package provides reusable CDK constructs for deploying ECS services
 * with Helm-style configuration using context parameters.
 *
 * @example
 * ```typescript
 * import { EcsServiceStack } from '@matson/ecs';
 *
 * const app = new cdk.App();
 * new EcsServiceStack(app, 'MyEcsService', {
 *   image: 'nginx:alpine',
 *   vpcId: 'vpc-12345678',
 *   subnetIds: ['subnet-12345678', 'subnet-87654321'],
 *   clusterName: 'my-cluster'
 * });
 * ```
 */
export * from './ecs-service-stack';
export * from './types';
