import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InboxLanding from "./InboxLanding";

const GMAIL = "https://mail.google.com/mail/?authuser=fin%40x.com#inbox";
const MARKET = "https://workspace.google.com/marketplace/app/dharma/63757021962";

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
});

describe("InboxLanding", () => {
  it("stamps completion then navigates to Gmail (only after a 200)", async () => {
    const navigate = vi.fn();
    render(<InboxLanding gmailUrl={GMAIL} marketplaceUrl={MARKET} navigate={navigate} />);

    fireEvent.click(screen.getByRole("button", { name: /open my labeled inbox/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(GMAIL));

    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const advance = calls.find((c) => c[0] === "/api/onboarding/advance");
    expect(advance).toBeTruthy();
    expect(JSON.parse((advance![1] as RequestInit).body as string)).toEqual({ complete: true });
  });

  it("does NOT navigate when completion fails (no stranding)", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    const navigate = vi.fn();
    render(<InboxLanding gmailUrl={GMAIL} marketplaceUrl={MARKET} navigate={navigate} />);

    fireEvent.click(screen.getByRole("button", { name: /open my labeled inbox/i }));
    await screen.findByText(/couldn't finish setup/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers the add-on install as a non-blocking external link", () => {
    render(<InboxLanding gmailUrl={GMAIL} marketplaceUrl={MARKET} navigate={vi.fn()} />);
    const link = screen.getByRole("link", { name: /install the gmail add-on/i });
    expect(link).toHaveAttribute("href", MARKET);
    expect(link).toHaveAttribute("target", "_blank");
  });
});
