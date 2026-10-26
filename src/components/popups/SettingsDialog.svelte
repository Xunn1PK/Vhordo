<script lang="ts">
    import { Settings, type PageSwitchAnimation } from "$lib/models/Settings"
    import { openConfirm } from "$lib/state/confirm.svelte"
    import { getLocale, SUPPORTED_LANGUAGES, t, type SupportedLocale } from "$lib/state/i18n.svelte"
    import { fullscreenState, menuState, popupState, setActivePopup, setFullscreenLyricsOnly } from "$lib/state/menu.svelte"
    import { getTheme, SUPPORTED_THEMES, type SupportedTheme } from "$lib/state/theme.svelte"
    import { showToast } from "$lib/state/toast.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import "@material/web/iconbutton/filled-tonal-icon-button.js"
    import "@material/web/select/outlined-select.js"
    import "@material/web/select/select-option.js"
    import "@material/web/slider/slider.js"
    import "@material/web/switch/switch.js"

    let currentLanguage = $derived<SupportedLocale>(getLocale())
    let currentTheme = $derived<SupportedTheme>(getTheme())
    const sortedLanguages = [...SUPPORTED_LANGUAGES].sort((a, b) => a.label.localeCompare(b.label))
    let importStatus = $state<string | null>(null)
    let isImporting = $state(false)
    let isExporting = $state(false)

    // Paper options state
    const isSongSettings = $derived(
        popupState.popupId === "settings" && (menuState.activePage === "song_live" || menuState.activePage === "song" || menuState.activePage === "all_songs")
    )
    const isFullscreen = $derived(menuState.activePage === "song_live")

    const BACKGROUND_PRESETS = [
        { id: "white", color: "#ffffff", border: "#cac4d0", label: "White" },
        { id: "cream", color: "#f8f5ee", border: "#ded7c8", label: "Cream / Warm" },
        { id: "sepia", color: "#f2ebd9", border: "#d4c8ad", label: "Sepia" },
        { id: "dark", color: "#222222", border: "#444444", label: "Dark Gray" },
        { id: "black", color: "#000000", border: "#333333", label: "Black" }
    ]

    let currentBg = $state(storage.settings.paperOptions?.background || "#ffffff")
    let currentFontSize = $state(storage.settings.paperOptions?.fontSize ?? 100)
    let currentPageAnimation = $state<PageSwitchAnimation>(storage.settings.paperOptions?.pageAnimation || "fast")

    function selectBackground(color: string) {
        currentBg = color
        storage.settings = new Settings({
            ...storage.settings,
            paperOptions: {
                ...storage.settings.paperOptions,
                background: color
            }
        })
        storage.persist()
    }

    function handleFontSizeInput(e: Event) {
        const val = Number((e.target as HTMLInputElement).value)
        if (!isNaN(val)) {
            setFontSize(val)
        }
    }

    function stepFontSize(delta: number) {
        const next = Math.max(70, Math.min(150, currentFontSize + delta))
        setFontSize(next)
    }

    function setFontSize(val: number) {
        currentFontSize = val
        storage.settings = new Settings({
            ...storage.settings,
            paperOptions: {
                ...storage.settings.paperOptions,
                fontSize: val
            }
        })
        storage.persist()
    }

    function selectPageAnimation(animation: PageSwitchAnimation) {
        currentPageAnimation = animation
        storage.settings = new Settings({
            ...storage.settings,
            paperOptions: {
                ...storage.settings.paperOptions,
                pageAnimation: animation
            }
        })
        storage.persist()
    }

    function resetPaperDefaults() {
        selectBackground("#ffffff")
        setFontSize(100)
        selectPageAnimation("fast")
    }

    function closeDialog() {
        setActivePopup(null)
    }

    function selectLanguage(locale: SupportedLocale) {
        storage.settings = new Settings({ ...storage.settings, locale })
        storage.settings.apply()
        storage.persist()
    }

    function selectTheme(theme: SupportedTheme) {
        storage.settings = new Settings({ ...storage.settings, theme })
        storage.settings.apply()
        storage.persist()
    }

    async function exportBackup() {
        if (isExporting) return
        isExporting = true
        try {
            let token = localStorage.getItem("gh_token")
            if (!token) {
                token = window.prompt(t("settings", "export_token_prompt"))?.trim() || null
                if (!token) return
                localStorage.setItem("gh_token", token)
            }

            const fileUrl = "https://api.github.com/repos/Xunn1PK/preobrazhenie-songs/contents/songs.json"
            const headers = {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
            const currentFileResponse = await fetch(fileUrl, { headers })
            if (!currentFileResponse.ok) {
                const error = await currentFileResponse.json().catch(() => null)
                throw new Error(error?.message || `GitHub request failed (${currentFileResponse.status})`)
            }

            const currentFile = await currentFileResponse.json()
            if (typeof currentFile.sha !== "string") {
                throw new Error("GitHub did not return the current file SHA")
            }

            const data = {
                folders: storage.folders,
                lists: storage.lists,
                songs: storage.songs,
                exportedAt: new Date().toISOString()
            }
            const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2))
            let binary = ""
            for (let offset = 0; offset < bytes.length; offset += 0x8000) {
                binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
            }

            const updateResponse = await fetch(fileUrl, {
                method: "PUT",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Update songs via Chordo app",
                    content: btoa(binary),
                    sha: currentFile.sha
                })
            })
            if (!updateResponse.ok) {
                const error = await updateResponse.json().catch(() => null)
                throw new Error(error?.message || `GitHub request failed (${updateResponse.status})`)
            }

            showToast(t("settings", "export_success"), "success")
        } catch (err) {
            console.error("Failed to export data to GitHub:", err)
            const message = err instanceof Error ? err.message : String(err)
            showToast(`${t("settings", "export_error")} ${message}`, "error")
        } finally {
            isExporting = false
        }
    }

    async function importRemoteData() {
        if (isImporting) return
        isImporting = true
        importStatus = null
        try {
            const response = await fetch("https://raw.githubusercontent.com/Xunn1PK/preobrazhenie-songs/refs/heads/main/songs.json")
            if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
            const parsed = await response.json()

            if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.songs)) {
                importStatus = t("settings", "import_invalid")
                return
            }

            openConfirm({
                title: t("settings", "import_confirm_title"),
                message: `This will import ${parsed.songs?.length || 0} songs, ${parsed.lists?.length || 0} lists, and ${parsed.folders?.length || 0} folders.`,
                confirmLabel: t("settings", "import_confirm_btn"),
                onConfirm: () => {
                    storage.importData(parsed)
                    importStatus = t("settings", "import_success")
                }
            })
        } catch (err) {
            console.error("Failed to load remote songs:", err)
            importStatus = t("settings", "import_error")
        } finally {
            isImporting = false
        }
    }

    function confirmReset() {
        openConfirm({
            title: t("settings", "reset_confirm_title"),
            message: t("settings", "reset_confirm_msg"),
            confirmLabel: t("settings", "reset_confirm_btn"),
            isDestructive: true,
            onConfirm: () => {
                storage.resetAll()
                closeDialog()
            }
        })
    }
