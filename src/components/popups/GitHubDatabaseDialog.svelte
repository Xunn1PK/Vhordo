<script lang="ts">
    import { getGitHubDatabaseConfig, saveGitHubDatabaseConfig, validateGitHubDatabaseConfig } from "$lib/integrations/githubDatabase"
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePopup } from "$lib/state/menu.svelte"
    import { showToast } from "$lib/state/toast.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import BaseDialog from "./BaseDialog.svelte"

    const currentConfig = getGitHubDatabaseConfig()
    let repositoryUrl = $state(currentConfig?.repositoryUrl ?? "")
    let accessToken = $state(currentConfig?.accessToken ?? "")
    let isSaving = $state(false)

    function closeDialog() {
        if (!isSaving) setActivePopup("settings")
    }

    async function saveConfiguration() {
        if (isSaving) return
        isSaving = true
        try {
            const config = { repositoryUrl, accessToken }
            const database = await validateGitHubDatabaseConfig(config)
            saveGitHubDatabaseConfig({ repositoryUrl: repositoryUrl.trim(), accessToken: accessToken.trim() })
            if (database) storage.importData(database)
            setActivePopup("settings")
            showToast(t("settings", "github_config_saved"), "success")
        } catch (error) {
            console.error("Failed to validate GitHub database configuration:", error)
            showToast(t("settings", "github_config_error"), "error")
        } finally {
            isSaving = false
        }
    }
</script>

<BaseDialog open icon="cloud_sync" title={t("settings", "github_title")} onclose={closeDialog}>
    <div class="github-form">
        <md-outlined-text-field
            label={t("settings", "github_repo_link")}
            type="url"
            autocomplete="url"
            value={repositoryUrl}
            oninput={(event: Event) => (repositoryUrl = (event.currentTarget as HTMLInputElement).value)}
            required
        ></md-outlined-text-field>
        <md-outlined-text-field
            label={t("settings", "github_access_token")}
            type="password"
            autocomplete="new-password"
            value={accessToken}
            oninput={(event: Event) => (accessToken = (event.currentTarget as HTMLInputElement).value)}
            required
        ></md-outlined-text-field>
        <p>{t("settings", "github_token_help")}</p>
    </div>

    {#snippet actions()}
        <md-text-button onclick={closeDialog} disabled={isSaving}>{t("settings", "github_cancel")}</md-text-button>
        <md-filled-button onclick={saveConfiguration} disabled={isSaving || !repositoryUrl.trim() || !accessToken.trim()}>
            {isSaving ? t("settings", "github_checking") : t("settings", "github_ok")}
        </md-filled-button>
    {/snippet}
</BaseDialog>

<style>
    .github-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 280px;
    }

    .github-form md-outlined-text-field {
        width: 100%;
    }

    .github-form p {
        margin: 0;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        font-size: 0.875rem;
    }
</style>
