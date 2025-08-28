'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Loading API Documentation...</div>
    </div>
  ),
})

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null)

  useEffect(() => {
    fetch('/api/openapi')
      .then((res) => res.json())
      .then((data) => setSpec(data))
      .catch((error) => console.error('Failed to load OpenAPI spec:', error))
  }, [])

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading API Documentation...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6 px-4">API Documentation</h1>
        <div className="swagger-wrapper">
          <SwaggerUI 
            spec={spec}
            docExpansion="list"
            defaultModelsExpandDepth={1}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            tryItOutEnabled={true}
          />
        </div>
      </div>
    </div>
  )
}