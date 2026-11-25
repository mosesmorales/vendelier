interface TenantRecord {
  slug: string;
  name: string;
  publishedAt: Date | null;
}

interface ProductOptionRecord {
  id: string;
  name: string;
  position: number;
  values: { id: string; value: string; position: number }[];
}

interface ProductVariantRecord {
  id: string;
  title: string;
  sku: string;
  priceCents: number;
  stock: number;
  selectedOptions: unknown;
}

interface ProductRecord {
  id: string;
  name: string;
  description: string;
  sku: string;
  priceCents: number;
  stock: number;
  imageId: string | null;
  options?: ProductOptionRecord[];
  variants?: ProductVariantRecord[];
}

interface OrderItemRecord {
  name: string;
  variantTitle?: string | null;
  sku: string;
  quantity: number;
  priceCents: number;
}

interface OrderRecord {
  id: string;
  number: string;
  totalCents: number;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  createdAt: Date;
  status: "PENDING" | "FULFILLED";
  items: OrderItemRecord[];
}

export const productInclude = {
  options: {
    orderBy: { position: "asc" as const },
    include: { values: { orderBy: { position: "asc" as const } } },
  },
  variants: {
    orderBy: [{ title: "asc" as const }, { id: "asc" as const }],
  },
};

export function tenantView({ slug, name, publishedAt }: TenantRecord) {
  return { slug, name, published: publishedAt !== null };
}

export function productView({
  id,
  name,
  description,
  sku,
  priceCents,
  stock,
  imageId,
  options = [],
  variants = [],
}: ProductRecord) {
  return {
    id,
    name,
    description,
    sku,
    priceCents,
    stock,
    imageId,
    options: options.map((opt) => ({
      id: opt.id,
      name: opt.name,
      values: opt.values.map((v) => v.value),
    })),
    variants: variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      priceCents: variant.priceCents,
      stock: variant.stock,
      selectedOptions:
        typeof variant.selectedOptions === "object" && variant.selectedOptions !== null
          ? (variant.selectedOptions as Record<string, string>)
          : {},
    })),
  };
}

export function orderView({
  id,
  number,
  totalCents,
  customerName,
  customerEmail,
  customerAddress,
  createdAt,
  status,
  items,
}: OrderRecord) {
  return {
    id,
    number,
    totalCents,
    customerName,
    ...(customerEmail ? { customerEmail } : {}),
    ...(customerAddress ? { customerAddress } : {}),
    createdAt,
    status: status === "PENDING" ? ("pending" as const) : ("fulfilled" as const),
    items: items.map(({ name, variantTitle, sku, quantity, priceCents }) => ({
      name,
      ...(variantTitle ? { variantTitle } : {}),
      sku,
      quantity,
      priceCents,
    })),
  };
}
