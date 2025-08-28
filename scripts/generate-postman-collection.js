#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Read OpenAPI spec
const openApiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
const openApiSpec = yaml.load(fs.readFileSync(openApiPath, 'utf8'));

// Convert OpenAPI to Postman Collection
function convertToPostmanCollection(openApi) {
  const collection = {
    info: {
      name: openApi.info.title,
      description: openApi.info.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: [],
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{access_token}}',
          type: 'string'
        }
      ]
    },
    variable: [
      {
        key: 'baseUrl',
        value: openApi.servers[0].url,
        type: 'string'
      },
      {
        key: 'access_token',
        value: '',
        type: 'string'
      }
    ]
  };

  // Group endpoints by tags
  const folders = {};
  
  // Process each path
  Object.entries(openApi.paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, endpoint]) => {
      if (typeof endpoint !== 'object' || !endpoint.tags) return;
      
      const tag = endpoint.tags[0] || 'Other';
      
      if (!folders[tag]) {
        folders[tag] = {
          name: tag,
          item: []
        };
      }

      const request = {
        name: endpoint.summary || `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          header: [],
          url: {
            raw: `{{baseUrl}}${path}`,
            host: ['{{baseUrl}}'],
            path: path.split('/').filter(p => p)
          },
          description: endpoint.description
        },
        response: []
      };

      // Add auth if not explicitly disabled
      if (!endpoint.security || endpoint.security.length > 0) {
        request.request.auth = {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{access_token}}',
              type: 'string'
            }
          ]
        };
      } else {
        request.request.auth = {
          type: 'noauth'
        };
      }

      // Add query parameters
      if (endpoint.parameters) {
        const queryParams = endpoint.parameters
          .filter(p => p.in === 'query')
          .map(p => ({
            key: p.name,
            value: p.example || '',
            description: p.description,
            disabled: !p.required
          }));

        if (queryParams.length > 0) {
          request.request.url.query = queryParams;
        }

        // Add path parameters
        const pathParams = endpoint.parameters
          .filter(p => p.in === 'path')
          .map(p => ({
            key: p.name,
            value: p.example || `:${p.name}`,
            description: p.description
          }));

        if (pathParams.length > 0) {
          request.request.url.variable = pathParams;
        }
      }

      // Add request body if present
      if (endpoint.requestBody) {
        const content = endpoint.requestBody.content;
        if (content && content['application/json']) {
          request.request.header.push({
            key: 'Content-Type',
            value: 'application/json'
          });

          const schema = content['application/json'].schema;
          const example = generateExampleFromSchema(schema, openApi.components?.schemas);
          
          request.request.body = {
            mode: 'raw',
            raw: JSON.stringify(example, null, 2),
            options: {
              raw: {
                language: 'json'
              }
            }
          };
        }
      }

      // Add example responses
      if (endpoint.responses) {
        Object.entries(endpoint.responses).forEach(([statusCode, response]) => {
          const exampleResponse = {
            name: `${statusCode} - ${response.description}`,
            originalRequest: request.request,
            status: response.description,
            code: parseInt(statusCode),
            header: [
              {
                key: 'Content-Type',
                value: 'application/json'
              }
            ],
            body: ''
          };

          if (response.content?.['application/json']?.schema) {
            const example = generateExampleFromSchema(
              response.content['application/json'].schema,
              openApi.components?.schemas
            );
            exampleResponse.body = JSON.stringify(example, null, 2);
          }

          request.response.push(exampleResponse);
        });
      }

      folders[tag].item.push(request);
    });
  });

  // Add folders to collection
  collection.item = Object.values(folders);

  return collection;
}

// Generate example data from schema
function generateExampleFromSchema(schema, definitions = {}) {
  if (!schema) return null;

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    return generateExampleFromSchema(definitions[refName], definitions);
  }

  if (schema.allOf) {
    let combined = {};
    schema.allOf.forEach(subSchema => {
      const example = generateExampleFromSchema(subSchema, definitions);
      combined = { ...combined, ...example };
    });
    return combined;
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  switch (schema.type) {
    case 'object':
      const obj = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, prop]) => {
          obj[key] = generateExampleFromSchema(prop, definitions);
        });
      }
      return obj;

    case 'array':
      const itemExample = generateExampleFromSchema(schema.items, definitions);
      return [itemExample];

    case 'string':
      if (schema.format === 'date-time') return '2025-01-01T00:00:00Z';
      if (schema.format === 'date') return '2025-01-01';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
      if (schema.enum) return schema.enum[0];
      if (schema.pattern) return 'pattern-value';
      return schema.example || 'string';

    case 'integer':
    case 'number':
      if (schema.minimum !== undefined) return schema.minimum;
      if (schema.maximum !== undefined) return schema.maximum;
      return schema.example || 1;

    case 'boolean':
      return true;

    default:
      return null;
  }
}

// Convert and save
const postmanCollection = convertToPostmanCollection(openApiSpec);
const outputPath = path.join(__dirname, '..', 'docs', 'medical-scheduler.postman_collection.json');

fs.writeFileSync(outputPath, JSON.stringify(postmanCollection, null, 2));
console.log(`✅ Postman collection generated successfully: ${outputPath}`);

// Also create environment file
const environment = {
  name: 'Medical Scheduler - Development',
  values: [
    {
      key: 'baseUrl',
      value: 'http://localhost:3000/api',
      enabled: true,
      type: 'default'
    },
    {
      key: 'access_token',
      value: '',
      enabled: true,
      type: 'secret'
    },
    {
      key: 'refresh_token',
      value: '',
      enabled: true,
      type: 'secret'
    }
  ]
};

const envPath = path.join(__dirname, '..', 'docs', 'medical-scheduler.postman_environment.json');
fs.writeFileSync(envPath, JSON.stringify(environment, null, 2));
console.log(`✅ Postman environment generated successfully: ${envPath}`);