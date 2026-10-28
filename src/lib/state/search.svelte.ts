import type { Song } from "$lib/models/Song"

export const searchState = $state<{
    isOpen: boolean
    query: string
}>({
    isOpen: false,
    query: ""
})

export function openSearch() {
    searchState.isOpen = true
}

export function closeSearch() {
    searchState.isOpen = false
    searchState.query = ""
}

function normalizeSearchText(value: string | undefined | null): string {
    return (value || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ")
}

function getAllowedTypoCount(word: string): number {
    return word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0
}

function getEditDistance(first: string, second: string): number {
    const distances = Array.from({ length: first.length + 1 }, () => new Array<number>(second.length + 1).fill(0))

    for (let i = 0; i <= first.length; i++) distances[i]![0] = i
    for (let j = 0; j <= second.length; j++) distances[0]![j] = j

    for (let i = 1; i <= first.length; i++) {
        for (let j = 1; j <= second.length; j++) {
            const substitutionCost = first[i - 1] === second[j - 1] ? 0 : 1
            distances[i]![j] = Math.min(
                distances[i - 1]![j]! + 1,
                distances[i]![j - 1]! + 1,
                distances[i - 1]![j - 1]! + substitutionCost
            )

            if (
                i > 1 &&
                j > 1 &&
                first[i - 1] === second[j - 2] &&
                first[i - 2] === second[j - 1]
            ) {
                distances[i]![j] = Math.min(distances[i]![j]!, distances[i - 2]![j - 2]! + 1)
            }
        }
    }

    return distances[first.length]![second.length]!
}

function isApproximatePhraseMatch(text: string, query: string): boolean {
    const textWords = text.split(" ")
    const queryWords = query.split(" ")
    if (queryWords.length > textWords.length) return false

    for (let start = 0; start <= textWords.length - queryWords.length; start++) {
        const matches = queryWords.every((queryWord, index) => {
            const textWord = textWords[start + index]!
            const allowedTypos = getAllowedTypoCount(queryWord)
            return (
                textWord === queryWord ||
                (allowedTypos > 0 &&
                    Math.abs(queryWord.length - textWord.length) <= allowedTypos &&
                    getEditDistance(queryWord, textWord) <= allowedTypos)
            )
        })
        if (matches) return true
    }

    return false
}

/**
 * Scores a title/name against a search query:
 * 3 = exact, 2 = prefix, 1 = substring, 0.5 = approximate, 0 = no match
 */
function scoreName(name: string | undefined | null, q: string): number {
    const n = normalizeSearchText(name)
    if (!n || !q) return 0
    if (n === q) return 3
    if (n.startsWith(q)) return 2
    if (n.includes(q)) return 1
    return isApproximatePhraseMatch(n, q) ? 0.5 : 0
}

/**
 * Strips ChordPro directives ({title:...}) and bracketed chords ([Am])
 * to yield plain searchable lyrics text.
 */
export function getSearchableSongContent(content: string | undefined | null): string {
    if (!content) return ""
    return content.replace(/\{[^}]*\}|\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim()
}

/**
 * Scores a song against a search query with priority:
 * 1. Title match (30+)
 * 2. Metadata: artist / composer / album / etc. (20+)
 * 3. Text content / lyrics (10)
 */
export function scoreSongMatch(song: { name: string; metadata?: any; content?: string }, query: string): number {
    const q = normalizeSearchText(query)
    if (!q) return 0

    // Priority 1: Title
    const titleScore = scoreName(song.name, q)
    if (titleScore > 0) return 30 + titleScore

    // Priority 2: Metadata
    if (song.metadata) {
        const artistScore = scoreName(song.metadata.artist, q)
        if (artistScore > 0) return 20 + artistScore

        for (const [key, value] of Object.entries(song.metadata)) {
            if (key !== "artist" && typeof value === "string") {
                const metadataScore = scoreName(value, q)
                if (metadataScore > 0) return 20 + metadataScore
            }
        }
    }

    // Priority 3: Lyrics / Content
    if (song.content) {
        const contentScore = scoreName(getSearchableSongContent(song.content), q)
        if (contentScore > 0) return 10 + contentScore
    }

    return 0
}

/**
 * Helper to filter and sort an array of items by score while preserving original order on ties.
 */
function filterAndSortByScore<T>(items: T[], getScore: (item: T) => number): T[] {
    return items
        .map((item, index) => ({ item, score: getScore(item), index }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map((entry) => entry.item)
}

/**
 * Searches and sorts songs by match priority (title -> metadata -> lyrics).
 */
export function searchSongs<T extends { name: string; metadata?: any; content?: string }>(songs: T[], query: string): T[] {
    const q = query.trim()
    if (!q) return songs
    return filterAndSortByScore(songs, (song) => scoreSongMatch(song, q))
}

/**
 * Generic search for named items (folders, lists).
 */
export function searchNamedItems<T extends { name: string }>(items: T[], query: string): T[] {
    const q = normalizeSearchText(query)
    if (!query.trim()) return items
    return filterAndSortByScore(items, (item) => scoreName(item.name, q))
}

/**
 * Searches and sorts setlist items (songs and sections).
 */
export function searchListDisplayItems<T extends { item: { name: string; song?: any } }>(items: T[], query: string): T[] {
    const q = normalizeSearchText(query)
    if (!query.trim()) return items
    return filterAndSortByScore(items, (entry) =>
        entry.item.song ? scoreSongMatch(entry.item.song, q) : scoreName(entry.item.name, q) * 10
    )
}

export function songMatchesSearch(song: Song, query: string): boolean {
    if (!query.trim()) return true
    return scoreSongMatch(song, query) > 0
}
