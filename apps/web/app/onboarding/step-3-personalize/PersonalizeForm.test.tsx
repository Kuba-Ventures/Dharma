import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PersonalizeForm from "./PersonalizeForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ROWS = [
  { shortName: "Contracts", colorKey: "#fb4c2f" },
  { shortName: "Client", colorKey: "#16a766" },
];

function okFetch() {
  return vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
}
function calls() {
  return (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
}
function bodyOf(url: string) {
  const c = calls().find((x) => x[0] === url);
  return c ? JSON.parse((c[1] as RequestInit).body as string) : undefined;
}

beforeEach(() => {
  push.mockClear();
  global.fetch = okFetch();
});

describe("PersonalizeForm", () => {
  it("renders the seeded label rows and the tone summary", () => {
    render(
      <PersonalizeForm
        initialTone={{ summary: "Warm and concise.", example: null }}
        presetKey="Legal"
        customName={null}
        initialRows={ROWS}
      />,
    );
    expect(screen.getByText("Warm and concise.")).toBeInTheDocument();
    const names = screen
      .getAllByPlaceholderText("follow-up")
      .map((i) => (i as HTMLInputElement).value);
    expect(names).toEqual(["Contracts", "Client"]);
  });

  it("unedited Continue provisions the built-in preset, back-scans, advances, navigates", async () => {
    render(
      <PersonalizeForm
        initialTone={{ summary: "x", example: null }}
        presetKey="Legal"
        customName={null}
        initialRows={ROWS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sort my inbox/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding/step-4-inbox"));

    expect(bodyOf("/api/labels/provision")).toEqual({ preset: "Legal" });
    expect(calls().some((c) => c[0] === "/api/labels/back-scan")).toBe(true);
    expect(bodyOf("/api/onboarding/advance")).toEqual({ step: 3 });
  });

  it("editing a label name provisions a Custom preset with the edited rows", async () => {
    render(
      <PersonalizeForm
        initialTone={{ summary: "x", example: null }}
        presetKey="Legal"
        customName={null}
        initialRows={ROWS}
      />,
    );
    fireEvent.change(screen.getAllByPlaceholderText("follow-up")[0], {
      target: { value: "Agreements" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sort my inbox/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());

    const prov = bodyOf("/api/labels/provision");
    expect(prov.preset).toBe("Custom");
    expect(prov.customLabels[0]).toMatchObject({ shortName: "Agreements" });
  });

  it("does not back-scan or navigate when provisioning fails", async () => {
    global.fetch = vi.fn(async (url: string) =>
      url === "/api/labels/provision"
        ? { ok: false, json: async () => ({ error: "gmail down" }) }
        : { ok: true, json: async () => ({}) },
    ) as unknown as typeof fetch;

    render(
      <PersonalizeForm
        initialTone={{ summary: "x", example: null }}
        presetKey="Legal"
        customName={null}
        initialRows={ROWS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sort my inbox/i }));

    await screen.findByText("gmail down");
    expect(calls().some((c) => c[0] === "/api/labels/back-scan")).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
