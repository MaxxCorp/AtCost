<script lang="ts">
    import Breadcrumb from "#lib/components/ui/Breadcrumb.svelte";
    import FileForm from "#lib/components/files/FileForm.svelte";
    import { createFile } from "./create.remote";
    import { createFileSchema } from "@ac/validations";
    import { goto } from "$app/navigation";
    import { Folder } from "@lucide/svelte";
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl space-y-6">
    <Breadcrumb feature="files" current="New File" />

    <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <Folder size={28} class="text-blue-600" />
            New File or Cloud Link
        </h1>
        <p class="text-sm text-gray-500 mt-1">
            Create an Office document directly in SharePoint/Teams, upload a local file, or link a SharePoint/OneDrive resource.
        </p>
    </div>

    <FileForm
        remoteFunction={createFile}
        validationSchema={createFileSchema}
        onSuccess={() => goto("/files")}
        onCancel={() => goto("/files")}
    />
</div>
