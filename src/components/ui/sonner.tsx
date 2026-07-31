import { Toaster as Sonner } from "sonner";
import { useFinance } from "@/lib/finance-store";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useFinance();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-border/70 group-[.toaster]:bg-surface group-[.toaster]:text-foreground group-[.toaster]:shadow-float dark:group-[.toaster]:border-border/60 dark:group-[.toaster]:bg-popover",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:shadow-none",
          cancelButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-muted-foreground group-[.toast]:shadow-none",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
