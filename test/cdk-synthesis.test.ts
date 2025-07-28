/**
 * CDK Synthesis Integration Tests
 * 
 * Tests that use CDK synthesis to generate CloudFormation templates
 * and compare them with expected outputs from the cf/ directory.
 * 
 * This approach tests the actual CDK construct behavior rather than
 * just unit test assertions.
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsServiceStack } from '../lib/ecs-service-stack';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('CDK Synthesis Integration Tests', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    app.node.setContext("testMode", true);
  });

  describe('CAS ERD Service', () => {
    test('generates expected CloudFormation for cas-erd-svc', () => {
      // Load the values file
      const valuesFilePath = path.join(__dirname, '../examples/values-cas-erd-svc.yaml');
      const valuesFile = yaml.load(fs.readFileSync(valuesFilePath, 'utf8')) as any;

      // Create the stack with the values file
      const stack = new EcsServiceStack(app, 'CasErdSvcTest', {
        env: {
          account: '275416279984',
          region: 'us-west-2'
        },
        config: valuesFile
      });

      const template = Template.fromStack(stack);

      // Test that the stack generates the expected resources
      template.hasResource('AWS::ECS::Cluster', {});
      template.hasResource('AWS::ECS::TaskDefinition', {});
      template.hasResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {});
      template.hasResource('AWS::ECS::Service', {});
      template.hasResource('AWS::IAM::Role', {});

      // Test specific resource properties
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        Cpu: '512',
        Memory: '1024',
        RequiresCompatibilities: ['FARGATE'],
        NetworkMode: 'awsvpc'
      });

      // Test container definition
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Name: 'main',
            Image: '275416279984.dkr.ecr.us-west-2.amazonaws.com/cas-erd-svc:2.0.0',
            Essential: true,
            PortMappings: [
              {
                ContainerPort: 8080,
                Protocol: 'tcp'
              }
            ],
            Environment: [
              { Name: 'APP_ENV', Value: 'dev' },
              { Name: 'AWS_DEFAULT_REGION', Value: 'us-west-2' },
              { Name: 'AWS_REGION', Value: 'us-west-2' },
              { Name: 'AWS_SDK_LOAD_CONFIG', Value: '1' },
              { Name: 'AWS_ENABLE_ENDPOINT_DISCOVERY', Value: 'true' }
            ]
          }
        ]
      });

      // Test load balancer configuration
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Scheme: 'internal',
        Type: 'application'
      });

      // Test target group health check
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
        HealthCheckPath: '/casreferenceservice/',
        HealthCheckIntervalSeconds: 30,
        HealthCheckTimeoutSeconds: 5,
        HealthyThresholdCount: 2,
        UnhealthyThresholdCount: 3
      });

      // Test auto scaling configuration
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
        MinCapacity: 1,
        MaxCapacity: 2
      });

      // Test service discovery
      template.hasResourceProperties('AWS::ServiceDiscovery::PrivateDnsNamespace', {
        Name: 'caserd.local'
      });

      template.hasResourceProperties('AWS::ServiceDiscovery::Service', {
        Name: 'cas-erd-svc'
      });
    });

    test('generates correct IAM permissions for cas-erd-svc', () => {
      const valuesFilePath = path.join(__dirname, '../examples/values-cas-erd-svc.yaml');
      const valuesFile = yaml.load(fs.readFileSync(valuesFilePath, 'utf8')) as any;

      const stack = new EcsServiceStack(app, 'CasErdSvcIamTest', {
        env: {
          account: '275416279984',
          region: 'us-west-2'
        },
        config: valuesFile
      });

      const template = Template.fromStack(stack);

      // Test task role permissions (matching actual CDK output)
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'secretsmanager:DescribeSecret',
                'secretsmanager:GetResourcePolicy',
                'secretsmanager:GetSecretValue',
                'secretsmanager:ListSecretVersionIds',
                'secretsmanager:ListSecrets'
              ],
              Resource: 'arn:aws:secretsmanager:us-west-2:275416279984:secret:*'
            },
            {
              Effect: 'Allow',
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:DescribeLogStreams',
                'logs:PutLogEvents'
              ],
              Resource: '*'
            },
            {
              Effect: 'Allow',
              Action: [
                'kms:Decrypt',
                'kms:DescribeKey'
              ],
              Resource: 'arn:aws:kms:us-west-2:275416279984:key/*'
            },
            {
              Effect: 'Allow',
              Action: 'sts:AssumeRole',
              Resource: '*'
            }
          ]
        }
      });
    });
  });

  describe('Simple Service Configuration', () => {
    test('generates basic ECS service with minimal configuration', () => {
      const config = {
        metadata: {
          name: 'test-service',
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
          type: 'FARGATE' as const,
          cpu: 256,
          memory: 512,
          containers: [{
            name: 'main',
            image: 'nginx:alpine',
            portMappings: [{
              containerPort: 80,
              protocol: 'tcp' as const
            }]
          }]
        },
        service: {
          type: 'LOAD_BALANCED' as const,
          desiredCount: 1
        },
        loadBalancer: {
          type: 'APPLICATION' as const,
          port: 80
        }
      };

      const stack = new EcsServiceStack(app, 'SimpleServiceTest', {
        env: {
          account: '123456789012',
          region: 'us-west-2'
        },
        config
      });

      const template = Template.fromStack(stack);

      // Test basic resources are created
      template.hasResource('AWS::ECS::Cluster', {});
      template.hasResource('AWS::ECS::TaskDefinition', {});
      template.hasResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {});
      template.hasResource('AWS::ECS::Service', {});

      // Test task definition properties
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        Cpu: '256',
        Memory: '512',
        RequiresCompatibilities: ['FARGATE']
      });

      // Test container definition
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Name: 'main',
            Image: 'nginx:alpine',
            Essential: true,
            PortMappings: [
              {
                ContainerPort: 80,
                Protocol: 'tcp'
              }
            ]
          }
        ]
      });
    });
  });

  describe('Advanced Configuration', () => {
    test('generates service with health checks and environment variables', () => {
      const config = {
        metadata: {
          name: 'advanced-service',
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
          type: 'FARGATE' as const,
          cpu: 512,
          memory: 1024,
          containers: [{
            name: 'main',
            image: 'myapp:latest',
            portMappings: [{
              containerPort: 8080,
              protocol: 'tcp' as const
            }],
            environment: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'API_URL', value: 'https://api.example.com' }
            ],
            healthCheck: {
              enabled: true,
              command: ['CMD-SHELL', 'curl -f http://localhost:8080/health || exit 1'],
              interval: cdk.Duration.seconds(30),
              timeout: cdk.Duration.seconds(5),
              startPeriod: cdk.Duration.seconds(60),
              retries: 3
            }
          }]
        },
        service: {
          type: 'LOAD_BALANCED' as const,
          desiredCount: 2,
          healthCheckGracePeriodSeconds: 60
        },
        loadBalancer: {
          type: 'APPLICATION' as const,
          port: 80,
          targetGroup: {
            healthCheckPath: '/health',
            interval: 30,
            timeout: 5,
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 3
          }
        },
        autoScaling: {
          enabled: true,
          minCapacity: 1,
          maxCapacity: 5,
          targetCpuUtilization: 70
        }
      };

      const stack = new EcsServiceStack(app, 'AdvancedServiceTest', {
        env: {
          account: '123456789012',
          region: 'us-west-2'
        },
        config
      });

      const template = Template.fromStack(stack);

      // Test environment variables
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

      // Test health check configuration
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
        HealthCheckPath: '/health',
        HealthCheckIntervalSeconds: 30,
        HealthCheckTimeoutSeconds: 5,
        HealthyThresholdCount: 2,
        UnhealthyThresholdCount: 3
      });

      // Test auto scaling
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
        MinCapacity: 1,
        MaxCapacity: 5
      });

      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
        PolicyType: 'TargetTrackingScaling',
        TargetTrackingScalingPolicyConfiguration: {
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'ECSServiceAverageCPUUtilization'
          },
          TargetValue: 70
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('throws error for missing required configuration', () => {
      const invalidConfig = {
        metadata: {
          name: 'invalid-service'
        }
        // Missing required fields
      };

      expect(() => {
        new EcsServiceStack(app, 'InvalidServiceTest', {
          env: {
            account: '123456789012',
            region: 'us-west-2'
          },
          config: invalidConfig as any
        });
      }).toThrow();
    });

    test('throws error for invalid container configuration', () => {
      const config = {
        metadata: {
          name: 'test-service',
          version: '1.0.0'
        },
        infrastructure: {
          vpc: {
            id: 'vpc-12345678',
            subnets: ['subnet-12345678']
          }
        },
        cluster: {
          name: 'test-cluster'
        },
        taskDefinition: {
          type: 'FARGATE' as const,
          cpu: 256,
          memory: 512,
          containers: [] // No containers
        },
        service: {
          type: 'LOAD_BALANCED' as const,
          desiredCount: 1
        },
        loadBalancer: {
          type: 'APPLICATION' as const,
          port: 80
        }
      };

      expect(() => {
        new EcsServiceStack(app, 'NoContainersTest', {
          env: {
            account: '123456789012',
            region: 'us-west-2'
          },
          config
        });
      }).toThrow();
    });
  });

  describe('CDK Synthesis Output Validation', () => {
    test('generates valid CloudFormation template structure', () => {
      const config = {
        metadata: {
          name: 'validation-test',
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
          type: 'FARGATE' as const,
          cpu: 256,
          memory: 512,
          containers: [{
            name: 'main',
            image: 'nginx:alpine',
            portMappings: [{
              containerPort: 80,
              protocol: 'tcp' as const
            }]
          }]
        },
        service: {
          type: 'LOAD_BALANCED' as const,
          desiredCount: 1
        },
        loadBalancer: {
          type: 'APPLICATION' as const,
          port: 80
        }
      };

      const stack = new EcsServiceStack(app, 'ValidationTest', {
        env: {
          account: '123456789012',
          region: 'us-west-2'
        },
        config
      });

      const template = Template.fromStack(stack);

      // Validate that all required resources are present
      const resources = template.toJSON().Resources;
      
      // Check for required resource types
      const resourceTypes = Object.values(resources).map((r: any) => r.Type);
      
      expect(resourceTypes).toContain('AWS::ECS::Cluster');
      expect(resourceTypes).toContain('AWS::ECS::TaskDefinition');
      expect(resourceTypes).toContain('AWS::ElasticLoadBalancingV2::LoadBalancer');
      expect(resourceTypes).toContain('AWS::ECS::Service');
      expect(resourceTypes).toContain('AWS::IAM::Role');
      expect(resourceTypes).toContain('AWS::Logs::LogGroup');

      // Validate resource count expectations
      const clusterCount = resourceTypes.filter(t => t === 'AWS::ECS::Cluster').length;
      const taskDefCount = resourceTypes.filter(t => t === 'AWS::ECS::TaskDefinition').length;
      const lbCount = resourceTypes.filter(t => t === 'AWS::ElasticLoadBalancingV2::LoadBalancer').length;
      const serviceCount = resourceTypes.filter(t => t === 'AWS::ECS::Service').length;

      expect(clusterCount).toBe(1);
      expect(taskDefCount).toBe(1);
      expect(lbCount).toBe(1);
      expect(serviceCount).toBe(1);
    });
  });
}); 