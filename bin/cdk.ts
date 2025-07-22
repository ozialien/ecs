#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { EcsServiceStack } from '../src/ecs-service-stack';
import { EcsServiceConfig } from '../src/types';

/**
 * CDK App Entry Point
 * 
 * Uses CDK's native context parameters (-c) for configuration
 * 
 * Usage:
 *   # Context parameters only
 *   cdk deploy -c vpcId=vpc-12345678 -c image=nginx:alpine
 *   
 *   # With values file (Helm-style)
 *   cdk deploy -c valuesFile=values.yaml
 */

const app = new cdk.App();

// Load configuration from context parameters
const config: EcsServiceConfig = {
  vpcId: app.node.tryGetContext('vpcId') || process.env.VPC_ID,
  subnetIds: app.node.tryGetContext('subnetIds') || process.env.SUBNET_IDS?.split(','),
  clusterName: app.node.tryGetContext('clusterName') || process.env.CLUSTER_NAME,
  image: app.node.tryGetContext('image') || process.env.IMAGE,
  serviceName: app.node.tryGetContext('serviceName') || process.env.SERVICE_NAME,
  desiredCount: app.node.tryGetContext('desiredCount') || parseInt(process.env.DESIRED_COUNT || '1'),
  cpu: app.node.tryGetContext('cpu') || parseInt(process.env.CPU || '256'),
  memory: app.node.tryGetContext('memory') || parseInt(process.env.MEMORY || '512'),
                containerPort: app.node.tryGetContext('containerPort') || parseInt(process.env.CONTAINER_PORT || ''),
              lbPort: app.node.tryGetContext('lbPort') || parseInt(process.env.LB_PORT || ''),
  healthCheckPath: app.node.tryGetContext('healthCheckPath') || process.env.HEALTH_CHECK_PATH || '/',
  allowedCidr: app.node.tryGetContext('allowedCidr') || process.env.ALLOWED_CIDR || '0.0.0.0/0',
  environment: app.node.tryGetContext('env') || {},
  secrets: app.node.tryGetContext('secret') || {},
  logGroupName: app.node.tryGetContext('logGroupName') || process.env.LOG_GROUP_NAME,
  logRetentionDays: app.node.tryGetContext('logRetentionDays') || parseInt(process.env.LOG_RETENTION_DAYS || '7'),
  enableAutoScaling: app.node.tryGetContext('enableAutoScaling') || process.env.ENABLE_AUTO_SCALING === 'true',
  minCapacity: app.node.tryGetContext('minCapacity') || parseInt(process.env.MIN_CAPACITY || '1'),
  maxCapacity: app.node.tryGetContext('maxCapacity') || parseInt(process.env.MAX_CAPACITY || '3'),
  targetCpuUtilization: app.node.tryGetContext('targetCpuUtilization') || parseInt(process.env.TARGET_CPU_UTILIZATION || '70'),
  targetMemoryUtilization: app.node.tryGetContext('targetMemoryUtilization') || parseInt(process.env.TARGET_MEMORY_UTILIZATION || '70'),
  taskExecutionRoleArn: app.node.tryGetContext('taskExecutionRoleArn') || process.env.TASK_EXECUTION_ROLE_ARN,
  taskRoleArn: app.node.tryGetContext('taskRoleArn') || process.env.TASK_ROLE_ARN,
  taskRolePermissions: app.node.tryGetContext('taskRolePermissions'),
  taskExecutionRolePermissions: app.node.tryGetContext('taskExecutionRolePermissions'),
  valuesFile: app.node.tryGetContext('valuesFile'),
};

            // Validate required parameters
            const requiredParams = ['vpcId', 'subnetIds', 'clusterName', 'image', 'containerPort', 'lbPort'];
for (const param of requiredParams) {
  if (!config[param as keyof EcsServiceConfig]) {
    console.error(`❌ Error: Required parameter '${param}' is missing.`);
    console.error('   Use -c parameter or set environment variable.');
    console.error('');
    console.error('Examples:');
    console.error('  cdk deploy -c vpcId=vpc-12345678 -c image=nginx:alpine');
    console.error('  cdk deploy -c valuesFile=values.yaml');
    process.exit(1);
  }
}

// Create the ECS service stack
new EcsServiceStack(app, 'EcsServiceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  config,
});

app.synth(); 