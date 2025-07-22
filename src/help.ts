/**
 * Help system for @matson/ecs package
 * 
 * Shows all available context parameters and usage examples.
 * Follows 12-factor principles by using the same context parameter system.
 */

/**
 * Display comprehensive help information for the ECS deployment tool
 */
export function showHelp(): void {
  console.log(`
🚀 @matson/ecs - CDK Constructs for ECS Deployments

This package provides reusable CDK constructs for deploying ECS services
with Helm-style configuration using context parameters.

            📋 USAGE EXAMPLES
            ================

            Basic ECS Service Deployment (Context Parameters):
              AWS_PROFILE=dev cdk deploy \\
                --context vpcId=vpc-12345678 \\
                --context subnetIds=subnet-12345678,subnet-87654321 \\
                --context clusterName=my-cluster \\
                --context image=nginx:alpine

            Helm-style Values File Deployment:
              AWS_PROFILE=dev cdk deploy -c valuesFile=values.yaml

            Helm-style Values File with Overrides:
              AWS_PROFILE=dev cdk deploy -c valuesFile=values.yaml -c image=nginx:latest

With Custom Configuration:
  AWS_PROFILE=prod cdk deploy \\
    --context vpcId=vpc-12345678 \\
    --context subnetIds=subnet-12345678,subnet-87654321 \\
    --context clusterName=prod-cluster \\
    --context image=123456789012.dkr.ecr.us-west-2.amazonaws.com/myapp:latest \\
    --context serviceName=myapp-api \\
    --context desiredCount=3 \\
    --context cpu=512 \\
    --context memory=1024 \\
    --context enableAutoScaling=true \\
    --context minCapacity=2 \\
    --context maxCapacity=10

Using Local Containerfile:
  AWS_PROFILE=dev cdk deploy \\
    --context vpcId=vpc-12345678 \\
    --context subnetIds=subnet-12345678,subnet-87654321 \\
    --context clusterName=my-cluster \\
    --context image=./Containerfile

Using Values File (Helm-style):
  AWS_PROFILE=dev cdk deploy --values values.yaml

Using Values File with Overrides (Helm-style):
  AWS_PROFILE=dev cdk deploy --values values.yaml -c image=nginx:latest

📝 CONFIGURATION METHODS
========================

1. Context Parameters (-c):     cdk deploy -c key=value
2. Values File (-c valuesFile): cdk deploy -c valuesFile=values.yaml
3. Environment Variables:       export VPC_ID=vpc-12345678
4. Combined:                    cdk deploy -c valuesFile=values.yaml -c image=latest

📝 CONTEXT PARAMETERS
====================

REQUIRED PARAMETERS:
  vpcId                    VPC ID where the ECS service will be deployed
  subnetIds                Subnet IDs (comma-separated or array)
  clusterName              ECS cluster name
  image                    Container image URI or path to Containerfile

OPTIONAL PARAMETERS:
  serviceName              Service name (defaults to stack name)
  desiredCount             Number of tasks to run (default: 1)
  cpu                      CPU units for the task (default: 256)
  memory                   Memory in MiB for the task (default: 512)
  containerPort            Port that the container exposes (required)
  lbPort                   Load balancer port (required)
  healthCheckPath          Health check path (default: '/')
  allowedCidr              Allowed CIDR for ALB security group (default: '0.0.0.0/0')
  logRetentionDays         Log retention days (default: 7)
  enableAutoScaling        Whether to enable auto scaling (default: false)
  minCapacity              Minimum capacity for auto scaling (default: 1)
  maxCapacity              Maximum capacity for auto scaling (default: 10)
  targetCpuUtilization     Target CPU utilization for auto scaling (default: 70)
  targetMemoryUtilization  Target memory utilization for auto scaling (default: 70)
  taskExecutionRoleArn     Task execution role ARN (optional)
  taskRoleArn              Task role ARN (optional)
  valuesFile               Values file path for loading configuration from file
  
ADVANCED FEATURES:
  healthCheck              Container health check configuration
  resourceLimits           Container resource limits (cpu, memory)
  serviceDiscovery         Service discovery configuration
  capacityProvider         Capacity provider (FARGATE, FARGATE_SPOT)
  gracefulShutdown        Graceful shutdown configuration
  placementStrategies      Task placement strategies (manual configuration)

ENVIRONMENT VARIABLES:
  env:KEY=value            Environment variables for the container
  Example: --context env:NODE_ENV=production --context env:API_KEY=secret

SECRETS:
  secret:KEY=arn           Secrets for the container
  Example: --context secret:DB_PASSWORD=arn:aws:secretsmanager:region:account:secret:db-password

VALUES FILE FORMAT:
  JSON: values.json
  JavaScript: values.js
  YAML: values.yaml (requires js-yaml package)

📁 VALUES FILE EXAMPLE (values.json):
{
  "vpcId": "vpc-12345678",
  "subnetIds": ["subnet-12345678", "subnet-87654321"],
  "clusterName": "my-cluster",
  "image": "nginx:alpine",
  "serviceName": "myapp-api",
  "desiredCount": 2,
  "cpu": 512,
  "memory": 1024,
  "enableAutoScaling": true,
  "minCapacity": 1,
  "maxCapacity": 5,
  "environment": {
    "NODE_ENV": "production",
    "API_VERSION": "v1"
  }
}

🔧 DEPLOYMENT COMMANDS
======================

Show this help:
  cdk deploy --context help=true

Deploy to development:
  AWS_PROFILE=dev cdk deploy

Deploy to production:
  AWS_PROFILE=prod cdk deploy

Destroy stack:
  AWS_PROFILE=dev cdk destroy

List stacks:
  AWS_PROFILE=dev cdk list

📊 OUTPUTS
==========

The stack creates the following CloudFormation outputs:
  ServiceName              ECS Service Name
  LoadBalancerDNS          Load Balancer DNS Name
  ClusterName              ECS Cluster Name

🔒 SECURITY NOTES
================

- All configuration is done via context parameters (12-factor compliant)
- No hardcoded values or environment logic in the code
- Use AWS_PROFILE for environment detection
- Secrets should be stored in AWS Secrets Manager
- Environment variables are passed through context parameters

📚 MORE INFORMATION
==================

For more information, visit:
  https://github.com/matson/ecs-cdk

Report issues at:
  https://github.com/matson/ecs-cdk/issues
`);
} 