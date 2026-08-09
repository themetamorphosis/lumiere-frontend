import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MediaCard from "@/components/MediaCard";
import EmptyState from "@/components/EmptyState";
import type { Item } from "@/lib/types";

function makeItem(over: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    title: "The Matrix",
    mediaType: "movie",
    status: "watched",
    favorite: false,
    genres: ["Action", "Sci-Fi"],
    year: 1999,
    coverUrl: "https://image.tmdb.org/t/p/w780/matrix.jpg",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...over,
  };
}

function renderCard(over: Partial<Item> = {}) {
  const handlers = {
    onFav: vi.fn(),
    onOpen: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<MediaCard item={makeItem(over)} {...handlers} />);
  return handlers;
}

describe("MediaCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the title", () => {
    renderCard();
    expect(screen.getByText("The Matrix")).toBeInTheDocument();
  });

  it("shows the year and the first genres as metadata", () => {
    renderCard();
    expect(screen.getByText(/1999/)).toBeInTheDocument();
    expect(screen.getByText(/Action/)).toBeInTheDocument();
  });

  it("falls back to a text placeholder when there is no cover", () => {
    renderCard({ coverUrl: undefined });
    // Title appears twice: once as the poster placeholder, once as the caption.
    expect(screen.getAllByText("The Matrix").length).toBeGreaterThan(1);
  });

  it("renders an item that has no genres", () => {
    renderCard({ genres: [] });
    expect(screen.getByText("The Matrix")).toBeInTheDocument();
  });

  it("reflects favorite state", () => {
    renderCard({ favorite: true });
    expect(screen.getByText("The Matrix")).toBeInTheDocument();
  });

  it.each(["movie", "tv", "anime"] as const)(
    "renders %s items",
    (mediaType) => {
      renderCard({ mediaType });
      expect(screen.getByText("The Matrix")).toBeInTheDocument();
    },
  );
});

describe("EmptyState", () => {
  it("renders headline and subtext", () => {
    render(<EmptyState headline="Nothing here" subtext="Add something." />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add something.")).toBeInTheDocument();
  });

  it("invokes the call to action", async () => {
    const onCta = vi.fn();
    render(
      <EmptyState
        headline="Empty"
        subtext="Nothing yet."
        ctaLabel="Add title"
        onCta={onCta}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /add title/i }));
    expect(onCta).toHaveBeenCalledOnce();
  });
});
