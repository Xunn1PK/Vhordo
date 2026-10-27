<script lang="ts">
    import { t } from "$lib/state/i18n.svelte"
    import { setActivePopup } from "$lib/state/menu.svelte"
    import storage from "$lib/storage/StorageManager.svelte"
    import BaseDialog from "./BaseDialog.svelte"

    function keepLocalChanges() {
        storage.dismissGitHubChanges()
        setActivePopup(null)
    }

    function loadGitHubChanges() {
        const database = storage.pendingGitHubDatabase
        if (!database) return
        storage.importData(database, "github")
        storage.dismissGitHubChanges()
        setActivePopup(null)
    }
</script>

<BaseDialog open icon="cloud_sync" title={t("settings", "github_conflict_title")} maxWidth="min(480px, calc(100vw - 32px))" onclose={keepLocalChanges}>
    <div class="conflict-content">{t("settings", "github_conflict_message")}</div>

    {#snippet actions()}
        <div class="conflict-actions">
            <md-text-button onclick={keepLocalChanges}>
                {t("settings", "github_keep_local")}
            </md-text-button>
            <md-filled-button onclick={loadGitHubChanges}>
                {t("settings", "github_load_github")}
            </md-filled-button>
        </div>
    {/snippet}
</BaseDialog>

<style>
    .conflict-content {
        max-width: 480px;
        line-height: 1.5;
    }

    .conflict-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
    }

    .conflict-actions md-text-button,
    .conflict-actions md-filled-button {
        width: 100%;
        min-width: 0;
        justify-content: center;
    }

    @media (max-width: 480px) {
        .conflict-actions {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
