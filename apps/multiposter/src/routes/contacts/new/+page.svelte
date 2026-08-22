<script lang="ts">
    import { goto } from "$app/navigation";
    import { createContact } from "./create.remote";
    import ContactForm from "$lib/components/contacts/ContactForm.svelte";
    import ScanNamecardButton from "$lib/components/contacts/ScanNamecardButton.svelte";
    import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";

    import { createContactSchema } from "$lib/validations/contacts";
    import { LocationManager, handleDelete } from "@ac/ui";
    import { MapPin } from "@lucide/svelte";
    import * as m from "$lib/paraglide/messages";
    import { listLocations } from "../../locations/list.remote";
    import { createLocation } from "../../locations/new/create.remote";
    import { updateLocation } from "../../locations/[id]/update.remote";
    import { deleteLocation } from "../../locations/[id]/delete.remote";
    import {
        createLocationSchema,
        updateLocationSchema,
    } from "@ac/validations";
    import {
        addLocationAssociation,
        removeLocationAssociation,
        fetchEntityLocations,
    } from "../../locations/associate.remote";


    function handleSuccess(result: any) {
        const finalId = result?.id || result?.contact?.id;
        if (finalId) {
            goto(`/contacts/${finalId}`);
        } else {
            goto("/contacts");
        }
    }

    const formId = crypto.randomUUID();
    const rf = createContact.for(formId);
    
    let formComponent: ReturnType<typeof ContactForm> | undefined = $state();
</script>

<div class="max-w-3xl mx-auto px-4 py-8 text-left">
    <Breadcrumb feature="contacts" current={m.new_contact()} />

    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">{m.create_new_contact()}</h1>
        <ScanNamecardButton onScanned={(data) => formComponent?.fillData(data)} />
    </div>

    <div class="bg-white shadow rounded-lg p-6">
            <ContactForm
                bind:this={formComponent}
                remoteFunction={rf}
                schema={createContactSchema}
                onSuccess={handleSuccess}
            >
                        {#snippet children({ onLocationsChange })}
                            <div class="mt-8 border-t pt-8">
                                <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
                                    <MapPin size={18} class="text-blue-600" />
                                    {m.feature_locations_title()}
                                </h3>
                                <LocationManager {m}
                                    entityId={""}
                                    initialItems={[]}
                                    onchange={onLocationsChange}
                                    listItemsRemote={listLocations}
                                    fetchAssociationsRemote={fetchEntityLocations as any}
                                    addAssociationRemote={async (p: any) =>
                                        addLocationAssociation({
                                            ...p,
                                            locationId: p.itemId,
                                        } as any)}
                                    removeAssociationRemote={async (p: any) =>
                                        removeLocationAssociation({
                                            ...p,
                                            locationId: p.itemId,
                                        } as any)}
                                    deleteItemRemote={async (ids: any) => {
                                        return await handleDelete({
                                            ids: Array.isArray(ids)
                                                ? ids
                                                : [ids],
                                            deleteFn: deleteLocation,
                                            itemName: m
                                                .location()
                                                .toLowerCase(),
                                        });
                                    }}
                                    createRemote={createLocation}
                                    createSchema={createLocationSchema}
                                    updateRemote={updateLocation}
                                    updateSchema={updateLocationSchema}
                                />
                    </div>
                {/snippet}
            </ContactForm>
        </div>
</div>