</script>

<md-dialog open onclosed={closeDialog} oncancel={closeDialog}>
    <div slot="headline" class="settings-headline">
        <span class="material-symbols-outlined settings-icon">{isSongSettings ? "tune" : "settings"}</span>
        {isSongSettings ? t("song_fullscreen", "settings_title") : t("settings", "title")}
    </div>

    <div slot="content" class="settings-content">
        {#if isSongSettings}
            <!-- Background Color Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">palette</span>
                    {t("song_fullscreen", "page_background")}
                </div>
                <div class="color-options">
                    {#each BACKGROUND_PRESETS as preset}
                        {@const isSelected = currentBg.toLowerCase() === preset.color.toLowerCase()}
                        {@const isDarkPreset = preset.color === "#222222" || preset.color === "#000000"}
                        <button
                            type="button"
                            class="color-circle"
                            class:active={isSelected}
                            style="background-color: {preset.color}; border-color: {preset.border};"
                            aria-label={preset.label}
                            title={preset.label}
                            onclick={() => selectBackground(preset.color)}
                        >
                            {#if isSelected}
                                <span class="material-symbols-outlined check-icon" class:light-check={isDarkPreset} class:dark-check={!isDarkPreset}>
                                    check
                                </span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>

            <hr class="section-divider" />

            <!-- Font / Text Size Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">format_size</span>
                    {t("song_fullscreen", "text_size")}
                </div>

                <div class="font-size-row">
                    <md-filled-tonal-icon-button onclick={() => stepFontSize(-5)} disabled={currentFontSize <= 70} aria-label="Decrease text size">
                        <span class="material-symbols-outlined">remove</span>
                    </md-filled-tonal-icon-button>

                    <div class="font-size-slider-wrapper">
                        <md-slider
                            min="70"
                            max="150"
                            value={currentFontSize}
                            step="5"
                            labeled
                            oninput={handleFontSizeInput}
                            class="font-slider"
                        ></md-slider>
                        <span class="font-size-label">{currentFontSize}%</span>
                    </div>

                    <md-filled-tonal-icon-button onclick={() => stepFontSize(5)} disabled={currentFontSize >= 150} aria-label="Increase text size">
                        <span class="material-symbols-outlined">add</span>
                    </md-filled-tonal-icon-button>
                </div>
            </div>

            <hr class="section-divider" />

            <!-- Chords vs Text View Option -->
            <div class="settings-section">
                <label class="option-toggle-row">
                    <div class="toggle-text">
                        <div class="toggle-title">{t("song_fullscreen", "lyrics_only")}</div>
                    </div>
                    <md-switch
                        selected={fullscreenState.lyricsOnly}
                        onchange={(e: Event) => {
                            const val = Boolean((e.target as any).selected ?? (e.target as any).checked)
                            setFullscreenLyricsOnly(val)
                        }}
                    ></md-switch>
                </label>
            </div>

            {#if isFullscreen}
                <hr class="section-divider" />

                <!-- Page Switch Animation Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span class="material-symbols-outlined section-icon">animation</span>
                        {t("song_fullscreen", "page_animation")}
                    </div>

                    <md-outlined-select
                        value={currentPageAnimation}
                        onchange={(e: Event) => {
                            const target = e.target as HTMLSelectElement
                            if (target?.value) {
                                selectPageAnimation(target.value as PageSwitchAnimation)
                            }
                        }}
                        class="animation-select"
                    >
                        <md-select-option value="none" selected={currentPageAnimation === "none"}>
                            <div slot="headline">{t("song_fullscreen", "animation_none")}</div>
                        </md-select-option>
                        <md-select-option value="fast" selected={currentPageAnimation === "fast"}>
                            <div slot="headline">{t("song_fullscreen", "animation_fast")}</div>
                        </md-select-option>
                        <md-select-option value="slow" selected={currentPageAnimation === "slow"}>
                            <div slot="headline">{t("song_fullscreen", "animation_slow")}</div>
                        </md-select-option>
                    </md-outlined-select>
                </div>
            {/if}
        {:else}
            <!-- Theme Color Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">palette</span>
                    {t("settings", "theme")}
                </div>
                <div class="theme-circles">
                    {#each SUPPORTED_THEMES as themeOption}
                        <button
                            type="button"
                            class="color-circle"
                            class:active={currentTheme === themeOption.id}
                            style="background-color: {themeOption.color};"
                            aria-label={themeOption.labelKey}
                            title={themeOption.labelKey}
                            onclick={() => selectTheme(themeOption.id)}
                        >
                            {#if currentTheme === themeOption.id}
                                <span class="material-symbols-outlined check-icon">check</span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>

            <hr class="section-divider" />

            <!-- Language Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">language</span>
                    {t("settings", "language")}
                </div>
                <md-outlined-select
                    value={currentLanguage}
                    onchange={(e: Event) => {
                        const target = e.target as HTMLSelectElement
                        if (target?.value) {
                            selectLanguage(target.value as SupportedLocale)
                        }
                    }}
                    class="language-select"
                >
                    {#each sortedLanguages as lang}
                        <md-select-option value={lang.code} selected={currentLanguage === lang.code}>
                            <div slot="headline">{lang.label}</div>
                        </md-select-option>
                    {/each}
                </md-outlined-select>
            </div>

            <hr class="section-divider" />

            <!-- Data Management Section -->
            <div class="settings-section">
                <div class="section-title">
                    <span class="material-symbols-outlined section-icon">database</span>
                    {t("settings", "data_management")}
                </div>

                <div class="settings-actions">
                    <div class="data-actions-row">
                        <md-outlined-button onclick={exportBackup} disabled={isExporting}>
                            <span class="material-symbols-outlined" slot="icon">cloud_upload</span>
                            {t("settings", "export_data")}
                        </md-outlined-button>

                        <md-outlined-button onclick={importRemoteData} disabled={isImporting}>
                            <span class="material-symbols-outlined" slot="icon">cloud_download</span>
                            {t("settings", "import_data")}
                        </md-outlined-button>
                    </div>

                    {#if importStatus}
                        <div class="status-msg">{importStatus}</div>
                    {/if}

                    <md-text-button class="danger-btn" onclick={confirmReset}>
                        <span class="material-symbols-outlined" slot="icon">delete_forever</span>
                        {t("settings", "reset_data")}
                    </md-text-button>
                </div>
            </div>
        {/if}
    </div>

    <div slot="actions">
        {#if isSongSettings}
            <md-text-button onclick={resetPaperDefaults}>{t("common", "reset")}</md-text-button>
        {/if}
        <md-filled-button role="button" tabindex="0" onclick={closeDialog}>{t("settings", "done")}</md-filled-button>
    </div>
</md-dialog>

<style>
    .settings-headline {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }

    .settings-icon {
        color: var(--md-sys-color-primary);
        font-size: 28px;
    }

    .settings-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: var(--md-sys-color-on-surface, #1d1b20);
        min-width: 280px;
        max-height: 70vh;
        overflow-y: auto;
    }

    .settings-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--md-sys-color-on-surface, #1d1b20);
        opacity: 0.85;
    }

    .section-icon {
        font-size: 20px;
        color: var(--md-sys-color-primary);
    }

    .section-divider {
        border: none;
        border-top: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.08));
        margin: 2px 0;
    }

    .theme-circles {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        padding: 4px 0;
    }

    .color-circle {
        position: relative;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.12);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
            transform 0.2s cubic-bezier(0.2, 0, 0, 1),
            box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
        padding: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .color-circle:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }

    .color-circle.active {
        transform: scale(1.08);
        box-shadow:
            0 0 0 2.5px var(--md-sys-color-surface, #ffffff),
            0 0 0 4.5px var(--md-sys-color-primary);
    }

    .color-circle .check-icon {
        font-size: 20px;
        color: var(--md-sys-color-on-primary, #044444);
        font-weight: bold;
    }

    :global([data-theme="white"]) .color-circle .check-icon {
        color: #111111;
    }

    :global([data-theme="monochrome"]) .color-circle .check-icon {
        color: #ffffff;
    }

    .language-select,
    .animation-select {
        width: 100%;
    }

    .settings-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .data-actions-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .data-actions-row > :global(md-outlined-button) {
        flex: 1 1 0;
    }

    .status-msg {
        font-size: 0.85rem;
        text-align: center;
        opacity: 0.8;
    }

    .danger-btn {
        color: var(--md-sys-color-error, #ba1a1a);
    }

    .color-options {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        padding: 4px 0;
    }

    .check-icon.dark-check {
        color: #1d1b20;
    }

    .check-icon.light-check {
        color: #ffffff;
    }

    .font-size-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .font-size-slider-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }

    .font-slider {
        width: 100%;
        --md-slider-active-track-color: var(--md-sys-color-primary, #6750a4);
        --md-slider-handle-color: var(--md-sys-color-primary, #6750a4);
    }

    .font-size-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--md-sys-color-primary);
    }

    .option-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        background: transparent;
        cursor: pointer;
        user-select: none;
        transition: background-color 0.15s ease;
    }

    .option-toggle-row:hover {
        background-color: var(--md-sys-color-surface-container-high, rgba(0, 0, 0, 0.05));
    }

    .toggle-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
    }

    .toggle-title {
        font-weight: 500;
        font-size: 0.95rem;
        color: var(--md-sys-color-on-surface, #1d1b20);
    }
</style>
