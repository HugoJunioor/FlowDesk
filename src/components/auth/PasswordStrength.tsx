import { getPasswordStrength } from "@/lib/authStorage";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

const PasswordStrength = ({ password, className = "" }: PasswordStrengthProps) => {
  const { level, label } = getPasswordStrength(password);
  if (!password) return null;

  const colors = ["", "bg-destructive", "bg-warning", "bg-success"];
  const textColors = ["", "text-destructive", "text-warning", "text-success"];
  const hints = [
    "",
    "Use maiúsculas, minúsculas, números e símbolos",
    "Adicione mais tipos de caracteres para fortalecer",
    "Senha forte!",
  ];

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= level ? colors[level] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${textColors[level]}`}>
        Senha {label}
        {level < 3 && (
          <span className="font-normal text-muted-foreground ml-1">— {hints[level]}</span>
        )}
      </p>
    </div>
  );
};

export default PasswordStrength;
