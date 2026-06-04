import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("renders the privacy policy heading", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /privacy policy/i }),
    ).toBeInTheDocument();
  });

  it("links back to the home page via the Dharma logo", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("img", { name: /dharma/i })).toBeInTheDocument();
  });
});
