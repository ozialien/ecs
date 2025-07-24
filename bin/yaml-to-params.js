#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');

if (process.argv.length < 3) {
  console.error('Usage: node yaml-to-params.js <yaml-file>');
  process.exit(1);
}

const yamlFile = process.argv[2];

try {
  const yamlContent = fs.readFileSync(yamlFile, 'utf8');
  const values = yaml.load(yamlContent);
  
  const params = [];
  
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      params.push(`ParameterKey=${key},ParameterValue="${value.join(',')}"`);
    } else {
      params.push(`ParameterKey=${key},ParameterValue="${value}"`);
    }
  }
  
  console.log(params.join(' '));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} 