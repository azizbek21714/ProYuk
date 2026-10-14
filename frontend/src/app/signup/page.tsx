"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserPlus, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { ThemeToggleCorner } from "@/components/theme-toggle";

const ROLES = [
  { value: "oqituvchi", label: "O'qituvchi" },
];

export default function SignupPage() {
  const [fio, setFio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("oqituvchi");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!role) {
      setError("Iltimos, lavozimni tanlang.");
      return;
    }

    setLoading(true);

    try {
      // FIO dan first_name va last_name ajratamiz
      const parts = fio.trim().split(/\s+/);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          email: email.trim(),
          first_name: firstName,
          last_name: lastName,
          fio,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Django xatolarini ko'rsatish
        const msg =
          data?.password?.[0] ||
          data?.email?.[0] ||
          data?.detail ||
          data?.error ||
          Object.values(data)?.[0] ||
          "Ro'yxatdan o'tishda xato";
        setError(String(msg));
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError("Server bilan bog'lanishda xato. Qaytadan urinib ko'ring.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4">
        <ThemeToggleCorner />
        <Link href="/" className="flex items-center gap-3 mb-8">
          <img src="/ustoz-logo.png" alt="ProYuk" className="h-12 w-12 rounded-lg" />
          <span className="text-2xl font-bold tracking-tight text-foreground">
            Pro<span className="text-primary">Yuk</span>
          </span>
        </Link>
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Ro&apos;yxatdan o&apos;tish muvaffaqiyatli!
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hisobingiz yaratildi. Endi elektron pochta va parol bilan tizimga kiring.
            </p>
            <div className="pt-2">
              <Link href="/login">
                <Button variant="outline" className="gap-2">
                  Tizimga kirish
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-8">
      <ThemeToggleCorner />
      <Link href="/" className="flex items-center gap-3 mb-8">
        <img src="/ustoz-logo.png" alt="ProYuk" className="h-12 w-12 rounded-lg" />
        <span className="text-2xl font-bold tracking-tight text-foreground">
          Pro<span className="text-primary">Yuk</span>
        </span>
      </Link>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold">Ro&apos;yxatdan o&apos;tish</CardTitle>
          <CardDescription>Yangi hisob yaratish uchun ma&apos;lumotlaringizni kiriting</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="fio">F.I.O. (to&apos;liq ism)</Label>
              <Input
                id="fio"
                type="text"
                placeholder="Ism Familiya Otaism"
                value={fio}
                onChange={(e) => setFio(e.target.value)}
                required
                disabled={loading}
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">Elektron pochta</Label>
              <Input
                id="signup-email"
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
              <Label htmlFor="signup-password">Parol</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Kamida 8 belgi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Lavozim</Label>
              <Select value={role} onValueChange={setRole} disabled={loading}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Lavozimni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Ro&apos;yxatdan o&apos;tish
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Hisobingiz bormi?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Tizimga kiring
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
