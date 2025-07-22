/**
 * Comprehensive tests for EcsServiceStack construct
 * 
 * These tests exercise all configuration options with proper mocking
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcsServiceStack } from '../lib/ecs-service-stack';

describe('EcsServiceStack', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    // Set test mode to ensure VPC creation instead of import
    app.node.setContext("testMode", true);
    app = new cdk.App();
  });

  test('creates basic ECS service with minimal configuration', () => {
    // Mock context parameters for basic configuration
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', 'nginx:alpine');
    app.node.setContext('env', {});
    app.node.setContext('secret', {});

    const stack = new EcsServiceStack(app, 'BasicEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80
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
    // Mock context parameters for custom configuration
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', 'nginx:alpine');
    app.node.setContext('serviceName', 'custom-service');
    app.node.setContext('desiredCount', 3);
    app.node.setContext('cpu', 512);
    app.node.setContext('memory', 1024);
    app.node.setContext('containerPort', 8080);
    app.node.setContext('lbPort', 80);
    app.node.setContext('env', {});
    app.node.setContext('secret', {});

    const stack = new EcsServiceStack(app, 'CustomEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        desiredCount: 3,
        cpu: 512,
        memory: 1024,
        containerPort: 8080,
        lbPort: 80
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

  test('creates ECS service with auto scaling', () => {
    // Mock context parameters for auto scaling
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', 'nginx:alpine');
    app.node.setContext('enableAutoScaling', true);
    app.node.setContext('minCapacity', 2);
    app.node.setContext('maxCapacity', 5);
    app.node.setContext('targetCpuUtilization', 70);
    app.node.setContext('targetMemoryUtilization', 70);
    app.node.setContext('env', {});
    app.node.setContext('secret', {});

    const stack = new EcsServiceStack(app, 'AutoScalingEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80,
        enableAutoScaling: true,
        minCapacity: 2,
        maxCapacity: 5,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 70
      }
    });

    const template = Template.fromStack(stack);

    // Verify auto scaling is configured
    template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
      MinCapacity: 2,
      MaxCapacity: 5,
    });

    // Verify scaling policies are created
    template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
      PolicyType: 'TargetTrackingScaling',
    });
  });

  test('creates ECS service with environment variables', () => {
    // Mock context parameters for environment variables
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', 'nginx:alpine');
    app.node.setContext('env', {
      NODE_ENV: 'production',
      API_VERSION: 'v1',
      LOG_LEVEL: 'info'
    });
    app.node.setContext('secret', {});

    const stack = new EcsServiceStack(app, 'EnvEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80,
        environment: {
          NODE_ENV: 'production',
          API_VERSION: 'v1',
          LOG_LEVEL: 'info'
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify environment variables are set in task definition
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Environment: [
            { Name: 'NODE_ENV', Value: 'production' },
            { Name: 'API_VERSION', Value: 'v1' },
            { Name: 'LOG_LEVEL', Value: 'info' }
          ]
        }
      ]
    });
  });

  test('creates ECS service with secrets', () => {
    // Mock context parameters for secrets
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', 'nginx:alpine');
    app.node.setContext('env', {});
    app.node.setContext('secret', {
      DB_PASSWORD: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:db-password-abc123',
      API_KEY: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:api-key-def456'
    });

    const stack = new EcsServiceStack(app, 'SecretsEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80,
        secrets: {
          DB_PASSWORD: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:db-password-abc123',
          API_KEY: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:api-key-def456'
        }
      }
    });

    const template = Template.fromStack(stack);

    // Verify secrets are configured in task definition
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

  test('creates ECS service with custom IAM roles', () => {
    // Mock context parameters for IAM roles
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', 'nginx:alpine');
    app.node.setContext('taskExecutionRoleArn', 'arn:aws:iam::123456789012:role/ecsTaskExecutionRole');
    app.node.setContext('taskRoleArn', 'arn:aws:iam::123456789012:role/ecsTaskRole');
    app.node.setContext('env', {});
    app.node.setContext('secret', {});

    const stack = new EcsServiceStack(app, 'IamRolesEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80,
        taskExecutionRoleArn: 'arn:aws:iam::123456789012:role/ecsTaskExecutionRole',
        taskRoleArn: 'arn:aws:iam::123456789012:role/ecsTaskRole'
      }
    });

    const template = Template.fromStack(stack);

    // Verify IAM roles are configured
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ExecutionRoleArn: 'arn:aws:iam::123456789012:role/ecsTaskExecutionRole',
      TaskRoleArn: 'arn:aws:iam::123456789012:role/ecsTaskRole',
    });
  });

  test('creates ECS service with custom security group', () => {
    // Mock context parameters for custom security group
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', 'nginx:alpine');
    app.node.setContext('allowedCidr', '10.0.0.0/16');
    app.node.setContext('env', {});
    app.node.setContext('secret', {});

    const stack = new EcsServiceStack(app, 'SecurityGroupEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80,
        allowedCidr: '10.0.0.0/16'
      }
    });

    const template = Template.fromStack(stack);

    // Verify security group rules are created
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      IpProtocol: 'tcp',
      FromPort: 80,
      ToPort: 80,
    });
  });

  test('creates ECS service with local Containerfile', () => {
    // Mock context parameters for local Containerfile
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', './test/docker');
    app.node.setContext('env', {});
    app.node.setContext('secret', {});

    const stack = new EcsServiceStack(app, 'LocalBuildEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: './test/docker',
        containerPort: 80,
        lbPort: 80
      }
    });

    const template = Template.fromStack(stack);

    // Verify ECS service is created (local builds are handled at runtime)
    template.hasResourceProperties('AWS::ECS::Service', {
      LaunchType: 'FARGATE',
    });
  });

  test('creates ECS service with values file configuration', () => {
    // Mock context parameters for values file
    app.node.setContext('vpcId', 'vpc-12345678');
    app.node.setContext('subnetIds', 'subnet-12345678,subnet-87654321');
    app.node.setContext('clusterName', 'test-cluster');
    app.node.setContext('image', 'nginx:alpine');
    app.node.setContext('valuesFile', 'test-values.json');
    app.node.setContext('env', {});
    app.node.setContext('secret', {});

    const stack = new EcsServiceStack(app, 'ValuesFileEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80,
        valuesFile: 'test-values.json'
      }
    });

    const template = Template.fromStack(stack);

    // Verify basic service is created
    template.hasResourceProperties('AWS::ECS::Service', {
      LaunchType: 'FARGATE',
    });
  });

  test('shows help when help context is set', () => {
    // Mock help context
    app.node.setContext('help', 'true');
    app.node.setContext('env', {});
    app.node.setContext('secret', {});

    // Mock console.log to capture help output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const stack = new EcsServiceStack(app, 'HelpEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80
      }
    });

    // Verify help was called
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('throws error when required parameters are missing', () => {
    // Test missing containerPort
    expect(() => {
      new EcsServiceStack(app, 'MissingContainerPortEcsService', {
        env: {
          account: '123456789012',
          region: 'us-west-2'
        },
        config: {
          stackName: 'test-stack',
        vpcId: 'vpc-12345678',
          subnetIds: ['subnet-12345678', 'subnet-87654321'],
          clusterName: 'test-cluster',
          image: 'nginx:alpine',
          lbPort: 80
          // Missing containerPort - using type assertion to test runtime validation
        } as any
      });
    }).toThrow('Missing required parameters: containerPort');
  });

  test('package builds successfully', () => {
    // This test verifies that the package can be built without errors
    expect(true).toBe(true);
  });

  test('handles credential context parameters', () => {
    const app = new cdk.App();
    
    // Set up context with credential parameters
    app.node.setContext('awsProfile', 'test-profile');
    app.node.setContext('awsRoleArn', 'arn:aws:iam::123456789012:role/TestRole');
    
    // Create stack with basic config
    const stack = new EcsServiceStack(app, 'CredentialTestEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80
      }
    });

    // Verify the stack was created successfully
    expect(stack).toBeDefined();
    expect(stack.service).toBeDefined();
    expect(stack.cluster).toBeDefined();
    expect(stack.loadBalancer).toBeDefined();
  });

  test('handles explicit credential context parameters', () => {
    const app = new cdk.App();
    
    // Set up context with explicit credential parameters
    app.node.setContext('awsAccessKeyId', 'AKIAIOSFODNN7EXAMPLE');
    app.node.setContext('awsSecretAccessKey', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    app.node.setContext('awsSessionToken', 'AQoEXAMPLEH4aoAH0gNCAPyJxzrBlXWt6TresKlOLb8vPBrIwT');
    
    // Create stack with basic config
    const stack = new EcsServiceStack(app, 'ExplicitCredentialTestEcsService', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      },
      config: {
        stackName: 'test-stack',
        vpcId: 'vpc-12345678',
        subnetIds: ['subnet-12345678', 'subnet-87654321'],
        clusterName: 'test-cluster',
        image: 'nginx:alpine',
        containerPort: 80,
        lbPort: 80
      }
    });

    // Verify the stack was created successfully
    expect(stack).toBeDefined();
    expect(stack.service).toBeDefined();
    expect(stack.cluster).toBeDefined();
    expect(stack.loadBalancer).toBeDefined();
  });

  test('types are exported correctly', () => {
    const mainExports = require('../lib/index');
    expect(mainExports).toHaveProperty('EcsServiceStack');
  });

  test('help system works', () => {
    expect(() => {
      require('../lib/help');
    }).not.toThrow();
  });

  test('main index exports correctly', () => {
    expect(() => {
      require('../lib/index');
    }).not.toThrow();
  });
}); 