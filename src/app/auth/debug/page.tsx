'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthDebugPage() {
  const [cleared, setCleared] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const clearAllAuthData = () => {
    const newLogs: string[] = [];
    
    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
      if (key.includes('supabase') || key.includes('auth')) {
        localStorage.removeItem(key);
        newLogs.push(`Removed localStorage: ${key}`);
      }
    });
    
    // Clear sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
      if (key.includes('supabase') || key.includes('auth')) {
        sessionStorage.removeItem(key);
        newLogs.push(`Removed sessionStorage: ${key}`);
      }
    });
    
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`;
      document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/;domain=${window.location.hostname}`;
      document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/;domain=.${window.location.hostname}`;
      newLogs.push(`Cleared cookie: ${name}`);
    });
    
    // Clear IndexedDB
    if ('indexedDB' in window) {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name?.includes('supabase')) {
            indexedDB.deleteDatabase(db.name);
            newLogs.push(`Deleted IndexedDB: ${db.name}`);
          }
        });
      });
    }
    
    setLogs(newLogs);
    setCleared(true);
  };

  const checkAuthStatus = () => {
    const status = {
      localStorage: Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('auth')),
      sessionStorage: Object.keys(sessionStorage).filter(k => k.includes('supabase') || k.includes('auth')),
      cookies: document.cookie.split(';').map(c => c.trim().split('=')[0])
    };
    
    setLogs([
      'Current Auth Storage:',
      `LocalStorage keys: ${status.localStorage.join(', ') || 'none'}`,
      `SessionStorage keys: ${status.sessionStorage.join(', ') || 'none'}`,
      `Cookies: ${status.cookies.join(', ') || 'none'}`
    ]);
  };

  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Auth Debug Tool</CardTitle>
          <CardDescription>
            Clear all authentication data to fix login issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-x-4">
            <Button onClick={checkAuthStatus} variant="outline">
              Check Auth Storage
            </Button>
            <Button onClick={clearAllAuthData} variant="destructive">
              Clear All Auth Data
            </Button>
          </div>
          
          {cleared && (
            <div className="p-4 bg-green-50 text-green-800 rounded">
              All auth data cleared! Please go to{' '}
              <a href="/auth/signin" className="underline font-semibold">
                /auth/signin
              </a>{' '}
              to login again.
            </div>
          )}
          
          {logs.length > 0 && (
            <div className="p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Debug Logs:</h3>
              <pre className="text-xs whitespace-pre-wrap">
                {logs.join('\n')}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}