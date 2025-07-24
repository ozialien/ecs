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

The CDK supports both legacy flat parameters and new structured ECS hierarchy parameters:

LEGACY FLAT PARAMETERS (Backward Compatible):
REQUIRED PARAMETERS:
  vpcId                    VPC ID where the ECS service will be deployed
  subnetIds                Subnet IDs (comma-separated or array)
  clusterName              ECS cluster name
  image                    Container image URI or path to Containerfile

OPTIONAL PARAMETERS:
  serviceName              Service name (defaults to stack name)
  availabilityZones        Availability zones for VPC import (default: us-west-2a,us-west-2b,us-west-2c)
  desiredCount             Number of tasks to run (default: 1)
  cpu                      CPU units for the task (default: 256)
  memory                   Memory in MiB for the task (default: 512)
  containerPort            Port that the container exposes (required)
  lbPort                   Load balancer port (required)
  healthCheckPath          Health check path (default: '/')
  loadBalancerHealthCheck  Load balancer health check configuration
  allowedCidr              Allowed CIDR for ALB security group (default: '0.0.0.0/0')
  logRetentionDays         Log retention days (default: 7)
  enableAutoScaling        Whether to enable auto scaling (default: false)
  minCapacity              Minimum capacity for auto scaling (default: 1)
  maxCapacity              Maximum capacity for auto scaling (default: 10)
  targetCpuUtilization     Target CPU utilization for auto scaling (default: 70)
  targetMemoryUtilization  Target memory utilization for auto scaling (default: 70)
  taskExecutionRoleArn     Task execution role ARN (optional)
  taskRoleArn              Task role ARN (optional)
  taskRolePermissions      IAM permissions for task role (optional)
  taskExecutionRolePermissions IAM permissions for task execution role (optional)
  valuesFile               Values file path for loading configuration from file

NEW STRUCTURED PARAMETERS (ECS Hierarchy):
  metadata                 Metadata section (name, version, description)
  infrastructure           Infrastructure section (vpc, securityGroups)
  cluster                  ECS cluster configuration
  taskDefinition           Task definition with containers and resources
  service                  ECS service configuration
  loadBalancer             Load balancer configuration
  autoScaling              Auto scaling configuration
  iam                      IAM roles and permissions
  serviceDiscovery         Service discovery configuration
  addons                   Add-ons (logging, monitoring, etc.)

Note: Structured parameters are typically used in values files rather than individual -c options.

📋 STRUCTURED VALUES FILE FORMAT
===============================

The CDK supports both legacy flat format and new structured ECS hierarchy format:

LEGACY FLAT FORMAT (Backward Compatible):
  {
    "vpcId": "vpc-12345678",
    "subnetIds": ["subnet-12345678", "subnet-87654321"],
    "clusterName": "my-cluster",
    "image": "nginx:alpine",
    "cpu": 256,
    "memory": 512
  }

NEW STRUCTURED FORMAT (ECS Hierarchy):
  metadata:
    name: "my-service"
    version: "1.0.0"
  
  infrastructure:
    vpc:
      id: "vpc-12345678"
      subnets: ["subnet-12345678", "subnet-87654321"]
  
  cluster:
    name: "my-cluster"
    containerInsights: true
  
  taskDefinition:
    type: "FARGATE"
    cpu: 256
    memory: 512
    containers:
      - name: "app"
        image: "nginx:alpine"
        portMappings:
          - containerPort: 80
  
  service:
    type: "LOAD_BALANCED"
    desiredCount: 2
  
  loadBalancer:
    type: "APPLICATION"
    port: 80
    targetGroup:
      healthCheckPath: "/health"
  
  autoScaling:
    enabled: true
    minCapacity: 2
    maxCapacity: 10
  
ADVANCED FEATURES:
  healthCheck              Container health check configuration
  loadBalancerHealthCheck  Load balancer health check configuration
  resourceLimits           Container resource limits (cpu, memory)
  serviceDiscovery         Service discovery configuration
  capacityProvider         Capacity provider (FARGATE, FARGATE_SPOT)
  gracefulShutdown        Graceful shutdown configuration
  placementStrategies      Task placement strategies (manual configuration)

FEATURE ENABLEMENT:
  All optional features support explicit enabled: true|false
  Example: --context healthCheck='{"enabled":false}' to disable health checks

ENVIRONMENT VARIABLES:
  env:KEY=value            Environment variables for the container
  Example: --context env:NODE_ENV=production --context env:API_KEY=secret

SECRETS:
  secret:KEY=arn           Secrets for the container
  Example: --context secret:DB_PASSWORD=arn:aws:secretsmanager:region:account:secret:db-password

IAM PERMISSIONS:
  taskRolePermissions       IAM permissions for task role (from values file)
  taskExecutionRolePermissions  IAM permissions for task execution role (from values file)
  Example: Define in values.yaml file (see examples/values-matsonlabs.yaml)

VALUES FILE FORMAT:
  JSON: values.json
  JavaScript: values.js
  YAML: values.yaml (requires js-yaml package)

📁 VALUES FILE EXAMPLES:

LEGACY FORMAT (values.json):
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

NEW STRUCTURED FORMAT (values.yaml):
metadata:
  name: "myapp-api"
  version: "1.0.0"

infrastructure:
  vpc:
    id: "vpc-12345678"
    subnets: ["subnet-12345678", "subnet-87654321"]

cluster:
  name: "my-cluster"
  containerInsights: true

taskDefinition:
  type: "FARGATE"
  cpu: 512
  memory: 1024
  containers:
    - name: "app"
      image: "nginx:alpine"
      portMappings:
        - containerPort: 80
      environment:
        - name: "NODE_ENV"
          value: "production"
        - name: "API_VERSION"
          value: "v1"

service:
  type: "LOAD_BALANCED"
  desiredCount: 2

loadBalancer:
  type: "APPLICATION"
  port: 80
  targetGroup:
    healthCheckPath: "/health"

autoScaling:
  enabled: true
  minCapacity: 1
  maxCapacity: 5

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