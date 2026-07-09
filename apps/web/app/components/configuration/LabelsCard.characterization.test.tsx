// Characterization tests — pin the CURRENT LabelsCard editing behavior so the
// Stage 0 <LabelEditor> extraction can be proven behavior-preserving. These
// assert observable DOM behavior (rows, add/remove, fork-to-Custom, color
// picker) that must be identical before and after the refactor.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import LabelsCard from "./LabelsCard";

const INITIAL = {
  preset: "General" as const,
  enabled: true,
  customName: null,
  customLabels: null,
  provisioned: 3,
  uncategorizedEnabled: false,
};

function nameInputs(): HTMLInputElement[] {
  return screen
    .getAllByPlaceholderText("follow-up")
    .filter((el): el is HTMLInputElement => el instanceof HTMLInputElement);
}

beforeEach(() => {
  // LabelsCard fetches /api/labels/status on mount + fires persist calls.
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ count: 3, total: 3 }),
  })) as unknown as typeof fetch;
});

describe("LabelsCard editor (characterization)", () => {
  it("renders the built-in General preset's labels as editable rows", () => {
    render(<LabelsCard initial={INITIAL} />);
    const values = nameInputs().map((i) => i.value);
    expect(values).toEqual([
      "Clients",
      "Sales",
      "Vendors",
      "Billing",
      "Product",
      "Team-Internal",
      "External",
      "Follow-Up",
      "High-Priority",
    ]);
  });

  it("'+ Add label' appends a blank row", () => {
    render(<LabelsCard initial={INITIAL} />);
    const before = nameInputs().length;
    fireEvent.click(screen.getByText("+ Add label"));
    expect(nameInputs()).toHaveLength(before + 1);
    expect(nameInputs().at(-1)!.value).toBe("");
  });

  it("editing a built-in label name forks the preset to Custom", () => {
    render(<LabelsCard initial={INITIAL} />);
    // Custom-only affordance (Gmail folder prefix) is absent for a built-in.
    expect(screen.queryByPlaceholderText("e.g. Kuba Ventures")).toBeNull();
    fireEvent.change(nameInputs()[0], { target: { value: "Respond-Now" } });
    // Forking to Custom reveals the folder-prefix input.
    expect(screen.getByPlaceholderText("e.g. Kuba Ventures")).toBeInTheDocument();
  });

  it("removes a row, and disables remove when only one row remains", () => {
    render(<LabelsCard initial={INITIAL} />);
    const removeButtons = () => screen.getAllByLabelText("Remove label");
    // Remove down to a single row, whatever the preset length.
    let guard = 0;
    while (nameInputs().length > 1 && guard++ < 50) {
      fireEvent.click(removeButtons()[0]);
    }
    expect(nameInputs()).toHaveLength(1);
    // The last remaining row's remove control is disabled.
    expect(removeButtons()[0]).toBeDisabled();
  });

  it("opens the color palette and applies a picked color to the row's dot", () => {
    render(<LabelsCard initial={INITIAL} />);
    const firstRow = nameInputs()[0].closest("div")!;
    const dot = within(firstRow).getByLabelText("Pick color");
    fireEvent.click(dot);
    // Palette exposes Gmail's fixed swatches; pick a known valid hex.
    const swatch = screen.getByLabelText("#16a766");
    fireEvent.click(swatch);
    expect((dot as HTMLElement).style.backgroundColor).not.toBe("");
  });
});
