import defaultAvatar from "@/assets/default-avatar.png";

/**
 * Fixed, non-editable default account avatar used everywhere a user is shown.
 * Avatars are intentionally not user-configurable.
 */
export function UserAvatar({
  className = "size-9",
  alt = "Account avatar",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={defaultAvatar}
      alt={alt}
      loading="lazy"
      width={816}
      height={816}
      className={`${className} shrink-0 rounded-full border border-border object-cover`}
    />
  );
}

export { defaultAvatar };
