import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function apiBaseUrl() {
  return (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const targetUrl = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, apiBaseUrl());
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("content-encoding");

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
