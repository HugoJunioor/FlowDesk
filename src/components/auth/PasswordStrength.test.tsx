import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PasswordStrength from "./PasswordStrength";

describe("<PasswordStrength />", () => {
  it("nao renderiza nada quando password vazio", () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra forca fraca pra senha simples", () => {
    render(<PasswordStrength password="abc" />);
    expect(screen.getByText(/senha/i)).toBeInTheDocument();
    expect(screen.getByText(/use mai/i)).toBeInTheDocument();
  });

  it("mostra senha forte sem hint quando password robusto", () => {
    render(<PasswordStrength password="MyStr0ng!Pass2024" />);
    expect(screen.getByText(/senha forte/i)).toBeInTheDocument();
    // Quando level === 3, nao deve ter hint
    expect(screen.queryByText(/use mai/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/adicione mais/i)).not.toBeInTheDocument();
  });

  it("renderiza 3 barras de progresso", () => {
    const { container } = render(<PasswordStrength password="test123" />);
    const bars = container.querySelectorAll(".h-1\\.5");
    expect(bars.length).toBeGreaterThanOrEqual(3);
  });

  it("aplica className custom", () => {
    const { container } = render(<PasswordStrength password="abc" className="my-custom-class" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("my-custom-class");
  });
});
