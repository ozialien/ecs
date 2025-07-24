# ECS Deployment Tool

A simple CloudFormation template transformation utility for ECS deployments.

## Overview

This tool provides a **template transformation approach** to ECS deployments:

1. **Baseline Template**: `cf/ecs-deployment-template.yaml` - Generic, parameterized template
2. **Values File**: `examples/casscheduler-values.yaml` - Environment-specific values
3. **Transform**: Convert baseline + values → deployable CloudFormation
4. **Deploy**: Use AWS CLI to deploy the final template

## Process Flow

```
cf/ecs-deployment-template.yaml + examples/casscheduler-values.yaml → output/deployable.yaml → AWS CloudFormation
```

## Quick Start

### Option 1: Simple Transformation (Recommended)
```bash
# Transform the baseline template with values
npm run transform:example

# Or manually specify files
npm run transform cf/ecs-deployment-template.yaml values/values.yaml output/my-deployable.yaml

# Deploy the transformed template
aws cloudformation deploy \
  --template-file output/deployable.yaml \
  --stack-name my-ecs-stack \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
```

### Option 2: AWS CLI-Based Transformation
```bash
# Transform with AWS CLI validation
npm run transform-aws:example

# Or manually specify files
npm run transform-aws cf/ecs-deployment-template.yaml values/values.yaml output/deployable.yaml

# Deploy using the deployment script
npm run deploy-aws output/deployable.yaml my-stack --capabilities CAPABILITY_IAM
```

## File Structure

```
├── cf/
│   └── ecs-deployment-template.yaml    # Baseline parameterized template
├── examples/
│   ├── cf/
│   │   └── CASSChedulerAdmin.yaml     # Original working template
│   └── casscheduler-values.yaml        # Values for CASSchedulerAdmin
├── bin/
│   └── transform.ts                    # Transformation utility
├── output/                             # Generated deployable templates
└── package.json
```

## Template Transformation

The transformation process:

1. **Read Baseline Template**: Load `cf/ecs-deployment-template.yaml`
2. **Read Values File**: Load environment-specific values (YAML/JSON)
3. **Replace Parameters**: Substitute `!Ref ParameterName` with actual values
4. **Generate Deployable Template**: Output a ready-to-deploy CloudFormation template

### Example Transformation

**Input Template** (`cf/ecs-deployment-template.yaml`):
```yaml
Parameters:
  VpcId:
    Type: String
    Description: "VPC ID where the ECS service will be deployed"
  
Resources:
  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Subnets: !Ref SubnetIds
```

**Values File** (`examples/casscheduler-values.yaml`):
```yaml
VpcId: "vpc-42de9927"
SubnetIds: ["subnet-c56802b2", "subnet-103d3874"]
```

**Output Template** (`output/casscheduler-deployable.yaml`):
```yaml
Resources:
  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Subnets: ["subnet-c56802b2", "subnet-103d3874"]
```

## Usage Examples

### Basic Transformation

```bash
# Transform and deploy in one step
npm run transform:example
aws cloudformation deploy --template-file output/casscheduler-deployable.yaml --stack-name my-stack
```

### Custom Deployment

```bash
# Create your own values file
cat > my-values.yaml << EOF
VpcId: "vpc-my-vpc"
SubnetIds: ["subnet-1", "subnet-2"]
ClusterName: "my-cluster"
ContainerImage: "my-app:latest"
ContainerPort: 8080
LoadBalancerPort: 80
ServiceName: "my-service"
EOF

# Transform with custom values
npm run transform cf/ecs-deployment-template.yaml my-values.yaml output/my-deployable.yaml

# Deploy
aws cloudformation deploy --template-file output/my-deployable.yaml --stack-name my-stack
```

### Transform Only (Preview)

```bash
# Just transform without deploying
npm run transform cf/ecs-deployment-template.yaml my-values.yaml output/preview.yaml

# View the generated template
cat output/preview.yaml
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run transform` | Transform template with values |
| `npm run transform:example` | Transform with CASSchedulerAdmin values |
| `npm run build` | Build TypeScript |

## Template Parameters

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `VpcId` | VPC ID | `vpc-42de9927` |
| `SubnetIds` | Subnet IDs (array) | `["subnet-1", "subnet-2"]` |
| `ClusterName` | ECS cluster name | `casscheduler-cluster` |
| `ContainerImage` | Container image URI | `cas-snapshots/cas-scheduler-admin:3.2.8-snapshot` |
| `ContainerPort` | Container port | `8080` |
| `LoadBalancerPort` | Load balancer port | `443` |

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ServiceName` | `ecs-service` | ECS service name |
| `DesiredCount` | `1` | Number of tasks |
| `CpuUnits` | `256` | CPU units (256-4096) |
| `MemoryMiB` | `512` | Memory in MiB |
| `LoadBalancerScheme` | `internet-facing` | `internet-facing` or `internal` |
| `HealthCheckPath` | `/` | Health check path |
| `AllowedCidr` | `0.0.0.0/0` | Allowed CIDR for ALB |

### Advanced Parameters (Commented in Template)

| Parameter | Description |
|-----------|-------------|
| `CertificateArn` | SSL certificate ARN for HTTPS |
| `EnableAutoScaling` | Enable auto scaling |
| `EnableEFS` | Enable EFS persistent storage |
| `EnableServiceDiscovery` | Enable AWS Cloud Map |

## Benefits

1. **Simplicity**: No CDK complexity, just template transformation
2. **Reusability**: One baseline template, many deployments
3. **Consistency**: Same infrastructure pattern across environments
4. **Maintainability**: Update template once, affects all deployments
5. **Version Control**: Values files can be environment-specific
6. **Standard Tooling**: Uses familiar CloudFormation and AWS CLI

## Next Steps

1. **Install Dependencies**: `npm install`
2. **Try Example**: `npm run transform:example`
3. **Create Custom Values**: Copy `examples/casscheduler-values.yaml` and modify
4. **Deploy**: Use AWS CLI to deploy the transformed template 