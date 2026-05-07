import { forwardRef } from "react";
import { cn } from "../../lib/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      {...rest}
      className={cn(
        "w-full px-3 py-2.5 border border-[#e5e5ea] rounded-xl text-base outline-none transition-colors bg-white",
        "focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20",
        "disabled:bg-[#f2f2f7] disabled:text-[#8e8e93]",
        className
      )}
    />
  );
});

export default Input;

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#3c3c43]/80 uppercase tracking-wide">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-[#FF3B30]">{error}</span>
      ) : hint ? (
        <span className="text-xs text-[#8e8e93]">{hint}</span>
      ) : null}
    </label>
  );
}
