#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { EcsServiceStack } from '../lib/ecs-service-stack';
import { EcsServiceConfig } from '../lib/types';

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

// Start with empty config
let config: Partial<EcsServiceConfig> = {};

// 1. Load from values file FIRST if specified
const valuesFile = app.node.tryGetContext('valuesFile');
if (valuesFile) {
  const fs = require('fs');
  const path = require('path');
  
  if (fs.existsSync(valuesFile)) {
    try {
      const fileContent = fs.readFileSync(valuesFile, 'utf8');
      const ext = path.extname(valuesFile).toLowerCase();
      
      let values: any;
      try {
        switch (ext) {
          case '.js':
            values = require(path.resolve(valuesFile));
            break;
          case '.yaml':
          case '.yml':
            const yaml = require('js-yaml');
            values = yaml.load(fileContent);
            break;
          default:
            values = JSON.parse(fileContent);
        }
      } catch (error) {
        console.error(`❌ Error parsing values file ${valuesFile}: ${error}`);
        process.exit(1);
      }
      
      // Load values file into config
      config = { ...config, ...values };
      console.log(`📄 Loaded values from: ${valuesFile}`);
    } catch (error) {
      console.warn(`⚠️  Warning: Failed to parse values file ${valuesFile}: ${error}`);
    }
  } else {
    console.warn(`⚠️  Warning: Values file not found: ${valuesFile}`);
  }
}

// 2. Override with context parameters (highest precedence)
// Only override if the context parameter actually exists
const contextKeys = [
  'vpcId', 'subnetIds', 'clusterName', 'image', 'stackName', 'desiredCount', 
  'cpu', 'memory', 'containerPort', 'lbPort', 'healthCheckPath', 'allowedCidr',
  'env', 'secret', 'logGroupName', 'logRetentionDays', 'enableAutoScaling',
  'minCapacity', 'maxCapacity', 'targetCpuUtilization', 'targetMemoryUtilization',
  'taskExecutionRoleArn', 'taskRoleArn', 'taskRolePermissions', 'taskExecutionRolePermissions'
];

contextKeys.forEach(key => {
  const contextValue = app.node.tryGetContext(key);
  if (contextValue !== undefined) {
    // Handle special cases
    if (key === 'subnetIds' && typeof contextValue === 'string') {
      config.subnetIds = contextValue.split(',');
    } else if (key === 'env') {
      config.environment = contextValue;
    } else if (key === 'secret') {
      config.secrets = contextValue;
    } else {
      config[key as keyof EcsServiceConfig] = contextValue;
    }
  }
});

// 3. Fall back to environment variables (lowest precedence)
// Apply environment variable fallbacks directly to config
config.vpcId = config.vpcId || process.env.VPC_ID || '';
config.subnetIds = config.subnetIds || process.env.SUBNET_IDS?.split(',') || [];
config.clusterName = config.clusterName || process.env.CLUSTER_NAME || '';
config.image = config.image || process.env.IMAGE || '';
config.stackName = config.stackName || process.env.STACK_NAME || '';
config.desiredCount = config.desiredCount || parseInt(process.env.DESIRED_COUNT || '1');
config.cpu = config.cpu || parseInt(process.env.CPU || '256');
config.memory = config.memory || parseInt(process.env.MEMORY || '512');
config.containerPort = config.containerPort || parseInt(process.env.CONTAINER_PORT || '');
config.lbPort = config.lbPort || parseInt(process.env.LB_PORT || '');
config.healthCheckPath = config.healthCheckPath || process.env.HEALTH_CHECK_PATH || '/';
config.allowedCidr = config.allowedCidr || process.env.ALLOWED_CIDR || '0.0.0.0/0';
config.environment = config.environment || {};
config.secrets = config.secrets || {};
config.logGroupName = config.logGroupName || process.env.LOG_GROUP_NAME;
config.logRetentionDays = config.logRetentionDays || parseInt(process.env.LOG_RETENTION_DAYS || '7');
config.enableAutoScaling = config.enableAutoScaling || process.env.ENABLE_AUTO_SCALING === 'true';
config.minCapacity = config.minCapacity || parseInt(process.env.MIN_CAPACITY || '1');
config.maxCapacity = config.maxCapacity || parseInt(process.env.MAX_CAPACITY || '3');
config.targetCpuUtilization = config.targetCpuUtilization || parseInt(process.env.TARGET_CPU_UTILIZATION || '70');
config.targetMemoryUtilization = config.targetMemoryUtilization || parseInt(process.env.TARGET_MEMORY_UTILIZATION || '70');
config.taskExecutionRoleArn = config.taskExecutionRoleArn || process.env.TASK_EXECUTION_ROLE_ARN;
config.taskRoleArn = config.taskRoleArn || process.env.TASK_ROLE_ARN;

// Validate required parameters
const requiredParams = ['vpcId', 'subnetIds', 'clusterName', 'image', 'stackName', 'containerPort', 'lbPort'];
for (const param of requiredParams) {
  if (!config[param as keyof EcsServiceConfig]) {
    console.error(`❌ Error: Required parameter '${param}' is missing.`);
    console.error('   Use -c parameter, values file, or set environment variable.');
    console.error('');
    console.error('Examples:');
    console.error('  cdk deploy -c vpcId=vpc-12345678 -c image=nginx:alpine');
    console.error('  cdk deploy -c valuesFile=values.yaml');
    process.exit(1);
  }
}

// Validate parameter formats
if (config.vpcId && !config.vpcId.startsWith('vpc-')) {
  console.error('❌ Error: Invalid VPC ID format. Must start with "vpc-"');
  process.exit(1);
}

if (config.subnetIds && Array.isArray(config.subnetIds)) {
  for (const subnetId of config.subnetIds) {
    if (!subnetId.startsWith('subnet-')) {
      console.error(`❌ Error: Invalid subnet ID format: ${subnetId}. Must start with "subnet-"`);
      process.exit(1);
    }
  }
}

if (config.containerPort && (config.containerPort < 1 || config.containerPort > 65535)) {
  console.error('❌ Error: Invalid container port. Must be between 1 and 65535');
  process.exit(1);
}

if (config.lbPort && (config.lbPort < 1 || config.lbPort > 65535)) {
  console.error('❌ Error: Invalid load balancer port. Must be between 1 and 65535');
  process.exit(1);
}

// Create the ECS service stack using stack name
new EcsServiceStack(app, config.stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  config: config as EcsServiceConfig,
});

app.synth(); 