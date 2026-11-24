import Image from "next/image";

interface MediaImageProps {
  src: string;
  alt: string;
  className: string;
  sizes: string;
  fit?: "contain" | "cover";
}

export function MediaImage({ src, alt, className, sizes, fit = "cover" }: MediaImageProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`}>
      <Image className={fit === "contain" ? "object-contain" : "object-cover"} unoptimized fill src={src} alt={alt} sizes={sizes} />
    </div>
  );
}
