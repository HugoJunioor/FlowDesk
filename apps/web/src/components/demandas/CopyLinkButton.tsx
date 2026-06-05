import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface CopyLinkButtonProps {
  url: string;
  size?: number;
  className?: string;
}

const CopyLinkButton = ({ url, size = 14, className = "" }: CopyLinkButtonProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) {
      toast({ title: t("copy_link.unavailable"), variant: "destructive" });
      return;
    }
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      toast({ title: t("copy_link.copied"), description: t("copy_link.copied_hint") });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: t("copy_link.failed_title"),
        description: t("copy_link.failed_desc"),
        variant: "destructive",
      });
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`text-muted-foreground hover:text-primary transition-colors cursor-pointer ${className}`}
      title={copied ? t("copy_link.copied") : t("copy_link.copy_tooltip")}
    >
      {copied ? <Check size={size} className="text-success" /> : <Copy size={size} />}
    </button>
  );
};

export default CopyLinkButton;
