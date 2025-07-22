#!/usr/bin/env node

/**
 * Example CDK app demonstrating @matson/ecs usage
 * 
 * This example shows how to use the EcsServiceStack construct
 * with different configuration options.
 */

import * as cdk from 'aws-cdk-lib';
import { EcsServiceStack } from '@matson/ecs';

const app = new cdk.App();

// Example 1: Basic ECS service with nginx
new EcsServiceStack(app, 'BasicEcsService', {
  config: {
    vpcId: 'vpc-12345678',
    subnetIds: ['subnet-12345678', 'subnet-87654321'],
    clusterName: 'my-cluster',
    image: 'nginx:alpine',
    serviceName: 'basic-nginx-service'
  }
});

// Example 2: Production service with auto scaling
new EcsServiceStack(app, 'ProductionEcsService', {
  config: {
    vpcId: 'vpc-12345678',
    subnetIds: ['subnet-12345678', 'subnet-87654321'],
    clusterName: 'prod-cluster',
    image: '123456789012.dkr.ecr.us-west-2.amazonaws.com/myapp:latest',
    serviceName: 'myapp-api',
    desiredCount: 3,
    cpu: 512,
    memory: 1024,
    enableAutoScaling: true,
    minCapacity: 2,
    maxCapacity: 10,
    targetCpuUtilization: 70,
    targetMemoryUtilization: 70
  }
});

// Example 3: Service with environment variables and secrets
new EcsServiceStack(app, 'AppWithEnvEcsService', {
  config: {
    vpcId: 'vpc-12345678',
    subnetIds: ['subnet-12345678', 'subnet-87654321'],
    clusterName: 'my-cluster',
    image: 'myapp:latest',
    serviceName: 'myapp-with-env',
    environment: {
      NODE_ENV: 'production',
      API_VERSION: 'v1',
      LOG_LEVEL: 'info'
    },
    secrets: {
      DB_PASSWORD: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:db-password',
      API_KEY: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:api-key'
    }
  }
});

// Example 4: Service using local Containerfile
new EcsServiceStack(app, 'LocalBuildEcsService', {
  config: {
    vpcId: 'vpc-12345678',
    subnetIds: ['subnet-12345678', 'subnet-87654321'],
    clusterName: 'my-cluster',
    image: './Containerfile',
    serviceName: 'local-build-service',
    containerPort: 3000,
    lbPort: 80
  }
});

app.synth(); 