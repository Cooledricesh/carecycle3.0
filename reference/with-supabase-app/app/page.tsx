import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>Auth Reference</Link>
            </div>
            <AuthButton />
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
          <main className="flex-1 flex flex-col gap-6 px-4">
            <h2 className="font-medium text-xl mb-4">Authentication Reference</h2>
            <p>This is a clean authentication reference implementation using Next.js and Supabase.</p>
            <div className="flex flex-col gap-2">
              <Link href="/auth/login" className="text-blue-600 hover:underline">Login</Link>
              <Link href="/auth/sign-up" className="text-blue-600 hover:underline">Sign Up</Link>
              <Link href="/protected" className="text-blue-600 hover:underline">Protected Page</Link>
            </div>
          </main>
        </div>
      </div>
    </main>
  );
}