import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";

/**
 * POST /api/organizations/search
 *
 * Search organizations by name for signup/join request flow
 * No authentication required (for signup process)
 *
 * Body:
 * - search_term: string (required) - Organization name to search
 * - limit?: number (optional, default 10) - Maximum number of results
 *
 * Returns:
 * - Array of organizations with id, name, and member_count
 */

const searchSchema = z.object({
  search_term: z.string().min(1, "Search term is required"),
  limit: z.number().int().positive().max(50).default(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { search_term, limit } = searchSchema.parse(body);

    // Use service client (no auth required for org search during signup)
    const supabase = await createServiceClient();

    // Call RPC function: search_organizations(p_search_term, p_limit)
    const rpcArgs = {
      p_search_term: search_term,
      p_limit: limit,
    };

    const { data, error } = await (supabase as any).rpc("search_organizations", rpcArgs);

    if (error) {
      console.error("Error searching organizations:", error);
      return NextResponse.json(
        { error: "Failed to search organizations", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      message: `Found ${data?.length || 0} organization(s)`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Organization search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
