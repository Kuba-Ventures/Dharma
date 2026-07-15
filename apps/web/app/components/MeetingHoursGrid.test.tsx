import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MeetingHoursGrid, { type MeetingHour } from "./MeetingHoursGrid";

const MON_FRI_9_5: MeetingHour[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  hourStart: 9,
  hourEnd: 17,
}));

describe("MeetingHoursGrid", () => {
  it("does not call onChange on mount", () => {
    const onChange = vi.fn();
    render(<MeetingHoursGrid initialHours={MON_FRI_9_5} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  // Regression test for a production incident: the parent (SchedulingCard)
  // passes a brand-new `onChange` closure on every render since it isn't
  // memoized. An earlier version of this component watched `onChange`
  // identity in a useEffect dependency array, which turned every unrelated
  // parent re-render into a save — and, because saving updated parent state,
  // an infinite render/save loop that hammered the API (74k+ requests in one
  // incident). Re-passing a new onChange reference with unchanged props must
  // never trigger a call on its own.
  it("does not call onChange merely because the onChange prop identity changes", () => {
    const onChangeA = vi.fn();
    const onChangeB = vi.fn();
    const { rerender } = render(
      <MeetingHoursGrid initialHours={MON_FRI_9_5} onChange={onChangeA} />,
    );

    rerender(<MeetingHoursGrid initialHours={MON_FRI_9_5} onChange={onChangeB} />);

    expect(onChangeA).not.toHaveBeenCalled();
    expect(onChangeB).not.toHaveBeenCalled();
  });

  it("calls onChange with the updated hours when a day is toggled", () => {
    const onChange = vi.fn();
    render(<MeetingHoursGrid initialHours={MON_FRI_9_5} onChange={onChange} />);

    // Wednesday (dayOfWeek 3) starts active per MON_FRI_9_5; toggling turns it off.
    fireEvent.click(screen.getByLabelText("Toggle W"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [hours] = onChange.mock.calls[0] as [MeetingHour[]];
    expect(hours.some((h) => h.dayOfWeek === 3)).toBe(false);
  });
});
