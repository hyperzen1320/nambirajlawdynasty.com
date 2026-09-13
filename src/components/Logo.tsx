import Image from "next/image";
import { LOGO_SRC, LOGO_ASPECT, BRAND_NAME } from "@/lib/brand";
import { imageProps } from "@/cms/image";

// The brand mark. Sized by HEIGHT (the logo is portrait); width follows the
// intrinsic aspect ratio as a sizing hint, and the rendered width is left to
// the image itself so a replacement logo of another shape still fits. One
// component so every surface — marketing header, footer, mobile menu — draws
// the exact same mark.
export default function Logo({
  src,
  size = 36,
  className,
  priority,
  alt = BRAND_NAME,
}: {
  /** From Site settings; falls back to the built-in mark. */
  src?: string;
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  const width = Math.max(1, Math.round(size * LOGO_ASPECT));
  return (
    <Image
      {...imageProps(src || LOGO_SRC)}
      alt={alt}
      width={width}
      height={size}
      priority={priority}
      className={className}
      style={{ width: "auto", height: size, objectFit: "contain" }}
    />
  );
}
