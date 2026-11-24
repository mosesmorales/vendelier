import Image from "next/image";
import mark from "../../../resources/kit_logos/isotipo_oscuro.svg";
import logoLight from "../../../resources/kit_logos/logo_horizontal_claro.svg";
import logoDark from "../../../resources/kit_logos/logo_horizontal_oscuro.svg";

export function VendelierWordmark({ tone = "auto", width = 164 }: { tone?: "auto" | "dark"; width?: number } = {}) {
  if (tone === "dark") {
    return <Image src={logoDark} alt="Vendelier" width={width} className="h-auto" loading="eager" />;
  }
  return (
    <>
      <Image
        src={logoLight}
        alt="Vendelier"
        width={width}
        className="block h-auto dark:hidden"
      />
      <Image
        src={logoDark}
        alt="Vendelier"
        width={width}
        className="hidden h-auto dark:block"
      />
    </>
  );
}

export function VendelierMark() {
  return (
    <Image
      src={mark}
      alt=""
      width={224}
      className="h-auto w-[min(52%,14rem)]"
    />
  );
}
