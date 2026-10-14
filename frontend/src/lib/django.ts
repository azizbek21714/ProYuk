import { NextRequest, NextResponse } from "next/server";

export const DJANGO_BASE = (process.env.DJANGO_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export function getToken(req: NextRequest): string | null {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getCookie(req: NextRequest, name: string): string | null {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function refreshAccessToken(req: NextRequest): Promise<{
  access: string;
  refresh?: string;
} | null> {
  const refresh = getCookie(req, "refresh");
  if (!refresh) return null;
  try {
    const response = await fetch(`${DJANGO_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access?: string; refresh?: string };
    return data.access ? { access: data.access, refresh: data.refresh } : null;
  } catch {
    return null;
  }
}

function setAuthCookies(
  response: NextResponse,
  req: NextRequest,
  tokens: { access: string; refresh?: string }
) {
  const secure = req.nextUrl.protocol === "https:";
  response.cookies.set("token", tokens.access, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  if (tokens.refresh) {
    response.cookies.set("refresh", tokens.refresh, {
      httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
}

function buildHeaders(token: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Generic proxy for /api/crud/{resource}/ endpoints
export async function djangoProxy(
  req: NextRequest,
  resource: string
): Promise<NextResponse> {
  const token = getToken(req);
  const method = req.method;
  const srcUrl = new URL(req.url);
  const idParam = srcUrl.searchParams.get("id");

  const fwdParams = new URLSearchParams(srcUrl.searchParams);
  fwdParams.delete("id");

  let resourceId: string | null = idParam;
  let body: string | undefined;

  if (["POST", "PUT", "PATCH"].includes(method)) {
    try {
      const bodyObj = await req.json();
      if ((method === "PUT" || method === "PATCH") && bodyObj.id != null) {
        resourceId = String(bodyObj.id);
        delete bodyObj.id;
      }
      body = JSON.stringify(bodyObj);
    } catch {
      body = "{}";
    }
  }

  const needsDetail = resourceId != null && method !== "POST";
  const basePath = needsDetail
    ? `/api/crud/${resource}/${resourceId}/`
    : `/api/crud/${resource}/`;

  const qs = fwdParams.toString();
  const djangoUrl = `${DJANGO_BASE}${basePath}${qs ? "?" + qs : ""}`;

  try {
    let res = await fetch(djangoUrl, {
      method,
      headers: buildHeaders(token),
      body,
    });
    let refreshed: { access: string; refresh?: string } | null = null;
    if (res.status === 401) {
      refreshed = await refreshAccessToken(req);
      if (refreshed) {
        res = await fetch(djangoUrl, {
          method,
          headers: buildHeaders(refreshed.access),
          body,
        });
      }
    }
    // 204 No Content (DELETE muvaffaqiyatli) — body yo'q
    if (res.status === 204 || res.status === 205) {
      const response = new NextResponse(null, { status: res.status });
      if (refreshed) setAuthCookies(response, req, refreshed);
      return response;
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      const response = NextResponse.json(data, { status: res.status });
      if (refreshed) setAuthCookies(response, req, refreshed);
      return response;
    }
    const text = await res.text();
    const response = new NextResponse(text || null, { status: res.status });
    if (refreshed) setAuthCookies(response, req, refreshed);
    return response;
  } catch (err) {
    console.error(`[django-proxy] ${method} ${djangoUrl}:`, err);
    return NextResponse.json(
      { error: "Backend bilan ulanishda xato" },
      { status: 502 }
    );
  }
}

// Generic fetch for non-CRUD endpoints (auth, dashboard, etc.)
export async function djangoFetch(
  path: string,
  init: RequestInit & { token?: string | null } = {}
): Promise<{ data: unknown; status: number }> {
  const { token, ...fetchInit } = init;
  const url = `${DJANGO_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchInit.headers as Record<string, string>),
  };
  try {
    const res = await fetch(url, { ...fetchInit, headers });
    const data = await res.json().catch(() => null);
    return { data, status: res.status };
  } catch (err) {
    console.error(`[django-fetch] ${path}:`, err);
    return { data: { error: "Backend bilan ulanishda xato" }, status: 502 };
  }
}
