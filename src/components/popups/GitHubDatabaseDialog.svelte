<script lang="ts">
    import {
        clearGitHubDatabaseConfig,
        getGitHubDatabaseConfig,
        saveGitHubDatabaseConfig,
        validateGitHubDatabaseConfig,
        type GitHubDatabaseConfig
    } from "$lib/integrations/githubDatabase"
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePopup } from "$lib/state/menu.svelte"
    import { showToast } from "$lib/state/toast.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import BaseDialog from "./BaseDialog.svelte"
    import "@material/web/switch/switch.js"

    const currentConfig = getGitHubDatabaseConfig()
    let useRawLink = $state(currentConfig?.mode === "raw")
    let repositoryPath = $state(
        currentConfig?.mode === "repository"
            ? currentConfig.repositoryUrl.replace(/^https:\/\/github\.com\//i, "").replace(/\.git\/?$/, "")
            : ""
    )
    let accessToken = $state(currentConfig?.mode === "repository" ? currentConfig.accessToken : "")
    let rawUrl = $state(currentConfig?.mode === "raw" ? currentConfig.rawUrl : "")
    let isSaving = $state(false)

    function closeDialog() {
        if (!isSaving) setActivePopup("settings")
    }

    async function saveConfiguration() {
        if (isSaving) return
        isSaving = true
        try {
            const config: GitHubDatabaseConfig = useRawLink
                ? { mode: "raw", rawUrl: rawUrl.trim() }
                : { mode: "repository", repositoryUrl: `https://github.com/${repositoryPath.trim()}`, accessToken: accessToken.trim() }
            const database = await validateGitHubDatabaseConfig(config)
            saveGitHubDatabaseConfig(config)
            if (database) storage.importData(database, "github")
            setActivePopup("settings")
            showToast(t("settings", "github_config_saved"), "success")
        } catch (error) {
            console.error("Failed to validate GitHub database configuration:", error)
            showToast(t("settings", "github_config_error"), "error")
        } finally {
            isSaving = false
        }
    }

    function removeConfiguration() {
        if (isSaving || !currentConfig) return
        clearGitHubDatabaseConfig()
        storage.clearGitHubLocalChanges()
        storage.dismissGitHubChanges()
        setActivePopup("settings")
    }
</script>

<BaseDialog open icon="cloud_sync" title={t("settings", "github_title")} maxWidth="min(480px, calc(100vw - 32px))" onclose={closeDialog}>
    <div class="github-form">
        <div class="github-mode-toggle">
            <span>{t("settings", "github_use_raw_link")}</span>
            <md-switch
                aria-label={t("settings", "github_use_raw_link")}
                selected={useRawLink}
                onchange={(event: Event) => {
                    const target = event.target as EventTarget & { selected?: boolean; checked?: boolean }
                    useRawLink = Boolean(target.selected ?? target.checked)
                }}
            ></md-switch>
        </div>
        {#if useRawLink}
            <md-outlined-text-field
                label={t("settings", "github_raw_link")}
                type="url"
                autocomplete="url"
                value={rawUrl}
                oninput={(event: Event) => (rawUrl = (event.currentTarget as HTMLInputElement).value)}
                required
            ></md-outlined-text-field>
            <p>{t("settings", "github_raw_help")}</p>
        {:else}
            <md-outlined-text-field
                label={t("settings", "github_repo_link")}
                type="text"
                autocomplete="off"
                placeholder="example/repository"
                value={repositoryPath}
                oninput={(event: Event) => (repositoryPath = (event.currentTarget as HTMLInputElement).value)}
                required
            ></md-outlined-text-field>
            <md-outlined-text-field
                label={t("settings", "github_access_token")}
                type="password"
                value={accessToken}
                oninput={(event: Event) => (accessToken = (event.currentTarget as HTMLInputElement).value)}
                required
            ></md-outlined-text-field>
            <p>{t("settings", "github_token_help")}</p>
        {/if}
    </div>

    {#snippet actions()}
        <div class="github-form-actions">
            <md-text-button onclick={closeDialog} disabled={isSaving}>{t("settings", "github_cancel")}</md-text-button>
            <md-filled-button onclick={saveConfiguration} disabled={isSaving || (useRawLink ? !rawUrl.trim() : !repositoryPath.trim() || !accessToken.trim())}>
                {isSaving ? t("settings", "github_checking") : t("settings", "github_ok")}
            </md-filled-button>
            <md-filled-button class=delete-button onclick={removeConfiguration} disabled={isSaving || !currentConfig}>
                {t("common", "delete")}
            </md-filled-button>
        </div>
    {/snippet}
</BaseDialog>

<style>
    .github-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }

    .github-form md-outlined-text-field {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }

    .github-form p {
        margin: 0;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        font-size: 0.875rem;
        line-height: 1.45;
        overflow-wrap: anywhere;
    }

    .github-mode-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-width: 0;
        color: var(--md-sys-color-on-surface, #1d1b20);
        line-height: 1.4;
        overflow-wrap: anywhere;
        cursor: pointer;
    }

    .github-mode-toggle span {
        min-width: 0;
    }

    .github-form-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
        min-width: 0;
    }

    .github-form-actions :global(md-text-button),
    .github-form-actions :global(md-filled-button) {
        min-width: 0;
        max-width: 100%;
    }

    .delete-button {
        --md-filled-button-container-color: var(--md-sys-color-error, #ba1a1a);
        --md-filled-button-label-text-color: #ffffff;
    }

    @media (max-width: 560px) {
        .github-form-actions {
            grid-template-columns: minmax(0, 1fr);
        }

        .github-form-actions :global(md-text-button),
        .github-form-actions :global(md-filled-button) {
            width: 100%;
            justify-content: center;
        }
    }
</style>
