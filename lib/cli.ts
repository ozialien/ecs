#!/usr/bin/env node

/**
 * Matson ECS CLI Wrapper
 * 
 * Simple drop-in replacement for CDK commands with enhanced credential support.
 * 
 * Usage:
 *   matson-ecs deploy --context vpcId=vpc-12345678 --context image=nginx:alpine
 *   matson-ecs deploy --profile prod --context vpcId=vpc-12345678
 *   matson-ecs deploy --role-arn arn:aws:iam::123456789012:role/DeployRole
 *   matson-ecs synth
 *   matson-ecs diff
 *   matson-ecs destroy
 */

import { spawn } from 'child_process';

// Get all arguments after the script name
const args = process.argv.slice(2);

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

// If no arguments provided, show help
if (args.length === 0) {
  console.error('❌ Error: No command specified.');
  console.error('');
  console.error('Usage:');
  console.error('  matson-ecs <cdk-command> [options]');
  console.error('');
  console.error('Examples:');
  console.error('  matson-ecs deploy --context vpcId=vpc-12345678 --context image=nginx:alpine');
  console.error('  matson-ecs deploy --profile prod --context vpcId=vpc-12345678');
  console.error('  matson-ecs deploy --role-arn arn:aws:iam::123456789012:role/DeployRole');
  console.error('  matson-ecs synth');
  console.error('  matson-ecs diff');
  console.error('  matson-ecs destroy');
  console.error('');
  console.error('Credential Options:');
  console.error('  --profile <name>     Use AWS profile for credentials');
  console.error('  --role-arn <arn>     Use IAM role for deployment');
  console.error('  --context awsProfile=<name>  Set AWS profile via context');
  console.error('  --context awsRoleArn=<arn>  Set IAM role via context');
  console.error('  --context awsAccessKeyId=<key> Set AWS access key via context');
  console.error('  --context awsSecretAccessKey=<secret> Set AWS secret key via context');
  console.error('  --context awsSessionToken=<token> Set AWS session token via context');
  console.error('');
  console.error('For more information, run: matson-ecs --help');
  process.exit(1);
}

// Add the CDK app entry point to all commands
const cdkArgs = ['-a', 'dist/bin/cdk.js', ...args];

// Spawn CDK process
const cdkProcess = spawn('cdk', cdkArgs, {
  stdio: 'inherit',
  shell: true
});

cdkProcess.on('close', (code) => {
  process.exit(code || 0);
});

cdkProcess.on('error', (error) => {
  console.error('❌ Error running CDK:', error.message);
  process.exit(1);
});

/**
 * Show comprehensive help information
 */
