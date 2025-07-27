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
  console.log(`🚀 @matson/ecs - CDK Constructs for ECS Deployments

This package provides reusable CDK constructs for deploying ECS services
with Helm-style configuration using context parameters.

📋 USAGE EXAMPLES
================

Basic ECS Service Deployment (Context Parameters):
  AWS_PROFILE=dev cdk deploy -c vpcId=vpc-12345678 -c subnetIds=subnet-12345678,subnet-87654321 -c clusterName=my-cluster -c image=nginx:alpine

Helm-style Values File Deployment:
  AWS_PROFILE=dev cdk deploy -c valuesFile=values.yaml

Helm-style Values File with Overrides:
  AWS_PROFILE=dev cdk deploy -c valuesFile=values.yaml -c image=nginx:latest

📝 CONTEXT PARAMETERS
====================

REQUIRED PARAMETERS:
  infrastructure.vpc.id    VPC ID where the ECS service will be deployed
  cluster.name             ECS cluster name
  taskDefinition.containers.0.image Container image URI or path to Containerfile
  taskDefinition.containers.0.portMappings.0.containerPort Port that the container exposes
  loadBalancer.port        Load balancer port

OPTIONAL PARAMETERS:
  metadata.name            Service name (defaults to stack name)
  metadata.version         Service version (default: 1.0.0)
  infrastructure.vpc.subnets Subnet IDs (comma-separated or array)
  cluster.containerInsights Enable container insights (default: true)
  taskDefinition.type      Task definition type (default: FARGATE)
  taskDefinition.cpu       CPU units for the task (default: 256)
  taskDefinition.memory    Memory in MiB for the task (default: 512)
  service.type             Service type (default: LOAD_BALANCED)
  service.desiredCount     Number of tasks to run (default: 1)
  loadBalancer.type        Load balancer type (default: APPLICATION)
  loadBalancer.scheme      Load balancer scheme (default: internet-facing)
  loadBalancer.protocol    Load balancer protocol (default: HTTP)
  loadBalancer.certificateArn Certificate ARN for HTTPS
  loadBalancer.targetGroup.healthCheckPath Health check path (default: /)
  autoScaling.enabled      Whether to enable auto scaling (default: false)
  autoScaling.minCapacity  Minimum capacity for auto scaling (default: 1)
  autoScaling.maxCapacity  Maximum capacity for auto scaling (default: 10)
  autoScaling.targetCpuUtilization Target CPU utilization for auto scaling (default: 70)
  autoScaling.targetMemoryUtilization Target memory utilization for auto scaling (default: 70)
  iam.taskRole             IAM task role configuration
  iam.taskExecutionRole    IAM task execution role configuration
  serviceDiscovery         Service discovery configuration
  addons.logging           Logging configuration
  addons.monitoring        Monitoring configuration

📝 EXAMPLES
===========

Basic deployment with context parameters:
  cdk deploy -c infrastructure.vpc.id=vpc-12345678 -c cluster.name=my-cluster -c taskDefinition.containers.0.image=nginx:alpine -c taskDefinition.containers.0.portMappings.0.containerPort=80 -c loadBalancer.port=80

Deployment with values file:
  cdk deploy -c valuesFile=values.yaml

Deployment with values file and overrides:
  cdk deploy -c valuesFile=values.yaml -c taskDefinition.containers.0.image=nginx:latest

📝 HELP
========

Show this help information:
  cdk deploy -c help=true

📝 VERSION
==========

@matson/ecs version 1.0.0`);
} 