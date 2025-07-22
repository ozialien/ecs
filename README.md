# @matson/ecs

CDK constructs for ECS deployments with Helm-style configuration.

## Overview

This package provides reusable CDK constructs for deploying ECS services with a Helm-style approach using context parameters. All configuration is externalized following 12-factor app principles.

## Installation

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

### Basic Deployment

```bash
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context subnetIds=subnet-12345678,subnet-87654321 \
  --context clusterName=my-cluster \
  --context image=nginx:alpine
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

### Using Local Containerfile

```bash
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context subnetIds=subnet-12345678,subnet-87654321 \
  --context clusterName=my-cluster \
  --context image=./Containerfile
```

## Configuration

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `vpcId` | VPC ID where the ECS service will be deployed | `vpc-12345678` |
| `subnetIds` | Subnet IDs (comma-separated or array) | `subnet-12345678,subnet-87654321` |
| `clusterName` | ECS cluster name | `my-cluster` |
| `image` | Container image URI or path to Containerfile | `nginx:alpine` |

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `serviceName` | Stack name | Service name |
| `desiredCount` | 1 | Number of tasks to run |
| `cpu` | 256 | CPU units for the task |
| `memory` | 512 | Memory in MiB for the task |
| `containerPort` | 80 | Port that the container exposes |
| `lbPort` | 80 | Load balancer port |
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
| `valuesFile` | - | Values file path |

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
  --context healthCheck='{"command":["CMD-SHELL","curl -f http://localhost:80/ || exit 1"],"interval":30,"timeout":5,"startPeriod":60,"retries":3}'
```

#### Resource Limits
Set container-level CPU and memory limits:

```bash
# Container resource limits
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context resourceLimits='{"cpu":256,"memory":512}'
```

#### Service Discovery
Enable AWS Cloud Map service discovery for microservices:

```bash
# Service discovery configuration
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
  --context serviceDiscovery='{"namespace":"myapp.local","serviceName":"api","dnsType":"A","ttl":10}'
```

#### Capacity Providers
Optimize costs with FARGATE_SPOT capacity provider:

```bash
# Use spot instances for cost optimization
AWS_PROFILE=dev cdk deploy \
  --context vpcId=vpc-12345678 \
  --context image=nginx:alpine \
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