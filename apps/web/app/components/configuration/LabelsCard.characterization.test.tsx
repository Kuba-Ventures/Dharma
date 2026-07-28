// Characterization tests for LabelsCard's label editing, updated for the
// inbox-style <LabelTags> UI (labels render as solid tags; rename/recolor/
// remove happen in a per-tag popover). These assert observable behavior:
// tag list + order, add, fork-to-Custom on edit, remove/min-rows, color pick.
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

function tags(): HTMLElement[] {
  return screen.queryAllByTestId("label-tag");
}
function tagTexts(): string[] {
  return tags().map((t) => t.textContent?.trim() ?? "");
}

beforeEach(() => {
  // LabelsCard fetches /api/labels/status on mount + fires persist calls.
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ count: 3, total: 3 }),
  })) as unknown as typeof fetch;
});

describe("LabelsCard editor (characterization)", () => {
  it("renders the built-in General preset's labels as tags, in order", () => {
    render(<LabelsCard initial={INITIAL} />);
    expect(tagTexts()).toEqual([
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

  it("'+ Add label' appends a blank (Untitled) tag", () => {
    render(<LabelsCard initial={INITIAL} />);
    const before = tags().length;
    fireEvent.click(screen.getByText("+ Add label"));
    expect(tags()).toHaveLength(before + 1);
    expect(tagTexts().at(-1)).toBe("Untitled");
  });

  it("editing a label name in the popover forks the preset to Custom", () => {
    render(<LabelsCard initial={INITIAL} />);
    // Custom-only affordance (Gmail folder prefix) is absent for a built-in.
    expect(screen.queryByPlaceholderText("e.g. Kuba Ventures")).toBeNull();
    fireEvent.click(tags()[0]); // open the first tag's popover
    fireEvent.change(screen.getByPlaceholderText("Label name"), {
      target: { value: "Respond-Now" },
    });
    // Forking to Custom reveals the folder-prefix input.
    expect(screen.getByPlaceholderText("e.g. Kuba Ventures")).toBeInTheDocument();
  });

  it("removes a tag, and disables remove when only one remains", () => {
    render(<LabelsCard initial={INITIAL} />);
    let guard = 0;
    while (tags().length > 1 && guard++ < 50) {
      fireEvent.click(tags()[0]); // open popover
      fireEvent.click(screen.getByLabelText("Remove label"));
    }
    expect(tags()).toHaveLength(1);
    // The last remaining tag's Remove control is disabled.
    fireEvent.click(tags()[0]);
    expect(screen.getByLabelText("Remove label")).toBeDisabled();
  });

  it("opens the color palette from a tag and applies a picked color", () => {
    render(<LabelsCard initial={INITIAL} />);
    fireEvent.click(tags()[0]);
    const swatch = screen.getByLabelText("#16a766");
    fireEvent.click(swatch);
    // Picking a color on a built-in forks to Custom (persisted change).
    expect(screen.getByPlaceholderText("e.g. Kuba Ventures")).toBeInTheDocument();
  });
});
