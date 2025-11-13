import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["nurse", "admin", "doctor"]).default("nurse"),
  care_type: z.string().optional(), // Deprecated: use department_id instead
  department_id: z.string().uuid().optional(), // Preferred: FK to departments table
  phone: z.string().optional(),
  organization_id: z.string().optional(), // Optional for 2-step signup flow
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role, care_type, department_id, phone, organization_id } = signupSchema.parse(body);

    const supabase = await createClient();

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Signup failed" },
        { status: 400 }
      );
    }

    // Profile is automatically created by handle_new_user() trigger
    // Only update additional fields if provided (department, organization, phone)
    if (department_id || organization_id || phone) {
      const serviceSupabase = await createServiceClient();

      // Resolve department_id if care_type is provided (backward compatibility)
      let finalDepartmentId: string | null = department_id || null;
      if (!finalDepartmentId && care_type && organization_id && role === 'nurse') {
        // Try to find department by name (migration support)
        const { data: departmentData } = await serviceSupabase
          .from('departments')
          .select('id')
          .eq('organization_id', organization_id)
          .eq('name', care_type)
          .eq('is_active', true)
          .single();

        if (departmentData) {
          finalDepartmentId = (departmentData as any).id;
        }
      }

      // Update profile with additional fields (not managed by trigger)
      const updateData: any = {};

      if (finalDepartmentId) {
        updateData.department_id = finalDepartmentId;
      }

      if (organization_id) {
        updateData.organization_id = organization_id;
      }

      if (phone) {
        updateData.phone = phone;
      }

      // Only update if there's data to update
      if (Object.keys(updateData).length > 0) {
        const { error: profileError } = await (serviceSupabase as any)
          .from("profiles")
          .update(updateData)
          .eq('id', data.user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
          // Don't fail the signup if profile update fails
        }
      }
    }

    // Note: Basic profile (id, email, name, role) is created by handle_new_user() trigger
    // This ensures no duplicate profile creation and consistent name handling

    // CRITICAL: Session is automatically set via Supabase SSR cookie handling
    // The createClient() call uses @supabase/ssr which manages cookies automatically
    // Client-side should refresh session after signup to ensure consistency
    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: "Account created successfully. Please check your email for verification.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}