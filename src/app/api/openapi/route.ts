import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'

export async function GET() {
  try {
    const yamlPath = join(process.cwd(), 'docs', 'openapi.yaml')
    const yamlContent = await readFile(yamlPath, 'utf-8')
    const openApiSpec = yaml.load(yamlContent)
    
    return NextResponse.json(openApiSpec)
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error)
    return NextResponse.json(
      { error: 'Failed to load API documentation' },
      { status: 500 }
    )
  }
}