function showHelp(): void {
  console.log(`
🎯 Matson ECS - Helm-style ECS Deployment Utility

USAGE:
  matson-ecs <cdk-command> [options]

COMMANDS:
  deploy     Deploy ECS service stack
  synth      Synthesize CloudFormation template
  diff       Show differences between deployed and local stack
  destroy    Destroy ECS service stack
  list       List all stacks
  bootstrap  Bootstrap CDK toolkit

CREDENTIAL OPTIONS:
  --profile <name>              Use AWS profile for credentials
  --role-arn <arn>              Use IAM role for deployment
  --context awsProfile=<name>   Set AWS profile via context
  --context awsRoleArn=<arn>    Set IAM role via context
  --context awsAccessKeyId=<key> Set AWS access key via context
  --context awsSecretAccessKey=<secret> Set AWS secret key via context
  --context awsSessionToken=<token> Set AWS session token via context

EXAMPLES:

Basic Deployment:
  matson-ecs deploy \\
    --context vpcId=vpc-12345678 \\
    --context subnetIds=subnet-12345678,subnet-87654321 \\
    --context clusterName=my-cluster \\
    --context image=nginx:alpine \\
    --context containerPort=80 \\
    --context lbPort=80

With AWS Profile:
  matson-ecs deploy \\
    --profile prod \\
    --context vpcId=vpc-12345678 \\
    --context image=nginx:alpine \\
    --context containerPort=80 \\
    --context lbPort=80

With IAM Role:
  matson-ecs deploy \\
    --role-arn arn:aws:iam::123456789012:role/DeployRole \\
    --context vpcId=vpc-12345678 \\
    --context image=nginx:alpine \\
    --context containerPort=80 \\
    --context lbPort=80

With Values File:
  matson-ecs deploy \\
    --profile dev \\
    --context valuesFile=values-dev.yaml

With Explicit Credentials:
  matson-ecs deploy \\
    --context awsAccessKeyId=AKIAIOSFODNN7EXAMPLE \\
    --context awsSecretAccessKey=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \\
    --context vpcId=vpc-12345678 \\
    --context image=nginx:alpine \\
    --context containerPort=80 \\
    --context lbPort=80

Advanced Configuration:
  matson-ecs deploy \\
    --profile prod \\
    --context vpcId=vpc-12345678 \\
    --context image=123456789012.dkr.ecr.us-west-2.amazonaws.com/myapp:latest \\
    --context serviceName=myapp-api \\
    --context desiredCount=3 \\
    --context cpu=512 \\
    --context memory=1024 \\
    --context containerPort=8080 \\
    --context lbPort=80 \\
    --context enableAutoScaling=true \\
    --context minCapacity=2 \\
    --context maxCapacity=10

Other Commands:
  matson-ecs synth                    # Generate CloudFormation template
  matson-ecs diff                     # Show differences
  matson-ecs destroy                  # Destroy stack
  matson-ecs list                     # List all stacks

CREDENTIAL METHODS:

1. AWS Profile (Recommended):
   - Set AWS_PROFILE environment variable
   - Use --profile option
   - Use --context awsProfile=<name>

2. IAM Role:
   - Use --role-arn option
   - Use --context awsRoleArn=<arn>

3. Explicit Credentials:
   - Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY environment variables
   - Use AWS credentials file (~/.aws/credentials)
   - Use --context awsAccessKeyId=, --context awsSecretAccessKey=, --context awsSessionToken=

4. EC2 Instance Metadata:
   - Use --ec2creds option when running on EC2

VALUES FILE SUPPORT:
  matson-ecs deploy --context valuesFile=values.yaml

  Values file can be JSON, YAML, or JS format:
  - values.json (legacy flat format)
  - values.yaml (new structured ECS hierarchy format)
  - values.js

  The CDK supports both legacy flat format and new structured ECS hierarchy format.
  Structured format follows ECS object hierarchy: metadata, infrastructure, cluster, 
  taskDefinition, service, loadBalancer, autoScaling, iam, serviceDiscovery, addons.

CONTEXT PARAMETERS:
  All configuration is done via --context parameters:

LEGACY FLAT PARAMETERS (Backward Compatible):
  --context vpcId=<vpc-id>
  --context subnetIds=<subnet-ids>
  --context clusterName=<cluster-name>
  --context image=<image-uri>
  --context availabilityZones=<az1,az2,az3>
  --context containerPort=<port>
  --context lbPort=<port>
  --context serviceName=<service-name>
  --context desiredCount=<count>
  --context cpu=<cpu-units>
  --context memory=<memory-mib>
  --context enableAutoScaling=<true|false>
  --context minCapacity=<min>
  --context maxCapacity=<max>
  --context targetCpuUtilization=<percent>
  --context targetMemoryUtilization=<percent>
  --context healthCheckPath=<path>
  --context allowedCidr=<cidr>
  --context logRetentionDays=<days>
  --context taskExecutionRoleArn=<arn>
  --context taskRoleArn=<arn>

NEW STRUCTURED PARAMETERS (ECS Hierarchy):
  --context metadata=<json-object>
  --context infrastructure=<json-object>
  --context cluster=<json-object>
  --context taskDefinition=<json-object>
  --context service=<json-object>
  --context loadBalancer=<json-object>
  --context autoScaling=<json-object>
  --context iam=<json-object>
  --context serviceDiscovery=<json-object>
  --context addons=<json-object>

Note: Structured parameters are typically used in values files rather than individual -c options.

For detailed parameter documentation, run:
  matson-ecs deploy --context help=true
`);
} 