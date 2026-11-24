import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from "@nestjs/common";
import { Resolver } from "node:dns/promises";
import { request } from "node:https";
import type { IncomingMessage } from "node:http";
import { BlockList, isIP } from "node:net";
import type { Readable } from "node:stream";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const acceptedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/octet-stream"]);
const redirectCodes = new Set([301, 302, 303, 307, 308]);

const nonPublicNetworks: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 3],
];
const addressBlockList = new BlockList();
for (const [address, prefix] of nonPublicNetworks) addressBlockList.addSubnet(address, prefix);

export async function importRemoteImage(source: string): Promise<Buffer> {
  const bytes = await download(source);
  if (!hasSupportedSignature(bytes)) {
    throw new UnsupportedMediaTypeException("Usa una imagen PNG, JPEG o WebP.");
  }

  let normalized: Buffer;
  try {
    normalized = await sharp(bytes, { limitInputPixels: 12_000_000 })
      .autoOrient()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
  } catch {
    throw new UnsupportedMediaTypeException("La imagen está dañada o excede las dimensiones admitidas.");
  }
  if (normalized.length > MAX_IMAGE_BYTES) throw imageTooLarge();
  return normalized;
}

async function download(source: string): Promise<Buffer> {
  let target = parsePublicHttpsUrl(source);
  const signal = AbortSignal.timeout(12_000);

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const address = await resolvePublicAddress(target.hostname, signal);
    const response = await openImage(target, address, signal);
    try {
      if (response.statusCode && redirectCodes.has(response.statusCode)) {
        if (!response.headers.location || redirects === 3) {
          throw new BadRequestException("La URL tiene demasiadas redirecciones o no es válida.");
        }
        target = parsePublicHttpsUrl(response.headers.location, target);
        continue;
      }

      if (response.statusCode !== 200) {
        throw new BadRequestException("El servidor de imágenes no devolvió una imagen disponible.");
      }
      const type = response.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
      if (type && !acceptedTypes.has(type)) {
        throw new UnsupportedMediaTypeException("La URL debe apuntar directamente a una imagen PNG, JPEG o WebP.");
      }
      if (Number(response.headers["content-length"]) > MAX_IMAGE_BYTES) throw imageTooLarge();
      return await readImageBytes(response);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof PayloadTooLargeException || error instanceof UnsupportedMediaTypeException) {
        throw error;
      }
      throw new BadRequestException("La descarga de la imagen se interrumpió.");
    } finally {
      response.destroy();
    }
  }

  throw new BadRequestException("La URL tiene demasiadas redirecciones.");
}

function parsePublicHttpsUrl(input: string, base?: URL): URL {
  let target: URL;
  try {
    target = new URL(input, base);
  } catch {
    throw new BadRequestException("Ingresa una URL de imagen válida.");
  }

  if (target.protocol !== "https:" || target.port || target.username || target.password ||
      !target.hostname.includes(".") || isIP(target.hostname)) {
    throw new BadRequestException("Usa una URL HTTPS pública de un servidor de imágenes.");
  }
  return target;
}

async function resolvePublicAddress(hostname: string, signal: AbortSignal): Promise<string> {
  const resolver = new Resolver({ timeout: 2_000, tries: 1 });
  const cancel = () => resolver.cancel();
  let addresses: string[];
  try {
    signal.throwIfAborted();
    signal.addEventListener("abort", cancel, { once: true });
    addresses = await resolver.resolve4(hostname);
  } catch {
    throw new BadRequestException("No se pudo resolver el servidor de imágenes.");
  } finally {
    signal.removeEventListener("abort", cancel);
  }
  if (!addresses.length || addresses.some((address) => addressBlockList.check(address))) {
    throw new BadRequestException("Usa un servidor de imágenes público.");
  }
  return addresses[0];
}

function openImage(target: URL, address: string, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const connection = request(target, {
      agent: false,
      family: 4,
      signal,
      // Connect to the vetted address while keeping certificate verification for the URL hostname.
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
      headers: {
        Accept: "image/png, image/jpeg, image/webp",
        "Accept-Encoding": "identity",
        "User-Agent": "Vendelier media importer",
      },
    }, resolve);
    connection.once("error", () => reject(new BadRequestException("No se pudo descargar la imagen.")));
    connection.end();
  });
}

export async function readImageBytes(input: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of input) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_IMAGE_BYTES) throw imageTooLarge();
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size);
}

function hasSupportedSignature(bytes: Buffer): boolean {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff]);
  return bytes.subarray(0, png.length).equals(png) || bytes.subarray(0, jpeg.length).equals(jpeg) ||
    (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
}

function imageTooLarge() {
  return new PayloadTooLargeException("El tamaño máximo por imagen es de 5 MB.");
}
