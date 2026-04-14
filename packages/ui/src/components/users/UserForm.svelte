<script lang="ts">
    import { untrack } from "svelte";
    import AsyncButton from "../AsyncButton.svelte";

    import { toast } from "svelte-sonner";
    import { Button } from "../button";
    import type { Snippet } from "svelte";

    export type FeatureMeta = {
        key: string;
        title: () => string;
        [key: string]: any;
    };

    export type AppConfig = {
        namespace: string;
        name: string;
        features: FeatureMeta[];
    };

    export interface Props {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        m: any;
        appConfigList: AppConfig[];
        onSuccess: () => void;
        onCancel: () => void;
        extraEntities?: Snippet<[any]>;
        canEditRoles?: boolean;
    }

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        m,
        appConfigList,
        onSuccess,
        onCancel,
        extraEntities,
        canEditRoles = false,
    }: Props = $props();

    // Initialize remoteFunction if it's a definition function to ensure reactive context
    const rf = $derived(typeof remoteFunction === "function" ? remoteFunction() : remoteFunction);

    let prevIssuesLength = $state(0);
    $effect(() => {
        const issues = (rf as any).allIssues?.() ?? [];
        const currentIssuesLength = issues.length;
        if (currentIssuesLength > 0 && currentIssuesLength !== prevIssuesLength) {
            toast.error(m.please_fix_validation());
        }
        prevIssuesLength = currentIssuesLength;
    });

    // svelte-ignore state_referenced_locally
    const initialRoles =
        initialData?.roles && Array.isArray(initialData.roles)
            ? initialData.roles
            : [];

    // svelte-ignore state_referenced_locally
    const initialIsAdmin = initialRoles.includes("admin");

    // svelte-ignore state_referenced_locally
    const initialClaims =
        initialData?.claims && typeof initialData.claims === "object"
            ? (initialData.claims as Record<string, unknown>)
            : {};

    // svelte-ignore state_referenced_locally
    const initialClaimsMap: Record<string, any> = {};

    // svelte-ignore state_referenced_locally
    appConfigList.forEach((app) => {
        app.features.forEach((f) => {
            const claimKey = `${app.namespace}.${f.key}`;
            if (initialClaims[claimKey] !== undefined) {
                initialClaimsMap[claimKey] = initialClaims[claimKey];
            } else if (initialClaims[f.key] !== undefined && app.namespace === "multiposter") {
                initialClaimsMap[claimKey] = initialClaims[f.key];
            }
        });
    });

    let isAdmin = $state(initialIsAdmin);
    let claimsMap = $state(initialClaimsMap);

    let claimsJson = $derived.by(() => {
        const c: Record<string, any> = {};
        for (const [k, v] of Object.entries(claimsMap)) {
            if (v) c[k] = v;
        }
        return JSON.stringify(c);
    });
</script>

<form
    class="space-y-4"
    {...rf.preflight(validationSchema).enhance(async ({ submit }: any) => {
            const handle = rf;
            try {
                await submit();
                
                // Native Svelte 5 / Remote Function semantics: 
                // We check the handle's error state and result state directly.
                // Use untrack to prevent 'derived_inert' if rf was re-derived during await.
                const result = untrack(() => handle.result);
                const error = untrack(() => handle.error);


                if (!error && result) {
                    toast.success(m.successfully_saved());
                    onSuccess();
                } else if (error) {
                    toast.error(error.message || m.something_went_wrong());
                }
            } catch (error: unknown) {
                const err = error as { message?: string };
                toast.error(err?.message || m.something_went_wrong());
            }
        })}
>
    {#if isUpdating && initialData}
        <input {...rf.fields.id.as("hidden", initialData.id)} />
    {/if}

    <input {...rf.fields.claims.as("hidden", claimsJson)} />

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.summary()}</span>
        <input
            {...rf.fields.name.as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.name.issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            value={initialData?.name ?? ""}
            onblur={() => rf.validate()}
        />
        {#each rf.fields.name.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">{m.email_address()}</span>
        <input
            {...rf.fields.email.as("email")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(rf.fields.email.issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            value={initialData?.email ?? ""}
            onblur={() => rf.validate()}
        />
        {#each rf.fields.email.issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    {#if canEditRoles}
        <div class="border-t pt-4 mt-4">
            <h3 class="text-lg font-medium text-gray-900 mb-2">{m.roles()}</h3>
            <label class="flex items-center space-x-2">
                <input
                    {...rf.fields.roles.as("checkbox", "admin")}
                    checked={isAdmin}
                    onchange={(e) => (isAdmin = e.currentTarget.checked)}
                    class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span class="text-sm text-gray-700">{m.admin()}</span>
            </label>
        </div>
    {/if}

    {#if canEditRoles}
        {#each appConfigList as app}
            <div class="border-t pt-4 mt-4">
                <h3 class="text-lg font-medium text-gray-900 mb-2">
                    {m.claims_access()} - {app.name}
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {#each app.features as feature}
                        {@const claimKey = `${app.namespace}.${feature.key}`}
                        <div class="space-y-2">
                            <span class="text-sm font-medium text-gray-900">
                                {typeof feature.title === 'function' ? feature.title() : feature.title}
                            </span>
                            {#if feature.key === 'synchronizations'}
                                <select
                                    value={claimsMap[claimKey] === true ? 'admin' : (claimsMap[claimKey] || 'none')}
                                    onchange={(e) => {
                                        const val = e.currentTarget.value;
                                        if (val === 'none') {
                                            const next = { ...claimsMap };
                                            delete next[claimKey];
                                            claimsMap = next;
                                        } else {
                                            claimsMap[claimKey] = val;
                                        }
                                    }}
                                    class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="none">{m.none_access()}</option>
                                    <option value="use">{m.use_only_access()}</option>
                                    <option value="admin">{m.administrator_access()}</option>
                                </select>
                            {:else}
                                <label class="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 border border-transparent cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!claimsMap[claimKey]}
                                        onchange={(e) => {
                                            claimsMap[claimKey] = e.currentTarget.checked;
                                        }}
                                        class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                    />
                                    <span class="text-sm text-gray-700">{m.enabled()}</span>
                                </label>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    {/if}

    {#if isUpdating && initialData?.id && extraEntities}
        {@render extraEntities(initialData)}
    {/if}

    <div class="flex gap-3 mt-6">
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? m.loading() : m.creating()}
            loading={rf.pending}
        >
            {isUpdating ? m.save_changes() : m.create_user()}
        </AsyncButton>
        <Button variant="secondary" onclick={onCancel} size="default">{m.cancel()}</Button>
    </div>
</form>
