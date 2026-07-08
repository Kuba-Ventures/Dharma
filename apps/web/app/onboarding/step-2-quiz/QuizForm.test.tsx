import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuizForm from "./QuizForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function fetchMock() {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  push.mockClear();
  global.fetch = fetchMock();
});

describe("QuizForm", () => {
  it("keeps Continue disabled until a role is chosen (the only hard gate)", () => {
    render(<QuizForm initialName="Fin" initialRole={null} initialCity={null} />);
    const cont = screen.getByRole("button", { name: /continue/i });
    expect(cont).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Venture Capital" }));
    expect(cont).toBeEnabled();
  });

  it("submits name + role + step to advance, then kicks tone/sync and navigates", async () => {
    render(<QuizForm initialName="Fin" initialRole={null} initialCity={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Legal / Attorney" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/onboarding/step-3-personalize"),
    );

    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const advance = calls.find((c) => c[0] === "/api/onboarding/advance");
    expect(advance).toBeTruthy();
    const body = JSON.parse((advance![1] as RequestInit).body as string);
    expect(body).toMatchObject({ step: 2, role: "legal", firstName: "Fin" });
    expect(body.city).toBeUndefined();

    expect(calls.some((c) => c[0] === "/api/preferences/tone/sync")).toBe(true);
  });

  it("includes a pre-selected city in the submit payload", async () => {
    render(
      <QuizForm
        initialName="Fin"
        initialRole="other"
        initialCity={{ query: "Austin, TX", name: "Austin", state: "TX" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());

    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const body = JSON.parse(
      (calls.find((c) => c[0] === "/api/onboarding/advance")![1] as RequestInit).body as string,
    );
    expect(body.city).toEqual({ name: "Austin", state: "TX" });
  });

  it("does not navigate when advance fails", async () => {
    global.fetch = vi.fn(async (url: string) =>
      url === "/api/onboarding/advance"
        ? { ok: false, json: async () => ({ error: "boom" }) }
        : { ok: true, json: async () => ({}) },
    ) as unknown as typeof fetch;

    render(<QuizForm initialName="Fin" initialRole="venture-capital" initialCity={null} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText("boom");
    expect(push).not.toHaveBeenCalled();
  });
});
