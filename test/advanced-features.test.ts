/**
 * Advanced Features Tests
 * 
 * Tests for advanced ECS features including service discovery, volumes, add-ons, and deployment configuration
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsServiceStack } from '../lib/ecs-service-stack';

describe('Advanced Features', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    app.node.setContext("testMode", true);
  });

  test('creates ECS service with service discovery', () => {
    const stack = new EcsServiceStack(app, 'ServiceDiscoveryEcsService', {
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
        serviceDiscovery: {
          enabled: true,
          namespace: {
            name: 'test.local',
            type: 'private'
          },
          service: {
            name: 'test-service',
            dnsType: 'A',
            ttl: 10,
            routingPolicy: 'MULTIVALUE'
          }
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify service discovery namespace is created
    template.hasResourceProperties('AWS::ServiceDiscovery::PrivateDnsNamespace', {
      Name: 'test.local',
      Vpc: {
        'Fn::GetAtt': ['ServiceDiscoveryEcsServiceVpc', 'VpcId']
      }
    });

    // Verify service discovery service is created
    template.hasResourceProperties('AWS::ServiceDiscovery::Service', {
      Name: 'test-service',
      DnsConfig: {
        DnsRecords: [
          {
            TTL: 10,
            Type: 'A'
          }
        ],
        RoutingPolicy: 'MULTIVALUE'
      }
    });
  });

  test('creates ECS service with volume mounts', () => {
    const stack = new EcsServiceStack(app, 'VolumeMountEcsService', {
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
            mountPoints: [{
              sourceVolume: 'data',
              containerPath: '/data',
              readOnly: false
            }]
          }],
          volumes: [{
            name: 'data',
            efsVolumeConfiguration: {
              fileSystemId: 'fs-12345678',
              transitEncryption: 'ENABLED',
              authorizationConfig: {
                accessPointId: 'fsap-12345678',
                iam: 'ENABLED'
              }
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

    // Verify volume is configured in task definition
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Volumes: [
        {
          Name: 'data',
          EfsVolumeConfiguration: {
            FileSystemId: 'fs-12345678',
            TransitEncryption: 'ENABLED',
            AuthorizationConfig: {
              AccessPointId: 'fsap-12345678',
              Iam: 'ENABLED'
            }
          }
        }
      ]
    });

    // Verify mount point is configured in container
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          MountPoints: [
            {
              SourceVolume: 'data',
              ContainerPath: '/data',
              ReadOnly: false
            }
          ]
        }
      ]
    });
  });

  test('creates ECS service with add-ons configuration', () => {
    const stack = new EcsServiceStack(app, 'AddonsEcsService', {
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
        addons: {
          logging: {
            driver: 'awslogs',
            options: {
              'awslogs-group': '/ecs/test-service',
              'awslogs-region': 'us-west-2',
              'awslogs-stream-prefix': 'test-service'
            },
            retentionDays: 30
          },
          monitoring: {
            enableXRay: true,
            enableCloudWatchAlarms: true
          }
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify log group is created with correct retention
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 30
    });

    // Verify container logging configuration
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          LogConfiguration: {
            LogDriver: 'awslogs',
            Options: {
              'awslogs-group': '/ecs/test-service',
              'awslogs-region': 'us-west-2',
              'awslogs-stream-prefix': 'test-service'
            }
          }
        }
      ]
    });
  });

  test('creates ECS service with deployment configuration', () => {
    const stack = new EcsServiceStack(app, 'DeploymentConfigEcsService', {
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
          desiredCount: 2,
          deployment: {
            strategy: 'ROLLING',
            minimumHealthyPercent: 50,
            maximumPercent: 200,
            healthCheckGracePeriodSeconds: 60
          }
        },
        loadBalancer: {
          type: 'APPLICATION',
          port: 80
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify deployment configuration
    template.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 2,
      DeploymentConfiguration: {
        MaximumPercent: 200,
        MinimumHealthyPercent: 50
      },
      HealthCheckGracePeriodSeconds: 60
    });
  });

  test('creates ECS service with network configuration', () => {
    const stack = new EcsServiceStack(app, 'NetworkConfigEcsService', {
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
          desiredCount: 1,
          networkConfiguration: {
            assignPublicIp: false
          }
        },
        loadBalancer: {
          type: 'APPLICATION',
          port: 80
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify network configuration
    template.hasResourceProperties('AWS::ECS::Service', {
      NetworkConfiguration: {
        AwsvpcConfiguration: {
          AssignPublicIp: 'DISABLED'
        }
      }
    });
  });
}); 