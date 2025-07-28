"use strict";
/**
 * Help system for @matson/ecs package
 *
 * Shows all available context parameters and usage examples.
 * Follows 12-factor principles by using the same context parameter system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.showHelp = void 0;
/**
 * Display comprehensive help information for the ECS deployment tool
 */
function showHelp() {
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
exports.showHelp = showHelp;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9oZWxwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7O0FBRUg7O0dBRUc7QUFDSCxTQUFnQixRQUFRO0lBQ3RCLE9BQU8sQ0FBQyxHQUFHLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzBCQTBFWSxDQUFDLENBQUM7QUFDNUIsQ0FBQztBQTVFRCw0QkE0RUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEhlbHAgc3lzdGVtIGZvciBAbWF0c29uL2VjcyBwYWNrYWdlXG4gKiBcbiAqIFNob3dzIGFsbCBhdmFpbGFibGUgY29udGV4dCBwYXJhbWV0ZXJzIGFuZCB1c2FnZSBleGFtcGxlcy5cbiAqIEZvbGxvd3MgMTItZmFjdG9yIHByaW5jaXBsZXMgYnkgdXNpbmcgdGhlIHNhbWUgY29udGV4dCBwYXJhbWV0ZXIgc3lzdGVtLlxuICovXG5cbi8qKlxuICogRGlzcGxheSBjb21wcmVoZW5zaXZlIGhlbHAgaW5mb3JtYXRpb24gZm9yIHRoZSBFQ1MgZGVwbG95bWVudCB0b29sXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzaG93SGVscCgpOiB2b2lkIHtcbiAgY29uc29sZS5sb2coYPCfmoAgQG1hdHNvbi9lY3MgLSBDREsgQ29uc3RydWN0cyBmb3IgRUNTIERlcGxveW1lbnRzXG5cblRoaXMgcGFja2FnZSBwcm92aWRlcyByZXVzYWJsZSBDREsgY29uc3RydWN0cyBmb3IgZGVwbG95aW5nIEVDUyBzZXJ2aWNlc1xud2l0aCBIZWxtLXN0eWxlIGNvbmZpZ3VyYXRpb24gdXNpbmcgY29udGV4dCBwYXJhbWV0ZXJzLlxuXG7wn5OLIFVTQUdFIEVYQU1QTEVTXG49PT09PT09PT09PT09PT09XG5cbkJhc2ljIEVDUyBTZXJ2aWNlIERlcGxveW1lbnQgKENvbnRleHQgUGFyYW1ldGVycyk6XG4gIEFXU19QUk9GSUxFPWRldiBjZGsgZGVwbG95IC1jIHZwY0lkPXZwYy0xMjM0NTY3OCAtYyBzdWJuZXRJZHM9c3VibmV0LTEyMzQ1Njc4LHN1Ym5ldC04NzY1NDMyMSAtYyBjbHVzdGVyTmFtZT1teS1jbHVzdGVyIC1jIGltYWdlPW5naW54OmFscGluZVxuXG5IZWxtLXN0eWxlIFZhbHVlcyBGaWxlIERlcGxveW1lbnQ6XG4gIEFXU19QUk9GSUxFPWRldiBjZGsgZGVwbG95IC1jIHZhbHVlc0ZpbGU9dmFsdWVzLnlhbWxcblxuSGVsbS1zdHlsZSBWYWx1ZXMgRmlsZSB3aXRoIE92ZXJyaWRlczpcbiAgQVdTX1BST0ZJTEU9ZGV2IGNkayBkZXBsb3kgLWMgdmFsdWVzRmlsZT12YWx1ZXMueWFtbCAtYyBpbWFnZT1uZ2lueDpsYXRlc3Rcblxu8J+TnSBDT05URVhUIFBBUkFNRVRFUlNcbj09PT09PT09PT09PT09PT09PT09XG5cblJFUVVJUkVEIFBBUkFNRVRFUlM6XG4gIGluZnJhc3RydWN0dXJlLnZwYy5pZCAgICBWUEMgSUQgd2hlcmUgdGhlIEVDUyBzZXJ2aWNlIHdpbGwgYmUgZGVwbG95ZWRcbiAgY2x1c3Rlci5uYW1lICAgICAgICAgICAgIEVDUyBjbHVzdGVyIG5hbWVcbiAgdGFza0RlZmluaXRpb24uY29udGFpbmVycy4wLmltYWdlIENvbnRhaW5lciBpbWFnZSBVUkkgb3IgcGF0aCB0byBDb250YWluZXJmaWxlXG4gIHRhc2tEZWZpbml0aW9uLmNvbnRhaW5lcnMuMC5wb3J0TWFwcGluZ3MuMC5jb250YWluZXJQb3J0IFBvcnQgdGhhdCB0aGUgY29udGFpbmVyIGV4cG9zZXNcbiAgbG9hZEJhbGFuY2VyLnBvcnQgICAgICAgIExvYWQgYmFsYW5jZXIgcG9ydFxuXG5PUFRJT05BTCBQQVJBTUVURVJTOlxuICBtZXRhZGF0YS5uYW1lICAgICAgICAgICAgU2VydmljZSBuYW1lIChkZWZhdWx0cyB0byBzdGFjayBuYW1lKVxuICBtZXRhZGF0YS52ZXJzaW9uICAgICAgICAgU2VydmljZSB2ZXJzaW9uIChkZWZhdWx0OiAxLjAuMClcbiAgaW5mcmFzdHJ1Y3R1cmUudnBjLnN1Ym5ldHMgU3VibmV0IElEcyAoY29tbWEtc2VwYXJhdGVkIG9yIGFycmF5KVxuICBjbHVzdGVyLmNvbnRhaW5lckluc2lnaHRzIEVuYWJsZSBjb250YWluZXIgaW5zaWdodHMgKGRlZmF1bHQ6IHRydWUpXG4gIHRhc2tEZWZpbml0aW9uLnR5cGUgICAgICBUYXNrIGRlZmluaXRpb24gdHlwZSAoZGVmYXVsdDogRkFSR0FURSlcbiAgdGFza0RlZmluaXRpb24uY3B1ICAgICAgIENQVSB1bml0cyBmb3IgdGhlIHRhc2sgKGRlZmF1bHQ6IDI1NilcbiAgdGFza0RlZmluaXRpb24ubWVtb3J5ICAgIE1lbW9yeSBpbiBNaUIgZm9yIHRoZSB0YXNrIChkZWZhdWx0OiA1MTIpXG4gIHNlcnZpY2UudHlwZSAgICAgICAgICAgICBTZXJ2aWNlIHR5cGUgKGRlZmF1bHQ6IExPQURfQkFMQU5DRUQpXG4gIHNlcnZpY2UuZGVzaXJlZENvdW50ICAgICBOdW1iZXIgb2YgdGFza3MgdG8gcnVuIChkZWZhdWx0OiAxKVxuICBsb2FkQmFsYW5jZXIudHlwZSAgICAgICAgTG9hZCBiYWxhbmNlciB0eXBlIChkZWZhdWx0OiBBUFBMSUNBVElPTilcbiAgbG9hZEJhbGFuY2VyLnNjaGVtZSAgICAgIExvYWQgYmFsYW5jZXIgc2NoZW1lIChkZWZhdWx0OiBpbnRlcm5ldC1mYWNpbmcpXG4gIGxvYWRCYWxhbmNlci5wcm90b2NvbCAgICBMb2FkIGJhbGFuY2VyIHByb3RvY29sIChkZWZhdWx0OiBIVFRQKVxuICBsb2FkQmFsYW5jZXIuY2VydGlmaWNhdGVBcm4gQ2VydGlmaWNhdGUgQVJOIGZvciBIVFRQU1xuICBsb2FkQmFsYW5jZXIudGFyZ2V0R3JvdXAuaGVhbHRoQ2hlY2tQYXRoIEhlYWx0aCBjaGVjayBwYXRoIChkZWZhdWx0OiAvKVxuICBhdXRvU2NhbGluZy5lbmFibGVkICAgICAgV2hldGhlciB0byBlbmFibGUgYXV0byBzY2FsaW5nIChkZWZhdWx0OiBmYWxzZSlcbiAgYXV0b1NjYWxpbmcubWluQ2FwYWNpdHkgIE1pbmltdW0gY2FwYWNpdHkgZm9yIGF1dG8gc2NhbGluZyAoZGVmYXVsdDogMSlcbiAgYXV0b1NjYWxpbmcubWF4Q2FwYWNpdHkgIE1heGltdW0gY2FwYWNpdHkgZm9yIGF1dG8gc2NhbGluZyAoZGVmYXVsdDogMTApXG4gIGF1dG9TY2FsaW5nLnRhcmdldENwdVV0aWxpemF0aW9uIFRhcmdldCBDUFUgdXRpbGl6YXRpb24gZm9yIGF1dG8gc2NhbGluZyAoZGVmYXVsdDogNzApXG4gIGF1dG9TY2FsaW5nLnRhcmdldE1lbW9yeVV0aWxpemF0aW9uIFRhcmdldCBtZW1vcnkgdXRpbGl6YXRpb24gZm9yIGF1dG8gc2NhbGluZyAoZGVmYXVsdDogNzApXG4gIGlhbS50YXNrUm9sZSAgICAgICAgICAgICBJQU0gdGFzayByb2xlIGNvbmZpZ3VyYXRpb25cbiAgaWFtLnRhc2tFeGVjdXRpb25Sb2xlICAgIElBTSB0YXNrIGV4ZWN1dGlvbiByb2xlIGNvbmZpZ3VyYXRpb25cbiAgc2VydmljZURpc2NvdmVyeSAgICAgICAgIFNlcnZpY2UgZGlzY292ZXJ5IGNvbmZpZ3VyYXRpb25cbiAgYWRkb25zLmxvZ2dpbmcgICAgICAgICAgIExvZ2dpbmcgY29uZmlndXJhdGlvblxuICBhZGRvbnMubW9uaXRvcmluZyAgICAgICAgTW9uaXRvcmluZyBjb25maWd1cmF0aW9uXG5cbvCfk50gRVhBTVBMRVNcbj09PT09PT09PT09XG5cbkJhc2ljIGRlcGxveW1lbnQgd2l0aCBjb250ZXh0IHBhcmFtZXRlcnM6XG4gIGNkayBkZXBsb3kgLWMgaW5mcmFzdHJ1Y3R1cmUudnBjLmlkPXZwYy0xMjM0NTY3OCAtYyBjbHVzdGVyLm5hbWU9bXktY2x1c3RlciAtYyB0YXNrRGVmaW5pdGlvbi5jb250YWluZXJzLjAuaW1hZ2U9bmdpbng6YWxwaW5lIC1jIHRhc2tEZWZpbml0aW9uLmNvbnRhaW5lcnMuMC5wb3J0TWFwcGluZ3MuMC5jb250YWluZXJQb3J0PTgwIC1jIGxvYWRCYWxhbmNlci5wb3J0PTgwXG5cbkRlcGxveW1lbnQgd2l0aCB2YWx1ZXMgZmlsZTpcbiAgY2RrIGRlcGxveSAtYyB2YWx1ZXNGaWxlPXZhbHVlcy55YW1sXG5cbkRlcGxveW1lbnQgd2l0aCB2YWx1ZXMgZmlsZSBhbmQgb3ZlcnJpZGVzOlxuICBjZGsgZGVwbG95IC1jIHZhbHVlc0ZpbGU9dmFsdWVzLnlhbWwgLWMgdGFza0RlZmluaXRpb24uY29udGFpbmVycy4wLmltYWdlPW5naW54OmxhdGVzdFxuXG7wn5OdIEhFTFBcbj09PT09PT09XG5cblNob3cgdGhpcyBoZWxwIGluZm9ybWF0aW9uOlxuICBjZGsgZGVwbG95IC1jIGhlbHA9dHJ1ZVxuXG7wn5OdIFZFUlNJT05cbj09PT09PT09PT1cblxuQG1hdHNvbi9lY3MgdmVyc2lvbiAxLjAuMGApO1xufSAiXX0=