interface TenantRecord {
  slug: string;
  name: string;
  publishedAt: Date | null;
}

interface ProductRecord {
  id: string;
  name: string;
  description: string;
  sku: string;
  priceCents: number;
  stock: number;
  imageId: string | null;
}

interface OrderItemRecord {
  name: string;
  sku: string;
  quantity: number;
  priceCents: number;
}

interface OrderRecord {
  id: string;
  number: string;
  totalCents: number;
  customerName: string;
  createdAt: Date;
  status: "PENDING" | "FULFILLED";
  items: OrderItemRecord[];
}

export function tenantView({ slug, name, publishedAt }: TenantRecord) {
  return { slug, name, published: publishedAt !== null };
}

export function productView({ id, name, description, sku, priceCents, stock, imageId }: ProductRecord) {
  return { id, name, description, sku, priceCents, stock, imageId };
}

export function orderView({ id, number, totalCents, customerName, createdAt, status, items }: OrderRecord) {
  return {
    id,
    number,
    totalCents,
    customerName,
    createdAt,
    status: status === "PENDING" ? "pending" as const : "fulfilled" as const,
    items: items.map(({ name, sku, quantity, priceCents }) => ({ name, sku, quantity, priceCents })),
  };
}
