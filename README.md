# @matson/ecs

CDK constructs for ECS deployments with Helm-style configuration.

## Overview

This package provides reusable CDK constructs for deploying ECS services with a Helm-style approach using context parameters. All configuration is externalized following 12-factor app principles.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @matson/ecs
```

This installs the `matson-ecs` CLI command globally.

### Local Installation

```bash
npm install @matson/ecs
```

## Quick Start

```typescript
import { EcsServiceStack } from '@matson/ecs';
import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();

new EcsServiceStack(app, 'MyEcsService', {
  config: {
    vpcId: 'vpc-12345678',
    subnetIds: ['subnet-12345678', 'subnet-87654321'],
    clusterName: 'my-cluster',
    image: 'nginx:alpine'
  }
});

app.synth();
```

## Usage

### CLI Usage (Global Installation)

```bash
# Basic deployment
matson-ecs deploy \
  --context vpcId=vpc-12345678 \
  --context subnetIds=subnet-12345678,subnet-87654321 \
  --context clusterName=my-cluster \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80

# With AWS profile
matson-ecs deploy \
  --profile prod \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80

# With IAM role
matson-ecs deploy \
  --role-arn arn:aws:iam::123456789012:role/DeployRole \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80

# With values file
matson-ecs deploy --context valuesFile=values.yaml

# With credentials via context
matson-ecs deploy \
  --context awsProfile=prod \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80

# Show help
matson-ecs --help
```

### CDK Usage (Local Installation)

### Basic Deployment

```bash
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context subnetIds=subnet-12345678,subnet-87654321 \
  --context clusterName=my-cluster \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80
```

### Advanced Configuration

```bash
AWS_PROFILE=prod cdk deploy \
  --context vpcId=vpc-12345678 \
  --context subnetIds=subnet-12345678,subnet-87654321 \
  --context clusterName=prod-cluster \
  --context image=123456789012.dkr.ecr.us-west-2.amazonaws.com/myapp:latest \
  --context serviceName=myapp-api \
  --context desiredCount=3 \
  --context cpu=512 \
  --context memory=1024 \
  --context containerPort=8080 \
  --context lbPort=80 \
  --context enableAutoScaling=true \
  --context minCapacity=2 \
  --context maxCapacity=10
```

### Helm-style Values File Deployment

Create a `values.yaml` file:

```yaml
vpcId: vpc-12345678
subnetIds: 
  - subnet-12345678
  - subnet-87654321
clusterName: my-cluster
image: nginx:alpine
containerPort: 80
lbPort: 80
serviceName: myapp-api
desiredCount: 2
cpu: 512
memory: 1024
enableAutoScaling: true
minCapacity: 1
maxCapacity: 5
environment:
  NODE_ENV: production
  API_VERSION: v1
```

Then deploy using Helm-style syntax:

```bash
# Values file only
AWS_PROFILE=dev cdk deploy -c valuesFile=values.yaml

# Values file with overrides (Helm-style)
AWS_PROFILE=dev cdk deploy -c valuesFile=values.yaml -c image=nginx:latest
```

### Legacy Context-based Values File

You can also use the legacy context parameter approach:

```bash
AWS_PROFILE=dev cdk deploy -c valuesFile=values.json
```

### Structured Helm-like Configuration (New!)

The CDK now supports a structured, Helm-like configuration format that maps directly to ECS/AWS resource hierarchies. This provides better organization and readability:

```yaml
# values-structured.yaml
metadata:
  name: "my-service"
  version: "1.0.0"
  description: "Example ECS Service"

infrastructure:
  vpc:
    id: "vpc-12345678"
    subnets: ["subnet-12345678", "subnet-87654321"]

compute:
  type: "FARGATE"
  cpu: 512
  memory: 1024

containers:
  - name: "main"
    image: "nginx:alpine"
    portMappings:
      - containerPort: 80
        protocol: "tcp"
    environment:
      - name: "NODE_ENV"
        value: "production"

service:
  type: "LOAD_BALANCED"
  clusterName: "my-cluster"
  desiredCount: 2
  loadBalancer:
    type: "APPLICATION"
    scheme: "internet-facing"
    protocol: "HTTP"
    port: 80
    targetGroup:
      healthCheckPath: "/"
      interval: 30
      timeout: 5

