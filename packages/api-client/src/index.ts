export interface Tenant {
  slug: string;
  name: string;
  published: boolean;
}

export interface Session {
  user: { email: string };
  tenant: Tenant;
}

export interface ProductOptionInput {
  name: string;
  values: string[];
}

export interface ProductOption extends ProductOptionInput {
  id: string;
}

export interface ProductVariantInput {
  id?: string;
  title: string;
  sku: string;
  priceCents: number;
  stock: number;
  selectedOptions: Record<string, string>;
}

export interface ProductVariant extends ProductVariantInput {
  id: string;
}

export interface ProductInput {
  name: string;
  description: string;
  sku: string;
  priceCents: number;
  stock: number;
  imageId?: string | null;
  options?: ProductOptionInput[];
  variants?: ProductVariantInput[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  priceCents: number;
  stock: number;
  imageId: string | null;
  options: ProductOption[];
  variants: ProductVariant[];
}

export interface Order {
  id: string;
  number: string;
  totalCents: number;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  createdAt: string;
  status: "pending" | "fulfilled";
  items: { name: string; variantTitle?: string; sku: string; quantity: number; priceCents: number }[];
}

export interface StudioOverview {
  tenant: Tenant;
  products: Product[];
  orders: Order[];
  theme: AppearanceTheme | null;
}

export interface Store {
  tenant: Tenant;
  products: Product[];
  theme: AppearanceTheme | null;
}

export type ThemeScope = "studio" | "storefront";
export type ThemeMode = "light" | "dark";

export interface ThemePalette {
  background: string;
  surface: string;
  text: string;
  accent: string;
}

export interface AppearanceTheme {
  displayName: string;
  logoId: string | null;
  bannerId: string | null;
  light: ThemePalette;
  dark: ThemePalette;
}

export interface ThemeState {
  draft: AppearanceTheme;
  published: AppearanceTheme | null;
  version: number;
  revision: number;
}

export type AppearanceState = Record<ThemeScope, ThemeState>;

export interface CheckoutInput {
  checkoutKey: string;
  items: { productId: string; variantId?: string; quantity: number }[];
  customer: { name: string; email: string; address: string };
  payment: "approved" | "declined";
}

export interface PlatformAuditEntry {
  id: string;
  actor: string;
  action: string;
  targetSlug: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformTenant extends Tenant {
  status: "active" | "suspended";
}

export interface PlatformOverview {
  tenants: PlatformTenant[];
  orderCount: number;
  revenueCents: number;
  auditLogs: PlatformAuditEntry[];
}

interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  storeName: string;
  slug: string;
}

export const websiteUrl = "/";
export const platformUrl = "/control";
export const studioUrl = "/studio";
export const storefrontUrl = "/tiendas";

export function websiteLoginUrl() {
  return "/?mode=login#acceso";
}

export const storeUrl = (slug: string) =>
  `${storefrontUrl}/${encodeURIComponent(slug)}`;

const apiUrl = "/api";

export const studioMediaUrl = (id: string) => `${apiUrl}/studio/media/${encodeURIComponent(id)}`;
export const storeMediaUrl = (slug: string, id: string) =>
  `${apiUrl}/store/${encodeURIComponent(slug)}/media/${encodeURIComponent(id)}`;

export const storeAtelierUrl = (slug: string) => `${apiUrl}/store/${encodeURIComponent(slug)}/atelier`;
export const studioAtelierDraftUrl = `${apiUrl}/studio/appearance/storefront/atelier`;

export class ApiError extends Error {
  constructor(readonly status: number) {
    super("Error al consultar la API");
    this.name = "ApiError";
  }
}

export function errorStatus(error: unknown) {
  return error instanceof ApiError ? error.status : undefined;
}

export function errorMessage(
  error: unknown,
  fallback: string,
  messages: Partial<Record<number, string>> = {},
) {
  const status = errorStatus(error);
  if (status && messages[status]) return messages[status];
  if (error instanceof TypeError) return "No pudimos conectar con el servicio. Inténtalo de nuevo.";
  return fallback;
}

interface RequestOptions {
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetch(apiUrl + path, {
    method: options.method ?? "GET",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal: options.signal,
  });

  if (!response.ok) throw new ApiError(response.status);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  register: (body: Registration) => request<Session>("/auth/register", { method: "POST", body }),
  login: (body: Credentials) => request<Session>("/auth/login", { method: "POST", body }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  studio: (signal?: AbortSignal) => request<StudioOverview>("/studio/overview", { signal }),
  studioOrders: (signal?: AbortSignal) => request<Order[]>("/studio/orders", { signal }),
  appearance: (signal?: AbortSignal) => request<AppearanceState>("/studio/appearance", { signal }),
  saveAppearance: (scope: ThemeScope, draft: AppearanceTheme, revision: number) =>
    request<ThemeState>(`/studio/appearance/${scope}`, { method: "PATCH", body: { draft, revision } }),
  publishAppearance: (scope: ThemeScope, revision: number) =>
    request<ThemeState>(`/studio/appearance/${scope}/publish`, { method: "POST", body: { revision } }),
  importMedia: (url: string) => request<{ id: string }>("/studio/media", { method: "POST", body: { url } }),
  createProduct: (body: ProductInput) => request<Product>("/studio/products", { method: "POST", body }),
  updateProduct: (id: string, body: Partial<ProductInput>) =>
    request<Product>(`/studio/products/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteProduct: (id: string) =>
    request<void>(`/studio/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
  publish: () => request<Tenant>("/studio/publish", { method: "POST" }),
  fulfill: (id: string) =>
    request<Order>(`/studio/orders/${encodeURIComponent(id)}/fulfillment`, {
      method: "PATCH",
      body: { status: "fulfilled" },
    }),
  store: (slug: string, signal?: AbortSignal) => request<Store>(`/store/${encodeURIComponent(slug)}`, { signal }),
  checkout: (slug: string, body: CheckoutInput) =>
    request<Order>(`/store/${encodeURIComponent(slug)}/checkout`, { method: "POST", body }),
  platform: (token: string) => request<PlatformOverview>("/platform/overview", { token }),
  setTenantStatus: (token: string, slug: string, status: "active" | "suspended", reason?: string) =>
    request<PlatformTenant>(`/platform/tenants/${encodeURIComponent(slug)}/status`, {
      method: "PATCH",
      token,
      body: { status, ...(reason ? { reason } : {}) },
    }),
};
