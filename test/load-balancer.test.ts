/**
 * Load Balancer Tests
 * 
 * Tests for load balancer configuration including schemes, HTTPS, and health checks
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsServiceStack } from '../lib/ecs-service-stack';

describe('Load Balancer Configuration', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    app.node.setContext("testMode", true);
  });

  test('creates ECS service with internal load balancer', () => {
    const stack = new EcsServiceStack(app, 'InternalLoadBalancerEcsService', {
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
          scheme: 'internal',
          port: 80,
          allowedCidr: '10.0.0.0/8'
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify internal load balancer is created
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      Type: 'application'
    });

    // Verify security group allows traffic from specified CIDR
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: expect.stringContaining('Allow HTTP from 10.0.0.0/8')
    });
  });

  test('creates ECS service with HTTPS and certificate', () => {
    const stack = new EcsServiceStack(app, 'HttpsLoadBalancerEcsService', {
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
              containerPort: 8080,
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
          protocol: 'HTTPS',
          port: 443,
          certificateArn: 'arn:aws:acm:us-west-2:123456789012:certificate/example-cert'
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify HTTPS listener is created
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
      Certificates: [
        {
          CertificateArn: 'arn:aws:acm:us-west-2:123456789012:certificate/example-cert'
        }
      ]
    });
  });

  test('creates ECS service with advanced health checks', () => {
    const stack = new EcsServiceStack(app, 'AdvancedHealthCheckEcsService', {
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
          port: 80,
          targetGroup: {
            healthCheckPath: '/health',
            healthyHttpCodes: '200,302',
            interval: 30,
            timeout: 5,
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 3
          }
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify target group health check configuration
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/health',
      HealthCheckProtocol: 'HTTP',
      HealthyThresholdCount: 2,
      UnhealthyThresholdCount: 3
    });
  });

  test('creates ECS service with custom security group', () => {
    const stack = new EcsServiceStack(app, 'CustomSecurityGroupEcsService', {
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
          },
          securityGroups: [
            {
              name: 'app-security-group',
              rules: [
                {
                  port: 80,
                  cidr: '10.0.0.0/8',
                  description: 'Allow HTTP from private network'
                }
              ]
            }
          ]
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

    // Verify security groups are created
    template.resourceCountIs('AWS::EC2::SecurityGroup', 2);
  });
}); 