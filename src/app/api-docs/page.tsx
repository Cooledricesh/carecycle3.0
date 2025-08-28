'use client'

import { useEffect, useState } from 'react'
import { ApiReferenceReact } from '@scalar/api-reference-react'

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
    <div className="min-h-screen">
      <ApiReferenceReact 
        configuration={{
          content: spec,
          theme: 'default',
          layout: 'modern',
          showSidebar: true,
          searchHotKey: 'k',
          hideDownloadButton: false,
          hideTestRequestButton: false,
          hideModels: false,
          hiddenClients: [],
          customCss: '',
        }}
      />
    </div>
  )
}