addons:
  logging:
    driver: "awslogs"
    retentionDays: 7
  autoScaling:
    enabled: true
    minCapacity: 1
    maxCapacity: 5
    targetCpuUtilization: 70
```

Deploy with structured configuration:

```bash
# Structured format
AWS_PROFILE=dev cdk deploy -c valuesFile=values-structured.yaml

# Structured format with overrides
AWS_PROFILE=dev cdk deploy -c valuesFile=values-structured.yaml -c image=nginx:latest
```

**Benefits of Structured Format:**
- **Helm-like organization** - Familiar to Kubernetes users
- **ECS hierarchy mapping** - Direct correlation to AWS resources
- **Better readability** - Clear separation of concerns
- **Enhanced maintainability** - Easy to modify specific components
- **Backward compatibility** - Existing flat format still works

### Using Local Containerfile

```bash
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context subnetIds=subnet-12345678,subnet-87654321 \
  --context clusterName=my-cluster \
  --context image=./Containerfile \
  --context containerPort=80 \
  --context lbPort=80
```

## Configuration

### Configuration Format Comparison

The CDK supports two configuration formats:

#### Legacy Flat Format (Backward Compatible)
```yaml
# values-legacy.yaml
vpcId: vpc-12345678
subnetIds: subnet-12345678,subnet-87654321
clusterName: my-cluster
image: nginx:alpine
containerPort: 80
lbPort: 80
desiredCount: 2
cpu: 512
memory: 1024
```

#### Structured Helm-like Format (New)
```yaml
# values-structured.yaml
metadata:
  name: "my-service"
  version: "1.0.0"

infrastructure:
  vpc:
    id: "vpc-12345678"
    subnets: ["subnet-12345678", "subnet-87654321"]

compute:
  type: "FARGATE"
  cpu: 512
  memory: 1024

containers:
  - name: "main"
    image: "nginx:alpine"
    portMappings:
      - containerPort: 80
        protocol: "tcp"

service:
  type: "LOAD_BALANCED"
  clusterName: "my-cluster"
  desiredCount: 2
```

**Both formats work seamlessly** - the CDK automatically detects and converts between formats as needed.

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `vpcId` | VPC ID where the ECS service will be deployed | `vpc-12345678` |
| `subnetIds` | Subnet IDs (comma-separated or array) | `subnet-12345678,subnet-87654321` |
| `clusterName` | ECS cluster name | `my-cluster` |
| `image` | Container image URI or path to Containerfile | `nginx:alpine` |
| `containerPort` | Port that the container exposes | `80` |
| `lbPort` | Load balancer port | `80` |

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `serviceName` | Stack name | Service name |

| `desiredCount` | 1 | Number of tasks to run |
| `cpu` | 256 | CPU units for the task |
| `memory` | 512 | Memory in MiB for the task |
| `containerPort` | **Required** | Port that the container exposes |
| `lbPort` | **Required** | Load balancer port |
| `healthCheckPath` | `/` | Health check path |
| `allowedCidr` | `0.0.0.0/0` | Allowed CIDR for ALB security group |
| `logRetentionDays` | 7 | Log retention days |
| `enableAutoScaling` | false | Whether to enable auto scaling |
| `minCapacity` | 1 | Minimum capacity for auto scaling |
| `maxCapacity` | 10 | Maximum capacity for auto scaling |
| `targetCpuUtilization` | 70 | Target CPU utilization for auto scaling |
| `targetMemoryUtilization` | 70 | Target memory utilization for auto scaling |
| `taskExecutionRoleArn` | - | Task execution role ARN |
| `taskRoleArn` | - | Task role ARN |
| `taskRolePermissions` | - | IAM permissions for task role |
| `taskExecutionRolePermissions` | - | IAM permissions for task execution role |
| `valuesFile` | - | Values file path |

### Structured Configuration Sections

When using the structured format, configuration is organized into logical sections:

#### Metadata Section
```yaml
metadata:
  name: "my-service"
  version: "1.0.0"
  description: "Example ECS Service"
```

#### Infrastructure Section
```yaml
infrastructure:
  vpc:
    id: "vpc-12345678"
    subnets: ["subnet-12345678", "subnet-87654321"]
  securityGroups:
    - name: "app-sg"
      rules:
        - port: 80
          cidr: "0.0.0.0/0"
