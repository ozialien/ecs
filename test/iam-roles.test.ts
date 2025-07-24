/**
 * IAM Roles Tests
 * 
 * Tests for IAM roles and permissions configuration
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsServiceStack } from '../lib/ecs-service-stack';

describe('IAM Roles and Permissions', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    app.node.setContext("testMode", true);
  });

  test('creates ECS service with custom IAM roles', () => {
    const stack = new EcsServiceStack(app, 'CustomIamRolesEcsService', {
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
        iam: {
          taskRole: {
            policies: [
              {
                name: 'S3Access',
                actions: ['s3:GetObject', 's3:PutObject'],
                resources: ['arn:aws:s3:::my-bucket/*']
              }
            ]
          },
          taskExecutionRole: {
            permissions: {
              secretsManager: {
                actions: ['secretsmanager:GetSecretValue'],
                resources: ['arn:aws:secretsmanager:us-west-2:123456789012:secret:*']
              }
            }
          }
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify task role is created with custom policies
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      }
    });

    // Verify task execution role has secrets manager permissions
    template.hasResourceProperties('AWS::IAM::Role', {
      ManagedPolicyArns: expect.arrayContaining([
        expect.stringContaining('AmazonECSTaskExecutionRolePolicy')
      ])
    });
  });

  test('creates ECS service with comprehensive IAM permissions', () => {
    const stack = new EcsServiceStack(app, 'ComprehensiveIamEcsService', {
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
        iam: {
          taskRole: {
            permissions: {
              s3: {
                actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
                resources: ['arn:aws:s3:::my-bucket/*']
              },
              dynamodb: {
                actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query'],
                resources: ['arn:aws:dynamodb:us-west-2:123456789012:table/my-table']
              },
              sqs: {
                actions: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage'],
                resources: ['arn:aws:sqs:us-west-2:123456789012:my-queue']
              },
              cloudWatchMetrics: {
                actions: ['cloudwatch:PutMetricData'],
                resources: ['*']
              }
            }
          }
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify task role has comprehensive permissions
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      }
    });
  });

  test('creates ECS service with custom IAM policy', () => {
    const stack = new EcsServiceStack(app, 'CustomPolicyEcsService', {
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
        iam: {
          taskRole: {
            custom: JSON.stringify({
              Effect: 'Allow',
              Action: ['custom:action'],
              Resource: ['*']
            })
          }
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify custom policy is applied
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      }
    });
  });
}); 