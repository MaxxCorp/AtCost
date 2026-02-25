<script lang="ts">
    import AsyncButton from "../AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "../button";
    import { goto } from "$app/navigation";
    import type { Snippet } from "svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess = undefined,
        onCancel = undefined,
        cancelHref = "/locations",
        // Extra slots for flexibility (e.g. EntityManager for associations)
        children,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
        cancelHref?: string;
        children?: Snippet;
    } = $props();

    function getField(name: string) {
        if (!(remoteFunction as any).fields) return {};
        const parts = name.split(".");
        let current = (remoteFunction as any).fields;
        for (const part of parts) {
            if (!current) return {};
            current = current[part];
        }
        return current || {};
    }
</script>

<form
    class="space-y-4"
    {...remoteFunction
        .preflight(validationSchema)
        .enhance(async ({ submit }: any) => {
            try {
                await submit();
                const result = (remoteFunction as any).result;
                if (result?.error) {
                    toast.error(
                        result.error.message || "Oh no! Something went wrong",
                    );
                    return;
                }
                toast.success("Successfully Saved!");
                if (onSuccess) onSuccess(result);
                else await goto(cancelHref);
            } catch (error: unknown) {
                const err = error as { message?: string };
                toast.error(err?.message || "Oh no! Something went wrong");
            }
        })}
>
    {#if isUpdating && initialData}
        <input {...getField("id").as("hidden", initialData.id)} />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Name</span>
        <input
            {...getField("name").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {(getField(
                'name',
            ).issues()?.length ?? 0) > 0
                ? 'border-red-500'
                : 'border-gray-300'}"
            placeholder="Enter location name"
            onblur={() => remoteFunction.validate()}
            value={initialData?.name ?? ""}
        />
        {#each getField("name").issues() ?? [] as issue}
            <p class="mt-1 text-sm text-red-600">{issue.message}</p>
        {/each}
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Street</span>
        <input
            {...getField("street").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Street name"
            value={initialData?.street ?? ""}
        />
    </label>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >House Number</span
            >
            <input
                {...getField("houseNumber").as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 10A"
                value={initialData?.houseNumber ?? ""}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >Address Suffix</span
            >
            <input
                {...getField("addressSuffix").as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Backyard, 2nd floor"
                value={initialData?.addressSuffix ?? ""}
            />
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">ZIP Code</span>
            <input
                {...getField("zip").as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Postal code"
                value={initialData?.zip ?? ""}
            />
        </label>
        <label class="block col-span-2">
            <span class="text-sm font-medium text-gray-700 mb-2">City</span>
            <input
                {...getField("city").as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="City name"
                value={initialData?.city ?? ""}
            />
        </label>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2"
                >State/Region</span
            >
            <input
                {...getField("state").as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="State"
                value={initialData?.state ?? ""}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Country</span>
            <input
                {...getField("country").as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Country"
                value={initialData?.country ?? ""}
            />
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Room ID</span>
        <input
            {...getField("roomId").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter room ID (e.g. 101)"
            value={initialData?.roomId ?? ""}
        />
    </label>

    <div class="grid grid-cols-2 gap-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Latitude</span>
            <input
                {...getField("latitude").as("text")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Latitude"
                value={initialData?.latitude ?? ""}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Longitude</span
            >
            <input
                {...getField("longitude").as("text")}
                type="number"
                step="any"
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Longitude"
                value={initialData?.longitude ?? ""}
            />
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">what3words</span>
        <input
            {...getField("what3words").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. filled.count.soap"
            value={initialData?.what3words ?? ""}
        />
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2"
            >Inclusivity Support</span
        >
        <textarea
            {...getField("inclusivitySupport").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Accessibility and inclusivity information"
            rows="3"
            value={initialData?.inclusivitySupport ?? ""}
        ></textarea>
    </label>

    {#if children}
        {@render children()}
    {/if}

    <div class="flex justify-end gap-3 mt-6">
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? "Saving..." : "Creating..."}
            loading={remoteFunction.pending}
        >
            {isUpdating ? "Save Changes" : "Create Location"}
        </AsyncButton>
        {#if onCancel}
            <Button
                variant="secondary"
                type="button"
                size="default"
                onclick={onCancel}
            >
                Cancel
            </Button>
        {:else}
            <Button variant="secondary" href={cancelHref} size="default">
                Cancel
            </Button>
        {/if}
    </div>
</form>
