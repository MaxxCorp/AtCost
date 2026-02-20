<script lang="ts">
    import AsyncButton from "$lib/components/ui/AsyncButton.svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "@ac/ui";
    import ResourceManager from "../resources/ResourceManager.svelte";

    let {
        remoteFunction,
        validationSchema,
        isUpdating = false,
        initialData = null,
        onSuccess,
        onCancel,
    }: {
        remoteFunction: any;
        validationSchema: any;
        isUpdating?: boolean;
        initialData?: any;
        onSuccess?: (result: any) => void;
        onCancel?: () => void;
    } = $props();

    // Helper to get nested field props
    function getField(name: string) {
        if (!remoteFunction?.fields) return {};
        const parts = name.split(".");
        let current = remoteFunction.fields;
        for (const part of parts) {
            if (!current) return {};
            current = current[part];
        }
        return current || {};
    }

    // State bindings
    // We bind directly to properties.
    // Initial values come from initialData.
    let name = $state(initialData?.name || "");
    let type = $state(initialData?.type || "Other");
    let street = $state(initialData?.street || "");
    let houseNumber = $state(initialData?.houseNumber || "");
    let addressSuffix = $state(initialData?.addressSuffix || "");
    let zip = $state(initialData?.zip || "");
    let city = $state(initialData?.city || "");
    let locationState = $state(initialData?.state || "");
    let country = $state(initialData?.country || "");
    let roomId = $state(initialData?.roomId || "");
    let latitude = $state(initialData?.latitude || "");
    let longitude = $state(initialData?.longitude || "");
    let what3words = $state(initialData?.what3words || "");
    let inclusivitySupport = $state(initialData?.inclusivitySupport || "");
</script>

<form
    class="space-y-4"
    {...remoteFunction
        ?.preflight?.(validationSchema)
        .enhance(async (input: any) => {
            console.log("--- LocationForm submission started ---");
            const { submit } = input;
            try {
                const result = await submit();
                console.log("--- LocationForm Result ---", result);

                if (
                    result?.success === false ||
                    result?.error ||
                    result?.type === "failure"
                ) {
                    const msg =
                        result?.error?.message ||
                        result?.data?.message ||
                        "Validation failed";
                    toast.error(msg);
                    return;
                }

                if (!result) {
                    toast.error("Error: Server returned empty response");
                    return;
                }

                toast.success(
                    isUpdating ? "Changes saved!" : "Location created!",
                );
                if (onSuccess) onSuccess(result);
                else if (onCancel) onCancel(); // If no success handler, maybe just close?
            } catch (error: any) {
                console.error("Error during form submission:", error);
                toast.error("An unexpected error occurred.");
            }
        })}
>
    {#if isUpdating && initialData?.id}
        <input type="hidden" name="id" value={initialData.id} />
    {/if}

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Name</span>
        <input
            {...getField("name").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
            placeholder="Enter location name"
            bind:value={name}
        />
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Type</span>
        <select
            {...getField("type").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            bind:value={type}
        >
            <option value="Work">Work</option>
            <option value="Home">Home</option>
            <option value="Other">Other</option>
        </select>
    </label>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Street</span>
        <input
            {...getField("street").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Street name"
            bind:value={street}
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
                bind:value={houseNumber}
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
                bind:value={addressSuffix}
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
                bind:value={zip}
            />
        </label>
        <label class="block col-span-2">
            <span class="text-sm font-medium text-gray-700 mb-2">City</span>
            <input
                {...getField("city").as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="City name"
                bind:value={city}
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
                bind:value={locationState}
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700 mb-2">Country</span>
            <input
                {...getField("country").as("text")}
                class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Country"
                bind:value={country}
            />
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">Room ID</span>
        <input
            {...getField("roomId").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter room ID (e.g. 101)"
            bind:value={roomId}
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
                bind:value={latitude}
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
                bind:value={longitude}
            />
        </label>
    </div>

    <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-2">what3words</span>
        <input
            {...getField("what3words").as("text")}
            class="mt-2 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. filled.count.soap"
            bind:value={what3words}
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
            bind:value={inclusivitySupport}
        ></textarea>
    </label>

    {#if isUpdating && initialData?.id}
        <!-- Nested ContactManager (now we should probably use ResourceManager if possible, or keep legacy?) 
             The original LocationForm used ContactManager. 
             If we have ResourceManager, we should use it. 
             But ContactManager inside LocationForm implies inverse relationship management.
             Let's use ResourceManager for 'contacts' of this location. 
             
             HOWEVER, I did not import all contact remote functions.
             For now, let's omit or use ResourceManager if imports are available.
        -->
        <!-- Previously: <ContactManager type="location" entityId={initialData.id} /> 
             But ContactManager is being refactored/replaced. 
             Let's use ResourceManager for contacts.
        -->
        <!-- For now, I'll comment out until we verify imports found in ContactForm can be used here or imported.
             Wait, LocationForm.svelte is for Locations.
             We need to import contact management functions. 
        -->
        <div class="border-t pt-4">
            <h4 class="font-medium mb-4">Associated Contacts</h4>
            <p class="text-sm text-gray-500 italic">
                Contact associations via Location form are temporarily disabled
                during refactor. Please use the Contacts view.
            </p>
        </div>
    {/if}

    <div class="flex gap-3 mt-6">
        <AsyncButton
            type="submit"
            loadingLabel={isUpdating ? "Saving..." : "Creating..."}
            loading={remoteFunction.pending}
        >
            {isUpdating ? "Save Changes" : "Create Location"}
        </AsyncButton>
        <Button
            variant="secondary"
            onclick={onCancel}
            type="button"
            size="default"
        >
            Cancel
        </Button>
    </div>
</form>
