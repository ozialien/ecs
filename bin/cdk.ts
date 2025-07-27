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
  console.log(`Values file specified: ${valuesFile}`);
  // Load values from file
  const fs = require('fs');
  const path = require('path');
  const yaml = require('js-yaml');
  
  const filePath = path.resolve(valuesFile);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: Values file not found: ${filePath}`);
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const values = yaml.load(fileContent);
  
  // Merge values into config
  config = { ...config, ...values };
}

// 2. Override with context parameters (highest precedence)
// Only override if the context parameter actually exists
const contextKeys = [
  // Structured parameters (ECS hierarchy)
  'metadata', 'infrastructure', 'cluster', 'taskDefinition', 'service', 'loadBalancer', 'autoScaling', 'iam', 'serviceDiscovery', 'addons'
];

contextKeys.forEach(key => {
  const contextValue = app.node.tryGetContext(key);
  if (contextValue !== undefined) {
    // Structured parameters only
    config[key as keyof EcsServiceConfig] = contextValue;
  }
});

// 3. Check for help request before validation
const help = app.node.tryGetContext('help');
if (help === 'true' || help === true) {
  // Create stack with minimal config for help display
  new EcsServiceStack(app, 'HelpStack', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    config: { metadata: { name: 'help', version: '1.0.0' } } as EcsServiceConfig,
  });
} else {
  // Validate that required structured configuration is present
  // The CDK stack will handle validation of required parameters
  if (!config.infrastructure?.vpc?.id) {
    console.error('❌ Error: Required infrastructure.vpc.id is missing.');
    console.error('   Use values file or structured context parameters.');
    console.error('');
    console.error('Examples:');
    console.error('  cdk deploy -c valuesFile=values.yaml');
    console.error('  cdk deploy -c infrastructure.vpc.id=vpc-12345678');
    process.exit(1);
  }
  
  // Create the ECS service stack using metadata name or default
  const stackName = config.metadata?.name || 'EcsServiceStack';
  new EcsServiceStack(app, stackName, {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    config: config as EcsServiceConfig,
  });
}

app.synth(); 