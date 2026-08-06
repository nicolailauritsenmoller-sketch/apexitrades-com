import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password field with a show/hide toggle, used across sign in, sign up and reset flows. */
export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(
          "w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-ring",
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
