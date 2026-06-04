import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TermsPage from "./page";

describe("TermsPage", () => {
  it("renders the terms of service heading", () => {
    render(<TermsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /terms of service/i }),
    ).toBeInTheDocument();
  });

  it("states the acceptance terms", () => {
    render(<TermsPage />);
    expect(screen.getByText(/agree to\s+these terms of service/i)).toBeInTheDocument();
  });
});
