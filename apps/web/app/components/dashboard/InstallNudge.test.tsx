import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InstallNudge from "./InstallNudge";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const HEADING = /draft replies right inside gmail/i;

beforeEach(() => {
  localStorage.clear();
});

describe("InstallNudge", () => {
  it("renders nothing once the add-on is confirmed installed", () => {
    render(<InstallNudge installed={true} />);
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it("shows the nudge when not installed and not dismissed", () => {
    render(<InstallNudge installed={false} />);
    expect(screen.getByText(HEADING)).toBeInTheDocument();
  });

  it("stays hidden when previously dismissed on this browser", () => {
    localStorage.setItem("dharma.installNudgeDismissed", "1");
    render(<InstallNudge installed={false} />);
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it("dismiss hides it and persists the dismissal", () => {
    render(<InstallNudge installed={false} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(localStorage.getItem("dharma.installNudgeDismissed")).toBe("1");
  });

  it("ignores a stale dismissal once the add-on is installed (server truth wins)", () => {
    localStorage.setItem("dharma.installNudgeDismissed", "1");
    render(<InstallNudge installed={true} />);
    expect(screen.queryByText(HEADING)).toBeNull();
  });
});
