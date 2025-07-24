/**
 * Basic ECS Service Tests
 * 
 * Tests for core ECS service functionality with minimal configuration
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsServiceStack } from '../lib/ecs-service-stack';

describe('Basic ECS Service', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    app.node.setContext("testMode", true);
  });

  test('creates basic ECS service with minimal configuration', () => {
    const stack = new EcsServiceStack(app, 'BasicEcsService', {
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
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify ECS service is created
    template.hasResourceProperties('AWS::ECS::Service', {
      LaunchType: 'FARGATE',
      DesiredCount: 1,
    });

    // Verify task definition is created
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '256',
      Memory: '512',
    });

    // Verify load balancer is created
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {});

    // Verify log group is created
    template.hasResourceProperties('AWS::Logs::LogGroup', {});
  });

  test('creates ECS service with custom configuration', () => {
    const stack = new EcsServiceStack(app, 'CustomEcsService', {
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
          cpu: 512,
          memory: 1024,
          containers: [{
            name: 'main',
            image: 'nginx:alpine',
            portMappings: [{
              containerPort: 8080,
              protocol: 'tcp'
            }]
          }]
        },
        service: {
          type: 'LOAD_BALANCED',
          desiredCount: 3
        },
        loadBalancer: {
          type: 'APPLICATION',
          port: 80
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify custom configuration is applied
    template.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 3,
    });

    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '512',
      Memory: '1024',
    });
  });

  test('throws error when required parameters are missing', () => {
    expect(() => {
      new EcsServiceStack(app, 'MissingParamsEcsService', {
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
              image: 'nginx:alpine'
              // Missing portMappings
            }]
          },
          service: {
            type: 'LOAD_BALANCED',
            desiredCount: 1
          },
          loadBalancer: {
            type: 'APPLICATION'
            // Missing port
          }
        }
      });
    }).toThrow();
  });

  test('package builds successfully', () => {
    const stack = new EcsServiceStack(app, 'BuildTestEcsService', {
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
        }
      }
    });

    // Verify the stack was created successfully
    expect(stack).toBeDefined();
    expect(stack.service).toBeDefined();
    expect(stack.cluster).toBeDefined();
    expect(stack.loadBalancer).toBeDefined();
  });
}); 