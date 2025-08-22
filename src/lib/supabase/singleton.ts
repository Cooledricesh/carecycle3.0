'use client'

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/**
 * Singleton Supabase Client Manager
 * Ensures a single client instance across the entire application
 * This prevents session inconsistencies and authentication issues
 */
class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private client: SupabaseClient<Database> | null = null;
  private initPromise: Promise<SupabaseClient<Database>> | null = null;

  private constructor() {}

  static getInstance(): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager();
    }
    return SupabaseClientManager.instance;
  }

  /**
   * Get or create the Supabase client
   * Ensures only one client instance exists
   */
  async getClient(): Promise<SupabaseClient<Database>> {
    // If client already exists and is initialized, return it
    if (this.client) {
      return this.client;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = this.initializeClient();
    this.client = await this.initPromise;
    this.initPromise = null;

    return this.client;
  }

  /**
   * Get client synchronously (for immediate use)
   * Creates client if not exists, but doesn't wait for session
   */
  getClientSync(): SupabaseClient<Database> {
    if (!this.client) {
      this.client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return this.client;
  }

  private async initializeClient(): Promise<SupabaseClient<Database>> {
    const client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Wait for session to be restored
    await client.auth.getSession();
    
    return client;
  }

  /**
   * Force refresh the session
   * Useful after authentication state changes
   */
  async refreshSession(): Promise<void> {
    const client = await this.getClient();
    await client.auth.getSession();
  }
}

// Export singleton instance getter
export const supabaseManager = SupabaseClientManager.getInstance();

// Export convenience functions
export const getSupabaseClient = () => supabaseManager.getClientSync();
export const getSupabaseClientAsync = () => supabaseManager.getClient();