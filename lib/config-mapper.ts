/**
 * Configuration mapper for converting between structured and legacy formats
 * Maintains backward compatibility while supporting new Helm-like structure
 */

import * as cdk from 'aws-cdk-lib';
import { EcsServiceConfig } from './types';

/**
 * Configuration mapper class
 */
export class ConfigMapper {
  
  
  

  

  
  /**
   * Detect if configuration is in structured format
   */
  static isStructuredConfig(config: any): config is EcsServiceConfig {
    return config && (
      config.infrastructure !== undefined ||
      config.cluster !== undefined ||
      config.taskDefinition !== undefined ||
      config.service !== undefined ||
      config.loadBalancer !== undefined ||
      config.autoScaling !== undefined ||
      config.iam !== undefined ||
      config.serviceDiscovery !== undefined
    );
  }
} 