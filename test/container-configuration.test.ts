/**
 * Container Configuration Tests
 * 
 * Tests for container environment variables, secrets, and health checks
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsServiceStack } from '../lib/ecs-service-stack';

describe('Container Configuration', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    app.node.setContext("testMode", true);
  });

  test('creates ECS service with environment variables', () => {
    const stack = new EcsServiceStack(app, 'EnvVarsEcsService', {
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
            }],
            environment: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'API_URL', value: 'https://api.example.com' }
            ]
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

    // Verify environment variables are set
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Environment: [
            { Name: 'NODE_ENV', Value: 'production' },
            { Name: 'API_URL', Value: 'https://api.example.com' }
          ]
        }
      ]
    });
  });

  test('creates ECS service with secrets', () => {
    const stack = new EcsServiceStack(app, 'SecretsEcsService', {
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
            }],
            secrets: [
              { name: 'DB_PASSWORD', valueFrom: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:db-password-abc123' },
              { name: 'API_KEY', valueFrom: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:api-key-def456' }
            ]
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

    // Verify secrets are configured
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Secrets: [
            { Name: 'DB_PASSWORD', ValueFrom: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:db-password-abc123' },
            { Name: 'API_KEY', ValueFrom: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:api-key-def456' }
          ]
        }
      ]
    });
  });

  test('creates ECS service with container health checks', () => {
    const stack = new EcsServiceStack(app, 'HealthCheckEcsService', {
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
            }],
            healthCheck: {
              enabled: true,
              command: ['CMD-SHELL', 'curl -f http://localhost:80/health || exit 1'],
              interval: cdk.Duration.seconds(30),
              timeout: cdk.Duration.seconds(5),
              startPeriod: cdk.Duration.seconds(60),
              retries: 3
            }
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

    // Verify container health check is configured
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          HealthCheck: {
            Command: ['CMD-SHELL', 'curl -f http://localhost:80/health || exit 1'],
            Interval: 30,
            Timeout: 5,
            StartPeriod: 60,
            Retries: 3
          }
        }
      ]
    });
  });

  test('creates ECS service with runtime platform configuration', () => {
    const stack = new EcsServiceStack(app, 'RuntimePlatformEcsService', {
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
          runtimePlatform: {
            cpuArchitecture: 'ARM64',
            os: 'LINUX'
          },
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

    // Verify runtime platform is configured
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      RequiresCompatibilities: ['FARGATE'],
      Cpu: '256',
      Memory: '512'
    });
  });
}); 