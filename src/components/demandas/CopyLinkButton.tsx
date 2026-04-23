import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";

interface CopyLinkButtonProps {
  url: string;
  size?: number;
  className?: string;
}

const CopyLinkButton = ({ url, size = 14, className = "" }: CopyLinkButtonProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) {
      toast({ title: "Link indisponível", variant: "destructive" });
      return;
    }
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      toast({ title: "Link copiado!", description: "Cole onde precisar (Ctrl+V)." });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: "Não foi possível copiar",
        description: "Copie manualmente o texto do link.",
        variant: "destructive",
      });
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`text-muted-foreground hover:text-primary transition-colors cursor-pointer ${className}`}
      title={copied ? "Link copiado!" : "Copiar link"}
    >
      {copied ? <Check size={size} className="text-success" /> : <Copy size={size} />}
    </button>
  );
};

export default CopyLinkButton;
