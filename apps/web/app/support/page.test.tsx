import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SupportPage from "./page";

describe("SupportPage", () => {
  it("renders the support heading", () => {
    render(<SupportPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /support/i }),
    ).toBeInTheDocument();
  });

  it("shows a Getting Started section", () => {
    render(<SupportPage />);
    expect(screen.getByText(/getting started/i)).toBeInTheDocument();
  });
});
