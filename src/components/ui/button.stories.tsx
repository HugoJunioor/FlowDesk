import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
    asChild: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Salvar" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Excluir" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Cancelar" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Voltar" },
};

export const Link: Story = {
  args: { variant: "link", children: "Saiba mais" },
};

export const Small: Story = {
  args: { size: "sm", children: "Compact" },
};

export const Large: Story = {
  args: { size: "lg", children: "Grande call to action" },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Indisponível" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
