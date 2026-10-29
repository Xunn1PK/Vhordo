export type SupportedTheme = "teal" | "indigo" | "blue" | "green" | "orange" | "rose" | "slate" | "white" | "monochrome" | "gold" | "chocolate" | 
"dark_blue" | "dark_teal" | "dark_indigo" | "dark_orange" | "dark_green" | "dark_rose" | "dark_slate" | "sapphire" | "aquamarine"

export interface ThemeOption {
    id: SupportedTheme
    labelKey: string
    color: string // Primary accent for preview dot/chip
    background: string // Background preview tint
    gradient?: string
}

export const SUPPORTED_THEMES: ThemeOption[] = [
    // light
    { id: "blue", labelKey: "Ocean Blue", color: "#7eb4e8", background: "#cbe2f8" },
    { id: "teal", labelKey: "Teal", color: "#67b6b6", background: "#c1e9e9" },
    { id: "indigo", labelKey: "Indigo", color: "#a892e8", background: "#e8ddff" },
    { id: "orange", labelKey: "Sunset Orange", color: "#f5aa67", background: "#feddc2" },
    { id: "green", labelKey: "Forest Green", color: "#7ec89f", background: "#cbead8" },
    { id: "rose", labelKey: "Rose Pink", color: "#f296b1", background: "#fcd0dc" },
    { id: "slate", labelKey: "Slate Grey", color: "#98aabf", background: "#d4dee8" },
    // dark
    { id: "dark_blue", labelKey: "Midnight Blue", color: "#5b96cc", background: "#151f2b" },
    { id: "dark_teal", labelKey: "Dark Teal", color: "#55a5a5", background: "#172828" },
    { id: "dark_indigo", labelKey: "Deep Indigo", color: "#9278d4", background: "#211b32" },
    { id: "dark_orange", labelKey: "Dawn Orange", color: "#e99a50", background: "#2b2118" },
    { id: "dark_green", labelKey: "Woods Green", color: "#5db486", background: "#192a21" },
    { id: "dark_rose", labelKey: "Dark Rose", color: "#d97896", background: "#2b1b22" },
    { id: "dark_slate", labelKey: "Greyed Blue", color: "#8297ae", background: "#1c242e" },
    // black and white
    { id: "white", labelKey: "Pure White", color: "#ffffff", background: "#ffffff" },
    { id: "monochrome", labelKey: "Monochrome Dark", color: "#1c1c1e", background: "#2c2c2e" },
    // gradient themes
    {
        id: "gold",
        labelKey: "Metallic Gold",
        color: "#ba8c28",
        background: "#e2d2ab",
        gradient: "linear-gradient(135deg, #d8b15d 0%, #ba8c28 35%, #825d10 70%, #c69d3e 100%)"
    },
    {
        id: "chocolate",
        labelKey: "Chocolate",
        color: "#b07b32",
        background: "#3e2415",
        gradient: "linear-gradient(135deg, #e8be6d 0%, #9e5b22 45%, #422112 100%)"
    },
        {
        id: "aquamarine",
        labelKey: "Shiny Aquamarine",
        color: "#28bfaf",
        background: "#c9f2e9",
        gradient: "linear-gradient(135deg, #83e8d8 0%, #28dfaf 35%, #147f7a 70%, #50d4c0 100%)"
    },
    {
        id: "sapphire",
        labelKey: "Deep Sapphire",
        color: "#2463c5",
        background: "#0d1833",
        gradient: "linear-gradient(135deg, #6fa8ff 0%, #2463c5 45%, #091126 100%)"
    }
]

export const DEFAULT_THEME: SupportedTheme = "blue"

let currentTheme = $state<SupportedTheme>(DEFAULT_THEME)

export function getTheme(): SupportedTheme {
    return currentTheme
}

export function setTheme(theme: SupportedTheme) {
    const validTheme = SUPPORTED_THEMES.find((t) => t.id === theme)?.id ?? DEFAULT_THEME
    currentTheme = validTheme

    if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = validTheme
        const matched = SUPPORTED_THEMES.find((t) => t.id === validTheme)
        if (matched) {
            let metaTheme = document.querySelector('meta[name="theme-color"]')
            if (!metaTheme) {
                metaTheme = document.createElement("meta")
                metaTheme.setAttribute("name", "theme-color")
                document.head.appendChild(metaTheme)
            }
            metaTheme.setAttribute("content", matched.background)
        }
    }
}
