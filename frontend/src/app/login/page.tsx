"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { djangoLogin } from "@/lib/django-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";
import { ThemeToggleCorner } from "@/components/theme-toggle";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check for error from redirect
  const authError = searchParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await djangoLogin(email.trim(), password);

      if (!result.ok) {
        setError(result.error || "Login xatosi");
        setLoading(false);
        return;
      }

      const targetPath =
        result.user?.role === "oqituvchi"
          ? "/dashboard/teacher"
          : "/dashboard/admin";
      router.push(targetPath as string);
      router.refresh();
    } catch {
      setError("Server bilan bog'lanishda xato. Qaytadan urinib ko'ring.");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center space-y-1">
        <CardTitle className="text-2xl font-bold">Tizimga kirish</CardTitle>
        <CardDescription>
          Elektron pochta va parol bilan kirish
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Auth callback error */}
          {authError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Tasdiqlash amalga oshmadi. Iltimos, qaytadan urinib ko&apos;ring.
              </AlertDescription>
            </Alert>
          )}

          {/* Login error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Elektron pochta</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@university.uz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Parol</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Kirish
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 items-center">
        <Link
          href="/reset-password"
          className="text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          Parolni unutdingizmi?
        </Link>
        <p className="text-sm text-muted-foreground">
          Hisobingiz yo&apos;qmi?{" "}
          <Link
            href="/signup"
            className="text-primary font-medium hover:underline"
          >
            Ro&apos;yxatdan o&apos;ting
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4">
      <ThemeToggleCorner />
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-8">
        <img
          src="/ustoz-logo.png"
          alt="ProYuk"
          className="h-12 w-12 rounded-lg"
        />
        <span className="text-2xl font-bold tracking-tight text-foreground">
          Pro<span className="text-primary">Yuk</span>
        </span>
      </Link>

      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
