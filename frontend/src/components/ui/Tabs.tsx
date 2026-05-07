import { cn } from "../../lib/cn";

export interface TabOption<T extends string> {
  label: string;
  value: T;
}

interface TabsProps<T extends string> {
  value: T;
  options: TabOption<T>[];
  onChange: (v: T) => void;
}

/**
 * Segmented control estilo iOS.
 * Render como un grupo de botones con fondo gris y un indicador deslizante con sombra.
 */
export default function Tabs<T extends string>({ value, options, onChange }: TabsProps<T>) {
  return (
    <div className="inline-flex rounded-lg bg-[#e9e9eb] p-1 w-full">
      {options.map((opt) => {
        const activo = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
              activo
                ? "bg-white text-[#1c1c1e] shadow-sm"
                : "text-[#3c3c43]/80 hover:text-[#1c1c1e]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