```

#### Compute Section
```yaml
compute:
  type: "FARGATE"
  cpu: 512
  memory: 1024
  runtimePlatform:
    cpuArchitecture: "X86_64"
    os: "LINUX"
```

#### Containers Section
```yaml
containers:
  - name: "main"
    image: "nginx:alpine"
    portMappings:
      - containerPort: 80
        protocol: "tcp"
    environment:
      - name: "NODE_ENV"
        value: "production"
    healthCheck:
      command: ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]
      interval: 30
      timeout: 5
```

#### Service Section
```yaml
service:
  type: "LOAD_BALANCED"
  clusterName: "my-cluster"
  desiredCount: 2
  loadBalancer:
    type: "APPLICATION"
    scheme: "internet-facing"
    protocol: "HTTP"
    port: 80
    targetGroup:
      healthCheckPath: "/"
      interval: 30
      timeout: 5
  deployment:
    strategy: "ROLLING"
    minimumHealthyPercent: 100
    maximumPercent: 200
```

#### IAM Section
```yaml
iam:
  taskRole:
    policies:
      - name: "s3-access"
        actions:
          - "s3:GetObject"
          - "s3:PutObject"
        resources: ["arn:aws:s3:::my-bucket/*"]
  taskExecutionRole:
    policies:
      - name: "ecr-access"
        actions:
          - "ecr:GetAuthorizationToken"
          - "ecr:BatchGetImage"
        resources: ["*"]
```

#### Add-ons Section
```yaml
addons:
  logging:
    driver: "awslogs"
    retentionDays: 7
  monitoring:
    enableCloudWatchAlarms: true
    enableXRay: false
  autoScaling:
    enabled: true
    minCapacity: 1
    maxCapacity: 5
    targetCpuUtilization: 70
```

### Environment Variables

```bash
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context subnetIds=subnet-12345678,subnet-87654321 \
  --context clusterName=my-cluster \
  --context image=nginx:alpine \
  --context env:NODE_ENV=production \
  --context env:API_KEY=secret
```

### Secrets

```bash
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context subnetIds=subnet-12345678,subnet-87654321 \
  --context clusterName=my-cluster \
  --context image=nginx:alpine \
  --context secret:DB_PASSWORD=arn:aws:secretsmanager:region:account:secret:db-password
