import { z } from "zod";

// --- Media type / status enums ---
export const MediaTypeSchema = z.enum(["movie", "tv", "anime"]);
export const StatusSchema = z.enum(["watched", "pending", "wishlist"]);

// --- Watchlist item from backend ---
export const WatchlistItemSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    mediaType: MediaTypeSchema,
    tmdbId: z.number().int().positive().nullish(),
    status: StatusSchema,
    favorite: z.boolean().nullable().transform((value) => value ?? false),
    genres: z.array(z.string()).nullish(),
    notes: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    year: z.number().nullable().optional(),
    endYear: z.number().nullable().optional(),
    running: z.boolean().nullish(),
    coverUrl: z.string().nullable().optional(),
    runtime: z.number().nullable().optional(),
    createdAt: z.string().or(z.number()).nullable().optional(),
    updatedAt: z.string().or(z.number()).nullable().optional(),
});

export const WatchlistItemsSchema = z.array(WatchlistItemSchema);

// --- Social ---
// PublicUser has no email field, and neither does this schema: parsing is the
// last place a leak would be caught before it reaches a component.
export const PublicUserSchema = z.object({
    id: z.string(),
    handle: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
});

export const FriendsOverviewSchema = z.object({
    friends: z.array(
        z.object({
            user: PublicUserSchema,
            friendshipId: z.string(),
            since: z.string().nullable().optional(),
            unread: z.number().default(0),
        }),
    ),
    incoming: z.array(
        z.object({
            id: z.string(),
            user: PublicUserSchema,
            createdAt: z.string().nullable().optional(),
        }),
    ),
    outgoing: z.array(
        z.object({
            id: z.string(),
            user: PublicUserSchema,
            createdAt: z.string().nullable().optional(),
        }),
    ),
});

export const UserSearchResultsSchema = z.object({
    results: z.array(
        PublicUserSchema.extend({
            relationship: z.enum(["none", "friends", "incoming", "outgoing", "self"]),
        }),
    ),
});

export const MessageAttachmentSchema = z.object({
    title: z.string(),
    mediaType: MediaTypeSchema,
    year: z.number().nullable().optional(),
    coverUrl: z.string().nullable().optional(),
});

export const ChatMessageSchema = z.object({
    id: z.string(),
    senderId: z.string(),
    recipientId: z.string(),
    body: z.string().nullable().optional(),
    attachment: MessageAttachmentSchema.nullable().optional(),
    readAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
});

export const MessagePageSchema = z.object({
    messages: z.array(ChatMessageSchema),
    has_more: z.boolean(),
});

export const ConversationListSchema = z.object({
    conversations: z.array(
        z.object({
            user: PublicUserSchema,
            lastMessage: ChatMessageSchema.nullable().optional(),
            unread: z.number().default(0),
        }),
    ),
});

// --- Share links ---
export const ShareLinkSchema = z.object({
    id: z.string(),
    slug: z.string(),
    label: z.string().nullable().optional(),
    statuses: z.array(StatusSchema).default([]),
    mediaTypes: z.array(MediaTypeSchema).default([]),
    favoritesOnly: z.boolean().default(false),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
});

export const ShareLinkListSchema = z.object({
    links: z.array(ShareLinkSchema),
});

// Deliberately has no `notes` field: the public endpoint never sends one, and
// declaring it here would invite a future caller to render it.
export const PublicWatchlistItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    mediaType: MediaTypeSchema,
    status: StatusSchema,
    favorite: z.boolean(),
    genres: z.array(z.string()).default([]),
    description: z.string().nullable().optional(),
    year: z.number().nullable().optional(),
    endYear: z.number().nullable().optional(),
    running: z.boolean().default(false),
    coverUrl: z.string().nullable().optional(),
    runtime: z.number().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
});

export type PublicWatchlistItemPayload = z.infer<typeof PublicWatchlistItemSchema>;

export const PublicWatchlistSchema = z.object({
    slug: z.string(),
    label: z.string().nullable().optional(),
    owner: z.object({
        name: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
    }),
    filters: z.object({
        statuses: z.array(StatusSchema).default([]),
        mediaTypes: z.array(MediaTypeSchema).default([]),
        favoritesOnly: z.boolean().default(false),
    }),
    items: z.array(PublicWatchlistItemSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    has_more: z.boolean(),
});

// --- Auth ---
export const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    emailVerified: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
});

export const TokenSchema = z.object({
    access_token: z.string(),
    refresh_token: z.string().optional(),
    token_type: z.string(),
});

// --- TMDB search ---
export const TMDBSearchResultSchema = z.object({
    tmdbId: z.number(),
    title: z.string(),
    year: z.number().nullable(),
    posterUrl: z.string().nullable(),
    backdropUrl: z.string().nullable(),
    overview: z.string().nullable(),
    mediaType: z.string(),
    genres: z.array(z.string()),
    voteAverage: z.number().nullable(),
});

export const TMDBSearchResponseSchema = z.object({
    results: z.array(TMDBSearchResultSchema),
});

// --- TMDB details ---
export const TMDBCastMemberSchema = z.object({
    name: z.string(),
    character: z.string(),
    profileUrl: z.string().nullable(),
});

export const TMDBMediaDetailsSchema = z.object({
    tmdbId: z.number(),
    title: z.string(),
    year: z.number().nullable(),
    overview: z.string().nullable(),
    genres: z.array(z.string()),
    voteAverage: z.number().nullable(),
    voteCount: z.number().nullable(),
    posterUrl: z.string().nullable(),
    backdropUrl: z.string().nullable(),
    runtime: z.number().nullable(),
    directors: z.array(z.string()),
    writers: z.array(z.string()),
    composers: z.array(z.string()),
    cast: z.array(TMDBCastMemberSchema),
    trailerKey: z.string().nullable(),
});

// --- Upload response ---
export const UploadResponseSchema = z.object({
    success: z.boolean(),
    imageUrl: z.string(),
});

// --- Safe parse helpers ---
export function safeParseWatchlistItems(data: unknown) {
    return WatchlistItemsSchema.safeParse(data);
}

export function safeParseShareLinks(data: unknown) {
    return ShareLinkListSchema.safeParse(data);
}

export function safeParseFriends(data: unknown) {
    return FriendsOverviewSchema.safeParse(data);
}

export function safeParseUserSearch(data: unknown) {
    return UserSearchResultsSchema.safeParse(data);
}

export function safeParseMessagePage(data: unknown) {
    return MessagePageSchema.safeParse(data);
}

export function safeParseConversations(data: unknown) {
    return ConversationListSchema.safeParse(data);
}

export function safeParsePublicWatchlist(data: unknown) {
    return PublicWatchlistSchema.safeParse(data);
}

export function safeParseUser(data: unknown) {
    return UserSchema.safeParse(data);
}

export function safeParseToken(data: unknown) {
    return TokenSchema.safeParse(data);
}

export function safeParseTMDBResults(data: unknown) {
    return TMDBSearchResponseSchema.safeParse(data);
}

export function safeParseMediaDetails(data: unknown) {
    return TMDBMediaDetailsSchema.safeParse(data);
}
