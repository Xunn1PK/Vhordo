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

export function setSearchQuery(query: string) {
    searchState.query = query
}

export function songMatchesSearch(song: Song, query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return true

    return song.name.toLowerCase().includes(normalizedQuery)
        || song.content.toLowerCase().includes(normalizedQuery)
        || song.metadata?.artist?.toLowerCase().includes(normalizedQuery) === true
}
