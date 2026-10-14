// Browser requests use the same-origin API; session cookies stay HttpOnly.
export interface AuthUser {
  id: string | number;
  email?: string;
  fio?: string;
  role?: string;
  [key: string]: unknown;
}

export interface LoginResult {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

export async function djangoLogin(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return res.ok
      ? { ok: true, user: data.user }
      : { ok: false, error: data.detail || data.error || data.email?.[0] || data.password?.[0] || "Elektron pochta yoki parol noto'g'ri" };
  } catch {
    return { ok: false, error: "Backend bilan ulanishda xato" };
  }
}

export async function djangoLogout(): Promise<void> {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error("Tizimdan chiqishda xato");
}

export async function djangoChangePassword(oldPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
    const data = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: data.detail || data.error || data.email?.[0] || data.password?.[0] || "Parol o'zgartirishda xato" };
  } catch {
    return { ok: false, error: "Backend bilan ulanishda xato" };
  }
}
