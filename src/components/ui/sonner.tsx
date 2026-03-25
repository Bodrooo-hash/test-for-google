import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      position="bottom-right"
      closeButton
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:ml-auto group-[.toaster]:bg-foreground/[0.03] group-[.toaster]:backdrop-blur-sm group-[.toaster]:text-blue1 group-[.toaster]:border-foreground/[0.06] group-[.toaster]:shadow-lg group-[.toaster]:!w-auto group-[.toaster]:!min-w-0 group-[.toaster]:text-left [&_[data-close-button]]:!static [&_[data-close-button]]:!ml-auto [&_[data-close-button]]:!transform-none [&_[data-close-button]]:!border-0 [&_[data-close-button]]:!bg-transparent [&_[data-close-button]]:!shadow-none [&_[data-close-button]]:!text-foreground/40 [&_[data-close-button]]:hover:!text-foreground/70 [&_[data-close-button]]:!right-auto [&_[data-close-button]]:!top-auto [&_[data-close-button]]:!w-5 [&_[data-close-button]]:!h-5 [&_[data-close-button]]:!rounded-none",
          description: "group-[.toast]:text-blue1/70",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
