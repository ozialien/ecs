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

// 3. Validate that required structured configuration is present
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

app.synth(); 