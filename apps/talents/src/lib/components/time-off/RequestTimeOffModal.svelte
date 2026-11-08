<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { requestTimeOff } from "../../../routes/time-off/time-off.remote";
    import { timeOffRequestSchema } from "@ac/validations";
    import TalentAbsenceContext from "./TalentAbsenceContext.svelte";
    import * as Dialog from "@ac/ui/components/dialog";
    import { Button, AsyncButton, useFormValidationFeedback } from "@ac/ui";
    import { Plane } from "@lucide/svelte";
    import { getMyTalentProfile } from "../../../routes/talents/talents.remote";
    import { authClient } from "#lib/auth.js";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";

    interface Props {
        open?: boolean;
        talentId?: string;
        onClose?: () => void;
        onSuccess?: () => void;
    }

    let {
        open = $bindable(false),
        talentId,
        onClose,
        onSuccess
    }: Props = $props();

    let userId = $state<string | null>(null);

    onMount(async () => {
        const session = await authClient.getSession();
        userId = session?.data?.user?.id || null;
    });

    const myProfileQuery = $derived(getMyTalentProfile());
    const myProfile = $derived(myProfileQuery.current);

    const resolvedTalentId = $derived(talentId || myProfile?.id || userId || "");

    const timeOffForm = requestTimeOff.preflight(timeOffRequestSchema);
    const feedback = useFormValidationFeedback(() => timeOffForm, {
        message: () => m.please_fix_validation?.() ?? "Please fix validation errors",
    });

    let formStartDate = $state("");
    let formEndDate = $state("");
    let formType = $state("vacation");
    let formReason = $state("");

    function handleDialogClose() {
        open = false;
        formStartDate = "";
        formEndDate = "";
        formType = "vacation";
        formReason = "";
        onClose?.();
    }
</script>

<Dialog.Root
    bind:open
    onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
            handleDialogClose();
        }
    }}
>
    <Dialog.Content class="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <Dialog.Header>
            <div class="flex items-center gap-3">
                <div class="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl shrink-0">
                    <Plane class="w-5 h-5" />
                </div>
                <div>
                    <Dialog.Title class="text-xl font-bold text-gray-900">
                        {m.new_leave_request ? m.new_leave_request() : "New Leave Request"}
                    </Dialog.Title>
                    <Dialog.Description class="text-xs text-gray-500 mt-0.5">
                        {m.time_off_subtitle ? m.time_off_subtitle() : "Request vacation or time off and review calendar impact."}
                    </Dialog.Description>
                </div>
            </div>
        </Dialog.Header>

        <form
            {...timeOffForm.enhance(async ({ submit }) => {
                const res = await submit();
                if (res) {
                    toast.success(m.request_submitted ? m.request_submitted() : "Request submitted");
                    open = false;
                    formStartDate = "";
                    formEndDate = "";
                    formType = "vacation";
                    formReason = "";
                    onSuccess?.();
                    onClose?.();
                }
            })}
            class="space-y-4 pt-2"
        >
            {#if resolvedTalentId}
                <input {...timeOffForm.fields.talentId.as("hidden", resolvedTalentId)} />
            {/if}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label for="modal-timeoff-type" class="text-xs font-bold uppercase tracking-wider text-gray-600">
                        {m.request_type ? m.request_type() : "Request Type"}
                    </label>
                    <select
                        id="modal-timeoff-type"
                        {...timeOffForm.fields.type.as("select", "vacation")}
                        value={formType}
                        onchange={(e) => (formType = (e.currentTarget as HTMLSelectElement).value)}
                        class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    >
                        <option value="vacation">{m.leave_vacation ? m.leave_vacation() : "Vacation"}</option>
                        <option value="sick">{m.leave_sick ? m.leave_sick() : "Sick Leave"}</option>
                        <option value="other">{m.leave_other ? m.leave_other() : "Other"}</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label for="modal-timeoff-start" class="text-xs font-bold uppercase tracking-wider text-gray-600">
                        {m.start_date ? m.start_date() : "Start Date"}
                    </label>
                    <input
                        id="modal-timeoff-start"
                        {...timeOffForm.fields.startDate.as("date")}
                        value={formStartDate}
                        oninput={(e) => (formStartDate = (e.currentTarget as HTMLInputElement).value)}
                        class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    />
                </div>
                <div class="space-y-1.5">
                    <label for="modal-timeoff-end" class="text-xs font-bold uppercase tracking-wider text-gray-600">
                        {m.end_date ? m.end_date() : "End Date"}
                    </label>
                    <input
                        id="modal-timeoff-end"
                        {...timeOffForm.fields.endDate.as("date")}
                        value={formEndDate}
                        oninput={(e) => (formEndDate = (e.currentTarget as HTMLInputElement).value)}
                        class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    />
                </div>
            </div>

            <div class="space-y-1.5">
                <label for="modal-timeoff-reason" class="text-xs font-bold uppercase tracking-wider text-gray-600">
                    {m.reason_notes ? m.reason_notes() : "Reason / Notes"}
                </label>
                <textarea
                    id="modal-timeoff-reason"
                    {...timeOffForm.fields.reason.as("text")}
                    bind:value={formReason}
                    rows="2"
                    class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none"
                    placeholder={m.reason_placeholder ? m.reason_placeholder() : "Briefly describe the reason for your request..."}
                ></textarea>
            </div>

            {#if resolvedTalentId}
                <div class="mt-4 pt-4 border-t border-gray-100">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 flex items-center gap-1.5">
                        <span>{m.situational_awareness ? m.situational_awareness() : "Leave Impact & Holiday Overview"}</span>
                    </h4>
                    <TalentAbsenceContext
                        talentId={resolvedTalentId}
                        selectedStartDate={formStartDate}
                        selectedEndDate={formEndDate}
                        selectedType={formType}
                        compact={true}
                    />
                </div>
            {/if}

            <Dialog.Footer class="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onclick={handleDialogClose}
                >
                    {m.cancel ? m.cancel() : "Cancel"}
                </Button>
                <AsyncButton
                    type="submit"
                    loading={timeOffForm.pending}
                    class="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                    {m.submit_request ? m.submit_request() : "Submit Request"}
                </AsyncButton>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
