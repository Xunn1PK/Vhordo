import { Folder } from "../models/Folder"
import { List } from "../models/List"
import { Song } from "../models/Song"

export interface GitHubRepositoryDatabaseConfig {
    mode: "repository"
    repositoryUrl: string
    accessToken: string
}

export interface GitHubRawDatabaseConfig {
    mode: "raw"
    rawUrl: string
}

export type GitHubDatabaseConfig = GitHubRepositoryDatabaseConfig | GitHubRawDatabaseConfig

export interface GitHubDatabase {
    folders: Folder[]
    lists: List[]
    songs: Song[]
}

const CONFIG_KEY = "vhordo_github_database_config"
const DATABASE_FILE = "vhordo-database.json"
const API_BASE = "https://api.github.com"

export function getGitHubDatabaseConfig(): GitHubDatabaseConfig | null {
    if (typeof localStorage === "undefined") return null
    try {
        const value = localStorage.getItem(CONFIG_KEY)
        if (!value) return null
        const config = JSON.parse(value) as Partial<GitHubDatabaseConfig> & { repositoryUrl?: unknown; accessToken?: unknown; rawUrl?: unknown }
        if (config.mode === "raw" && typeof config.rawUrl === "string") {
            return { mode: "raw", rawUrl: config.rawUrl }
        }
        if (
            (config.mode === undefined || config.mode === "repository") &&
            typeof config.repositoryUrl === "string" &&
            typeof config.accessToken === "string"
        ) {
            return { mode: "repository", repositoryUrl: config.repositoryUrl, accessToken: config.accessToken }
        }
        return null
    } catch (error) {
        console.error("Failed to read GitHub database configuration:", error)
        return null
    }
}

export function saveGitHubDatabaseConfig(config: GitHubDatabaseConfig): void {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

export function clearGitHubDatabaseConfig(): void {
    localStorage.removeItem(CONFIG_KEY)
}

function getRepository(config: GitHubRepositoryDatabaseConfig): { owner: string; repo: string } {
    let url: URL
    try {
        url = new URL(config.repositoryUrl.trim())
    } catch {
        throw new Error("Invalid GitHub repository URL")
    }

    const parts = url.pathname.split("/").filter(Boolean)
    if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 2) {
        throw new Error("Invalid GitHub repository URL")
    }
    const repo = parts[1]?.replace(/\.git$/, "")
    if (!parts[0] || !repo) throw new Error("Invalid GitHub repository URL")
    return { owner: parts[0], repo }
}

async function request<T>(path: string, config: GitHubRepositoryDatabaseConfig, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${config.accessToken.trim()}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...init?.headers
        }
    })
    if (!response.ok) {
        const detail = await response.text()
        throw new Error(`GitHub request failed (${response.status}): ${detail}`)
    }
    return (await response.json()) as T
}

function getContentPath(owner: string, repo: string): string {
    return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${DATABASE_FILE}`
}

function decodeBase64(value: string): string {
    const binary = atob(value.replace(/\s/g, ""))
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return new TextDecoder().decode(bytes)
}

function encodeBase64(value: string): string {
    const bytes = new TextEncoder().encode(value)
    let binary = ""
    for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    return btoa(binary)
}

function parseDatabase(value: unknown): GitHubDatabase {
    if (!value || typeof value !== "object") throw new Error("GitHub database file is not a valid database")
    const data = value as Partial<GitHubDatabase>
    if (
        !Array.isArray(data.folders) ||
        !Array.isArray(data.lists) ||
        !Array.isArray(data.songs) ||
        !data.folders.every(isObject) ||
        !data.lists.every(isObject) ||
        !data.songs.every(isObject)
    ) {
        throw new Error("GitHub database file is not a valid database")
    }
    return {
        folders: data.folders.map((folder) => new Folder(folder as ConstructorParameters<typeof Folder>[0])),
        lists: data.lists.map((list) => new List(list as ConstructorParameters<typeof List>[0])),
        songs: data.songs.map((song) => new Song(song as ConstructorParameters<typeof Song>[0]))
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

async function getDatabaseFile(config: GitHubRepositoryDatabaseConfig, path: string): Promise<{ content: string; sha: string } | null> {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${config.accessToken.trim()}`,
            "X-GitHub-Api-Version": "2022-11-28"
        }
    })
    if (response.status === 404) return null
    if (!response.ok) {
        const detail = await response.text()
        throw new Error(`GitHub request failed (${response.status}): ${detail}`)
    }
    const file = (await response.json()) as { content?: string; sha?: string; encoding?: string }
    if (file.encoding !== "base64" || !file.content || !file.sha) {
        throw new Error("GitHub database file has an unsupported format")
    }
    return { content: decodeBase64(file.content), sha: file.sha }
}

function getRawDatabaseUrl(config: GitHubRawDatabaseConfig): string {
    let url: URL
    try {
        url = new URL(config.rawUrl.trim())
    } catch {
        throw new Error("Invalid raw GitHub URL")
    }

    if (
        url.protocol !== "https:" ||
        url.hostname !== "raw.githubusercontent.com" ||
        url.username ||
        url.password ||
        url.pathname.split("/").filter(Boolean).length < 4
    ) {
        throw new Error("Invalid raw GitHub URL")
    }
    return url.toString()
}

async function fetchRawDatabase(config: GitHubRawDatabaseConfig): Promise<GitHubDatabase> {
    const url = getRawDatabaseUrl(config)
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Raw GitHub request failed (${response.status}): ${await response.text()}`)
    }
    return parseDatabase(await response.json())
}

export async function validateGitHubDatabaseConfig(config: GitHubDatabaseConfig): Promise<GitHubDatabase | null> {
    if (config.mode === "raw") return fetchRawDatabase({ ...config, rawUrl: config.rawUrl.trim() })

    const normalized = { ...config, repositoryUrl: config.repositoryUrl.trim(), accessToken: config.accessToken.trim() }
    if (!normalized.accessToken) throw new Error("GitHub access token is required")
    const { owner, repo } = getRepository(normalized)

    await request("/user", normalized)
    await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, normalized)
    const file = await getDatabaseFile(normalized, getContentPath(owner, repo))
    return file ? parseDatabase(JSON.parse(file.content)) : null
}

export async function loadGitHubDatabase(config: GitHubDatabaseConfig): Promise<GitHubDatabase | null> {
    if (config.mode === "raw") return fetchRawDatabase(config)

    const { owner, repo } = getRepository(config)
    const file = await getDatabaseFile(config, getContentPath(owner, repo))
    return file ? parseDatabase(JSON.parse(file.content)) : null
}

export async function uploadGitHubDatabase(config: GitHubDatabaseConfig, database: GitHubDatabase): Promise<void> {
    if (config.mode === "raw") throw new Error("Raw GitHub database links are read-only")

    const { owner, repo } = getRepository(config)
    const path = getContentPath(owner, repo)
    const currentFile = await getDatabaseFile(config, path)
    const content = encodeBase64(JSON.stringify(database, null, 2))
    const body: { message: string; content: string; sha?: string } = {
        message: "Update Vhordo song database",
        content
    }
    if (currentFile) body.sha = currentFile.sha

    await request(path, config, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    })
}
