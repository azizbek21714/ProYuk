import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggleCorner } from "@/components/theme-toggle";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <ThemeToggleCorner />
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Parolni tiklash</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Parolni tiklash uchun tizim administratoriga murojaat qiling.
            Tizimga kirgan bo'lsangiz, kabinetingizdan joriy parolni o'zgartirishingiz mumkin.
          </p>
          <Button asChild className="w-full"><Link href="/login">Kirish sahifasiga qaytish</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
