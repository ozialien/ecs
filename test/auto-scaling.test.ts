/**
 * Auto Scaling Tests
 * 
 * Tests for ECS auto scaling functionality
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsServiceStack } from '../lib/ecs-service-stack';

describe('Auto Scaling', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    app.node.setContext("testMode", true);
  });

  test('creates ECS service with auto scaling', () => {
    const stack = new EcsServiceStack(app, 'AutoScalingEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        metadata: {
          name: 'test-stack',
          version: '1.0.0'
        },
        infrastructure: {
          vpc: {
            id: 'vpc-12345678',
            subnets: ['subnet-12345678', 'subnet-87654321']
          }
        },
        cluster: {
          name: 'test-cluster'
        },
        taskDefinition: {
          type: 'FARGATE',
          cpu: 256,
          memory: 512,
          containers: [{
            name: 'main',
            image: 'nginx:alpine',
            portMappings: [{
              containerPort: 80,
              protocol: 'tcp'
            }]
          }]
        },
        service: {
          type: 'LOAD_BALANCED',
          desiredCount: 1
        },
        loadBalancer: {
          type: 'APPLICATION',
          port: 80
        },
        autoScaling: {
          enabled: true,
          minCapacity: 2,
          maxCapacity: 5,
          targetCpuUtilization: 80
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify auto scaling is configured
    template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
      MinCapacity: 2,
      MaxCapacity: 5,
    });

    template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
      PolicyType: 'TargetTrackingScaling',
    });
  });

  test('creates ECS service with memory-based auto scaling', () => {
    const stack = new EcsServiceStack(app, 'MemoryAutoScalingEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        metadata: {
          name: 'test-stack',
          version: '1.0.0'
        },
        infrastructure: {
          vpc: {
            id: 'vpc-12345678',
            subnets: ['subnet-12345678', 'subnet-87654321']
          }
        },
        cluster: {
          name: 'test-cluster'
        },
        taskDefinition: {
          type: 'FARGATE',
          cpu: 256,
          memory: 512,
          containers: [{
            name: 'main',
            image: 'nginx:alpine',
            portMappings: [{
              containerPort: 80,
              protocol: 'tcp'
            }]
          }]
        },
        service: {
          type: 'LOAD_BALANCED',
          desiredCount: 1
        },
        loadBalancer: {
          type: 'APPLICATION',
          port: 80
        },
        autoScaling: {
          enabled: true,
          minCapacity: 1,
          maxCapacity: 10,
          targetCpuUtilization: 70,
          targetMemoryUtilization: 80
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify both CPU and memory scaling policies are created
    template.resourceCountIs('AWS::ApplicationAutoScaling::ScalingPolicy', 2);
  });

  test('creates ECS service without auto scaling when disabled', () => {
    const stack = new EcsServiceStack(app, 'NoAutoScalingEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        metadata: {
          name: 'test-stack',
          version: '1.0.0'
        },
        infrastructure: {
          vpc: {
            id: 'vpc-12345678',
            subnets: ['subnet-12345678', 'subnet-87654321']
          }
        },
        cluster: {
          name: 'test-cluster'
        },
        taskDefinition: {
          type: 'FARGATE',
          cpu: 256,
          memory: 512,
          containers: [{
            name: 'main',
            image: 'nginx:alpine',
            portMappings: [{
              containerPort: 80,
              protocol: 'tcp'
            }]
          }]
        },
        service: {
          type: 'LOAD_BALANCED',
          desiredCount: 1
        },
        loadBalancer: {
          type: 'APPLICATION',
          port: 80
        },
        autoScaling: {
          enabled: false
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify no auto scaling resources are created
    template.resourceCountIs('AWS::ApplicationAutoScaling::ScalableTarget', 0);
    template.resourceCountIs('AWS::ApplicationAutoScaling::ScalingPolicy', 0);
  });
}); 