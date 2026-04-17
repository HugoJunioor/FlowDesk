import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface CopyLinkButtonProps {
  url: string;
  size?: number;
  className?: string;
}

const CopyLinkButton = ({ url, size = 14, className = "" }: CopyLinkButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-muted-foreground hover:text-primary transition-colors cursor-pointer ${className}`}
      title={copied ? "Link copiado!" : "Copiar link"}
    >
      {copied ? <Check size={size} className="text-success" /> : <Copy size={size} />}
    </button>
  );
};

export default CopyLinkButton;
