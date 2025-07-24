#!/bin/bash
# CloudFormation deployment script
# Generated from: cf/ecs-deployment-template.yaml + values/casscheduler-values.yaml

aws cloudformation deploy \
  --template-file cf/ecs-deployment-template.yaml \
  --stack-name your-stack-name \
  --parameter-overrides ParameterKey=VpcId,ParameterValue="vpc-42de9927" ParameterKey=SubnetIds,ParameterValue="["subnet-c56802b2","subnet-103d3874"]" ParameterKey=ClusterName,ParameterValue="casscheduler-cluster" ParameterKey=ContainerImage,ParameterValue="cas-snapshots/cas-scheduler-admin:3.2.8-snapshot" ParameterKey=ContainerPort,ParameterValue="8080" ParameterKey=LoadBalancerPort,ParameterValue="443" ParameterKey=ServiceName,ParameterValue="casscheduler" ParameterKey=DesiredCount,ParameterValue="1" ParameterKey=CpuUnits,ParameterValue="2048" ParameterKey=MemoryMiB,ParameterValue="4096" ParameterKey=LoadBalancerScheme,ParameterValue="internal" ParameterKey=HealthCheckPath,ParameterValue="/CASSchedulerAdmin/info" ParameterKey=HealthCheckGracePeriodSeconds,ParameterValue="600" ParameterKey=AllowedCidr,ParameterValue="10.0.0.0/8" ParameterKey=CertificateArn,ParameterValue="arn:aws:acm:us-west-2:275416279984:certificate/87de9dbf-75e1-4fef-badf-834846d72d02" ParameterKey=EnableServiceDiscovery,ParameterValue="true" ParameterKey=ServiceDiscoveryNamespace,ParameterValue="casscheduler.local" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
