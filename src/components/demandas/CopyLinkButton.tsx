import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyLinkButtonProps {
  url: string;
  size?: number;
  className?: string;
}

const CopyLinkButton = ({ url, size = 14, className = "" }: CopyLinkButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
