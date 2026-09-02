import Image from "next/image";
import { LOGO_SRC, LOGO_ASPECT, BRAND_NAME } from "@/lib/brand";

// The brand mark. Sized by HEIGHT (the logo is portrait); width follows the
// intrinsic aspect ratio. One component so every surface — marketing header,
// footer, login, app + admin sidebars — draws the exact same mark.
export default function Logo({
  size = 36,
  className,
  priority,
  alt = BRAND_NAME,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  const width = Math.max(1, Math.round(size * LOGO_ASPECT));
  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={width}
      height={size}
      priority={priority}
      className={className}
      style={{ width: "auto", height: size, objectFit: "contain" }}
    />
  );
}