```

### IAM Permissions

Configure IAM permissions for ECS tasks via values files. Common permissions include:

#### Task Role Permissions (Application-level permissions)
- **Secrets Manager**: Access to secrets and configuration
- **CloudWatch Logs**: Create and write application logs
- **KMS**: Decrypt encrypted secrets and data
- **STS**: Assume roles for cross-account access
- **S3**: Read/write application data
- **SQS/SNS**: Message queue operations
- **DynamoDB**: Database operations
- **RDS**: Database connections
- **CloudWatch Metrics**: Application metrics

#### Task Execution Role Permissions (Infrastructure-level permissions)
- **ECR**: Pull container images
- **Secrets Manager**: Access secrets during container startup
- **CloudWatch Logs**: Write container logs
- **SSM Parameter Store**: Access configuration parameters
- **CloudWatch Metrics**: Infrastructure metrics

```yaml
# values.yaml
taskRolePermissions:
  secretsManager:
    actions:
      - secretsmanager:GetSecretValue
      - secretsmanager:DescribeSecret
      - secretsmanager:GetResourcePolicy
    resources:
      - arn:aws:secretsmanager:us-west-2:123456789012:secret:*
  cloudWatchLogs:
    actions:
      - logs:CreateLogGroup
      - logs:CreateLogStream
      - logs:PutLogEvents
      - logs:DescribeLogStreams
    resources:
      - "*"
  kms:
    actions:
      - kms:Decrypt
      - kms:DescribeKey
    resources:
      - arn:aws:kms:us-west-2:123456789012:key:*
  s3:
    actions:
      - s3:GetObject
      - s3:PutObject
      - s3:DeleteObject
      - s3:ListBucket
    resources:
      - arn:aws:s3:::my-app-bucket
      - arn:aws:s3:::my-app-bucket/*
  sqs:
    actions:
      - sqs:SendMessage
      - sqs:ReceiveMessage
      - sqs:DeleteMessage
    resources:
      - arn:aws:sqs:us-west-2:123456789012:*
  dynamodb:
    actions:
      - dynamodb:GetItem
      - dynamodb:PutItem
      - dynamodb:UpdateItem
      - dynamodb:DeleteItem
      - dynamodb:Query
      - dynamodb:Scan
    resources:
      - arn:aws:dynamodb:us-west-2:123456789012:table/*

taskExecutionRolePermissions:
  ecr:
    actions:
      - ecr:GetAuthorizationToken
      - ecr:BatchCheckLayerAvailability
      - ecr:GetDownloadUrlForLayer
      - ecr:BatchGetImage
    resources:
      - "*"
  secretsManager:
    actions:
      - secretsmanager:GetSecretValue
    resources:
      - arn:aws:secretsmanager:us-west-2:123456789012:secret:*
  cloudWatchLogs:
    actions:
      - logs:CreateLogStream
      - logs:PutLogEvents
    resources:
      - "*"
  ssm:
    actions:
      - ssm:GetParameter
      - ssm:GetParameters
      - ssm:GetParametersByPath
    resources:
      - arn:aws:ssm:us-west-2:123456789012:parameter/*

## Migration from Legacy to Structured Format

The CDK automatically detects and converts between configuration formats. To migrate from legacy to structured format:

### Automatic Migration
The CDK will automatically convert your existing flat configuration to structured format when you use the structured format. No manual conversion is required.

### Manual Migration Example

**Legacy Format:**
```yaml
# values-legacy.yaml
vpcId: vpc-12345678
subnetIds: subnet-12345678,subnet-87654321
clusterName: my-cluster
image: nginx:alpine
containerPort: 80
lbPort: 80
desiredCount: 2
cpu: 512
memory: 1024
environment:
  NODE_ENV: production
enableAutoScaling: true
minCapacity: 1
maxCapacity: 5
```

**Structured Format:**
```yaml
# values-structured.yaml
metadata:
  name: "my-service"
  version: "1.0.0"

infrastructure:
  vpc:
    id: "vpc-12345678"
    subnets: ["subnet-12345678", "subnet-87654321"]

compute:
  type: "FARGATE"
  cpu: 512
  memory: 1024

containers:
  - name: "main"
    image: "nginx:alpine"
    portMappings:
      - containerPort: 80
        protocol: "tcp"
    environment:
      - name: "NODE_ENV"
        value: "production"

service:
  type: "LOAD_BALANCED"
  clusterName: "my-cluster"
  desiredCount: 2
  loadBalancer:
    type: "APPLICATION"
    scheme: "internet-facing"
    protocol: "HTTP"
    port: 80

addons:
  autoScaling:
    enabled: true
    minCapacity: 1
    maxCapacity: 5
    targetCpuUtilization: 70
```

### Benefits of Migration
- **Better organization** - Related settings grouped together
- **Enhanced readability** - Clear hierarchy and structure
- **Easier maintenance** - Modify specific components without affecting others
- **Future-proof** - Ready for advanced features and capabilities

## Help

Show comprehensive help and usage examples:

```bash
cdk deploy --context help=true
```

## Features

### Core Features
- **Helm-style configuration**: All configuration via context parameters
- **12-factor compliant**: No hardcoded values or environment logic in code
- **Multiple image sources**: Support for ECR, external registries, and local Containerfiles
- **Auto scaling**: Configurable CPU and memory-based auto scaling
- **Values files**: Support for JSON, JavaScript, and YAML configuration files
- **Environment variables**: Pass environment variables to containers
- **Secrets integration**: Integrate with AWS Secrets Manager
- **Comprehensive logging**: CloudWatch Logs integration
- **Security groups**: Configurable network security
- **Load balancer**: Application Load Balancer integration

### Advanced Features

#### Container Health Checks
Configure container-level health checks for production reliability:

```bash
# Basic health check
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80 \
  --context healthCheck='{"command":["CMD-SHELL","curl -f http://localhost:80/ || exit 1"],"interval":30,"timeout":5,"startPeriod":60,"retries":3}'

# Disable health checks explicitly
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80 \
  --context healthCheck='{"enabled":false}'
```

#### Resource Limits
Set container-level CPU and memory limits:

```bash
# Container resource limits
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80 \
  --context resourceLimits='{"cpu":256,"memory":512}'
```

#### Service Discovery
Enable AWS Cloud Map service discovery for microservices:

```bash
# Service discovery configuration
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80 \
  --context serviceDiscovery='{"namespace":"myapp.local","serviceName":"api","dnsType":"A","ttl":10}'
```

#### Capacity Providers

### Credential Support

The CLI supports multiple AWS credential methods:

#### 1. AWS Profile (Recommended)
```bash
# Set environment variable
export AWS_PROFILE=prod
matson-ecs deploy --context vpcId=vpc-12345678

# Use --profile option
matson-ecs deploy --profile prod --context vpcId=vpc-12345678

# Use context parameter
matson-ecs deploy --context awsProfile=prod --context vpcId=vpc-12345678
```

#### 2. IAM Role
```bash
# Use --role-arn option
matson-ecs deploy --role-arn arn:aws:iam::123456789012:role/DeployRole --context vpcId=vpc-12345678

# Use context parameter
matson-ecs deploy --context awsRoleArn=arn:aws:iam::123456789012:role/DeployRole --context vpcId=vpc-12345678
```

#### 3. Explicit Credentials
```bash
# Set environment variables
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
matson-ecs deploy --context vpcId=vpc-12345678

# Use context parameters
matson-ecs deploy \
  --context awsAccessKeyId=AKIAIOSFODNN7EXAMPLE \
  --context awsSecretAccessKey=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  --context awsSessionToken=AQoEXAMPLEH4aoAH0gNCAPyJxzrBlXWt6TresKlOLb8vPBrIwT \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80
```

#### 4. EC2 Instance Metadata
```bash
# Use --ec2creds option when running on EC2
matson-ecs deploy --ec2creds --context vpcId=vpc-12345678
```
Optimize costs with FARGATE_SPOT capacity provider:

```bash
# Use spot instances for cost optimization
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context containerPort=80 \
  --context lbPort=80 \
  --context capacityProvider=FARGATE_SPOT
```

#### Task Placement Strategies
Configure task placement for high availability and cost optimization:

```bash
# Manual configuration via AWS CLI after deployment
aws ecs update-service --cluster my-cluster --service my-service \
  --placement-strategy type=spread,field=attribute:ecs.availability-zone

# Or use binpack for resource optimization
aws ecs update-service --cluster my-cluster --service my-service \
  --placement-strategy type=binpack,field=attribute:ecs.cpu
```

#### Graceful Shutdown
ECS handles graceful shutdown automatically, but you can configure it via AWS CLI:

```bash
# Configure graceful shutdown
aws ecs update-service --cluster my-cluster --service my-service \
  --deployment-configuration maximumPercent=200,minimumHealthyPercent=100
```

## Architecture

The package creates the following AWS resources:

### Core Resources
- **ECS Cluster**: Imported or created cluster
- **Task Definition**: Fargate task definition with container
- **ECS Service**: Fargate service with load balancer
- **Application Load Balancer**: HTTP/HTTPS load balancer
- **Target Group**: Load balancer target group
- **Security Groups**: Network security for ALB and ECS tasks
- **CloudWatch Log Group**: Logging for the ECS service
- **Auto Scaling**: Optional auto scaling based on CPU/memory
- **IAM Roles**: Task execution and task roles (optional)

### Advanced Resources (Optional)
- **Service Discovery**: AWS Cloud Map namespace and service (if configured)
- **Container Health Checks**: Container-level health monitoring
- **Resource Limits**: Container-level CPU and memory constraints
- **Capacity Providers**: FARGATE or FARGATE_SPOT capacity optimization
- **Placement Strategies**: Task placement configuration (manual)

## Outputs

The stack creates the following CloudFormation outputs:

- `ServiceName`: ECS Service Name
- `LoadBalancerDNS`: Load Balancer DNS Name
- `ClusterName`: ECS Cluster Name

## Development

### Prerequisites

- Node.js 18+
- AWS CDK 2.x
- AWS CLI configured

### Setup

```bash
git clone https://github.com/matson/ecs-cdk.git
cd ecs-cdk
npm install
npm run build
```

### Testing

```bash
npm test
```

### Building

```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

- [GitHub Issues](https://github.com/matson/ecs-cdk/issues)
- [Documentation](https://github.com/matson/ecs-cdk#readme) 