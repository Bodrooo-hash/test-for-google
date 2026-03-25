import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useOnlinePresence } from "@/contexts/OnlinePresenceContext";
import { cn } from "@/lib/utils";

interface OnlineAvatarProps {
  userId?: string;
  src?: string | null;
  fallback?: string;
  className?: string;
  dotClassName?: string;
  children?: React.ReactNode;
}

const OnlineAvatar = ({
  userId,
  src,
  fallback = "?",
  className,
  dotClassName,
  children,
}: OnlineAvatarProps) => {
  const { isOnline } = useOnlinePresence();
  const online = userId ? isOnline(userId) : false;

  return (
    <div className="relative inline-block">
      <Avatar className={className}>
        {src && <AvatarImage src={src} alt={fallback} />}
        <AvatarFallback className="text-lg font-medium bg-primary/10 text-primary">
          {fallback}
        </AvatarFallback>
        {children}
      </Avatar>
      {online && (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card",
            dotClassName
          )}
        />
      )}
    </div>
  );
};

export default OnlineAvatar;
