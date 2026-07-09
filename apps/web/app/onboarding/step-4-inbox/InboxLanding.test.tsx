import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InboxLanding from "./InboxLanding";

const GMAIL = "https://mail.google.com/mail/?authuser=fin%40x.com#inbox";
const MARKET = "https://workspace.google.com/marketplace/app/dharma/63757021962";

// Fake pre-opened tab handle so we can assert it's aimed at Gmail / closed.
function fakeTab() {
  return { setUrl: vi.fn(), close: vi.fn() };
}

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
});

describe("InboxLanding", () => {
  it("opens a tab on click, stamps completion, then aims the tab at Gmail (only after 200)", async () => {
    const tab = fakeTab();
    render(<InboxLanding gmailUrl={GMAIL} marketplaceUrl={MARKET} openTab={() => tab} />);

    fireEvent.click(screen.getByRole("button", { name: /open my labeled inbox/i }));
    await waitFor(() => expect(tab.setUrl).toHaveBeenCalledWith(GMAIL));
    expect(tab.close).not.toHaveBeenCalled();

    const advance = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "/api/onboarding/advance",
    );
    expect(JSON.parse((advance![1] as RequestInit).body as string)).toEqual({ complete: true });
    // Dharma tab stays and confirms — it is NOT navigated away.
    expect(screen.getByText(/opened your inbox in a new tab/i)).toBeInTheDocument();
  });

  it("closes the tab and does NOT aim it at Gmail when completion fails", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    const tab = fakeTab();
    render(<InboxLanding gmailUrl={GMAIL} marketplaceUrl={MARKET} openTab={() => tab} />);

    fireEvent.click(screen.getByRole("button", { name: /open my labeled inbox/i }));
    await screen.findByText(/couldn't finish setup/i);
    expect(tab.setUrl).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalled();
  });

  it("offers the add-on install as a non-blocking external link", () => {
    render(<InboxLanding gmailUrl={GMAIL} marketplaceUrl={MARKET} openTab={() => fakeTab()} />);
    const link = screen.getByRole("link", { name: /install the gmail add-on/i });
    expect(link).toHaveAttribute("href", MARKET);
    expect(link).toHaveAttribute("target", "_blank");
  });
});
