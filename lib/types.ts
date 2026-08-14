export type MediaType = "movie" | "tv" | "anime";
export type Status = "watched" | "pending" | "wishlist";

export type Item = {
  id: string;
  title: string;
  mediaType: MediaType;
  status: Status;
  favorite: boolean;
  genres?: string[];
  notes?: string;
  description?: string;

  year?: number;
  endYear?: number;
  running?: boolean;

  coverUrl?: string;
  runtime?: number;   // total runtime in minutes (cached from TMDB)

  createdAt: number;
  updatedAt: number;
};

/** Another user as they appear to you. Never carries an email. */
export type PublicUser = {
  id: string;
  handle?: string;
  name?: string;
  image?: string;
};

export type Friend = {
  user: PublicUser;
  friendshipId: string;
  since?: string;
  unread: number;
};

export type FriendRequest = {
  id: string;
  user: PublicUser;
  createdAt?: string;
};

export type FriendsOverview = {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};

export type Relationship = "none" | "friends" | "incoming" | "outgoing" | "self";

export type UserSearchResult = PublicUser & { relationship: Relationship };

/** A title recommended inside a message — snapshotted at send time. */
export type MessageAttachment = {
  title: string;
  mediaType: MediaType;
  year?: number;
  coverUrl?: string;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body?: string;
  attachment?: MessageAttachment;
  readAt?: string;
  createdAt?: string;
};

export type Conversation = {
  user: PublicUser;
  lastMessage?: ChatMessage;
  unread: number;
};

/** A share link as its owner sees it. */
export type ShareLink = {
  id: string;
  slug: string;
  label?: string;
  /** Empty means "no filter on this dimension", not "nothing". */
  statuses: Status[];
  mediaTypes: MediaType[];
  favoritesOnly: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** A watchlist item as an anonymous visitor sees it — no `notes`, no `userId`. */
export type PublicItem = Omit<Item, "notes">;

export type PublicWatchlist = {
  slug: string;
  label?: string;
  owner: { name?: string; image?: string };
  filters: {
    statuses: Status[];
    mediaTypes: MediaType[];
    favoritesOnly: boolean;
  };
  items: PublicItem[];
  total: number;
};
