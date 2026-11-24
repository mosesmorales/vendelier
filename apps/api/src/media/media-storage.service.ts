import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { importRemoteImage, readImageBytes } from "./remote-image.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const mediaIdentifier = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly localRoot = resolve(repoRoot, process.env.MEDIA_ROOT || ".vendelier-local/media");
  private readonly objectStorage = configureObjectStorage();

  async importImage(tenantId: string, id: string, source: string): Promise<number> {
    const key = objectKey(tenantId, id);
    const image = await importRemoteImage(source);
    try {
      if (this.objectStorage) {
        await this.objectStorage.client.send(new PutObjectCommand({
          Bucket: this.objectStorage.bucket,
          Key: key,
          Body: image,
          ContentLength: image.length,
          ContentType: "image/webp",
        }), { abortSignal: AbortSignal.timeout(12_000) });
      } else {
        await saveLocalFile(resolve(this.localRoot, key), image);
      }
    } catch (error) {
      this.logFailure("guardar", error);
      throw new ServiceUnavailableException("No se pudo guardar la imagen.");
    }
    return image.length;
  }

  async readImage(tenantId: string, id: string): Promise<Buffer> {
    const key = objectKey(tenantId, id);
    try {
      if (this.objectStorage) {
        const { Body } = await this.objectStorage.client.send(new GetObjectCommand({
          Bucket: this.objectStorage.bucket,
          Key: key,
        }), { abortSignal: AbortSignal.timeout(12_000) });
        if (!(Body instanceof Readable)) throw new Error("El bucket no devolvió un flujo de datos.");
        return await readImageBytes(Body);
      }
      return await readImageBytes(createReadStream(resolve(this.localRoot, key)));
    } catch (error) {
      if (isMissingFile(error)) throw new NotFoundException("La imagen no está disponible.");
      this.logFailure("leer", error);
      throw new ServiceUnavailableException("No se pudo leer la imagen.");
    }
  }

  async removeImage(tenantId: string, id: string): Promise<void> {
    const key = objectKey(tenantId, id);
    if (this.objectStorage) {
      await this.objectStorage.client.send(new DeleteObjectCommand({
        Bucket: this.objectStorage.bucket,
        Key: key,
      }), { abortSignal: AbortSignal.timeout(12_000) });
    } else {
      await rm(resolve(this.localRoot, key), { force: true });
    }
  }

  private logFailure(operation: string, error: unknown) {
    const type = error instanceof Error ? error.name : "Error";
    this.logger.warn(`Error al ${operation} un objeto de medios (${type}).`);
  }
}

function configureObjectStorage() {
  const storage = process.env.MEDIA_STORAGE || "local";
  if (storage === "local") return undefined;
  if (storage !== "s3") throw new Error("MEDIA_STORAGE debe ser local o s3.");

  const bucket = process.env.MEDIA_S3_BUCKET;
  if (!bucket) throw new Error("MEDIA_S3_BUCKET es obligatorio con MEDIA_STORAGE=s3.");
  const endpoint = process.env.MEDIA_S3_ENDPOINT || undefined;
  const client = new S3Client({
    region: process.env.MEDIA_S3_REGION || "us-east-1",
    endpoint,
    forcePathStyle: Boolean(endpoint),
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { bucket, client };
}

function objectKey(tenantId: string, id: string): string {
  if (!mediaIdentifier.test(tenantId) || !mediaIdentifier.test(id)) {
    throw new NotFoundException("La imagen no está disponible.");
  }
  return `${tenantId.toLowerCase()}/${id.toLowerCase()}.webp`;
}

async function saveLocalFile(file: string, data: Buffer) {
  await mkdir(dirname(file), { recursive: true });
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, data, { flag: "wx" });
    await rename(temporaryFile, file);
  } catch (error) {
    await rm(temporaryFile, { force: true }).catch(() => undefined);
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  if (error instanceof S3ServiceException) return error.$metadata.httpStatusCode === 404;
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
