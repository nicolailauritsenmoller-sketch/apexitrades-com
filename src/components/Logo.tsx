import markAsset from "@/assets/brand/precision-v-mark.png.asset.json";
import lightAsset from "@/assets/brand/precision-v-light.png.asset.json";
import darkAsset from "@/assets/brand/precision-v-dark.png.asset.json";

const shieldMark = markAsset.url;

/** Approved Precision V emblem for compact headers and support avatars. */
export function BrandMark({
  className = "size-9",
  alt = "Velocity Trade",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={shieldMark}
      alt={alt}
      width={333}
      height={271}
      className={`${className} shrink-0 object-contain`}
    />
  );
}

/** Original approved wordmark artwork, selected by the global theme class. */
export function BrandLockup({
  className = "w-44",
}: {
  className?: string;
}) {
  return (
    <span className={`relative block max-w-full shrink-0 ${className}`}>
      <img src={lightAsset.url} alt="Velocity Trade" width={1000} height={202} className="block h-auto w-full object-contain dark:hidden" />
      <img src={darkAsset.url} alt="Velocity Trade" width={1000} height={202} className="hidden h-auto w-full object-contain dark:block" />
    </span>
  );
}

export { shieldMark };
