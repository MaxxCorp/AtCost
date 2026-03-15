<script lang="ts">
    import * as Dialog from "../dialog";
    import { Button } from "../button";
    import AsyncButton from "../AsyncButton.svelte";
    import { Calendar, User, MessageSquare, Briefcase, GraduationCap, XCircle } from "@lucide/svelte";

    interface Props {
        open: boolean;
        talentId: string;
        employees: { id: string, displayName: string }[];
        onSave: (entry: any) => Promise<void>;
    }

    let { open = $bindable(), talentId, employees, onSave }: Props = $props();

    let type = $state<"Interview" | "Hiring" | "Evaluation" | "Termination">("Interview");
    let date = $state(new Date().toISOString().split("T")[0]);
    let comment = $state("");
    let description = $state("");
    let hasNextStep = $state(false);
    let nextStep = $state({
        name: "",
        date: "",
        responsibleEmployeeId: ""
    });

    let loading = $state(false);

    async function handleSave() {
        loading = true;
        try {
            await onSave({
                type,
                date,
                comment,
                description,
                nextStep: hasNextStep ? nextStep : undefined
            });
            open = false;
            reset();
        } finally {
            loading = false;
        }
    }

    function reset() {
        type = "Interview";
        date = new Date().toISOString().split("T")[0];
        comment = "";
        description = "";
        hasNextStep = false;
        nextStep = { name: "", date: "", responsibleEmployeeId: "" };
    }

    const typeMeta = {
        Interview: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50" },
        Hiring: { icon: Briefcase, color: "text-green-500", bg: "bg-green-50" },
        Evaluation: { icon: GraduationCap, color: "text-purple-500", bg: "bg-purple-50" },
        Termination: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" }
    };
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title>Add Timeline Entry</Dialog.Title>
            <Dialog.Description>
                Record a new milestone or event for this talent.
            </Dialog.Description>
        </Dialog.Header>

        <div class="grid gap-6 py-4">
            <!-- Type Selector -->
            <div class="grid grid-cols-2 gap-2">
                {#each Object.entries(typeMeta) as [t, meta]}
                    <button
                        type="button"
                        onclick={() => type = t as any}
                        class="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all {type === t ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200 bg-white'}"
                    >
                        <meta.icon size={24} class={meta.color} />
                        <span class="text-xs font-bold uppercase tracking-wider">{t}</span>
                    </button>
                {/each}
            </div>

            <div class="grid gap-4">
                <div class="grid gap-2">
                    <label for="date" class="text-sm font-medium leading-none">Date of Event</label>
                    <div class="relative">
                        <Calendar size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="date"
                            id="date"
                            bind:value={date}
                            class="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                <div class="grid gap-2">
                    <label for="description" class="text-sm font-medium leading-none">Brief Description</label>
                    <input
                        id="description"
                        placeholder="e.g. Initial technical interview"
                        bind:value={description}
                        class="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div class="grid gap-2">
                    <label for="comment" class="text-sm font-medium leading-none">Detailed Comment</label>
                    <textarea
                        id="comment"
                        placeholder="Add notes about candidate performance, feedback, etc."
                        bind:value={comment}
                        rows="3"
                        class="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    ></textarea>
                </div>

                <!-- Next Step Toggle -->
                <div class="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <input
                        type="checkbox"
                        id="hasNextStep"
                        bind:checked={hasNextStep}
                        class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label for="hasNextStep" class="text-sm font-medium leading-none cursor-pointer">
                        Schedule next step?
                    </label>
                </div>

                {#if hasNextStep}
                    <div class="grid gap-4 p-4 rounded-lg border border-indigo-100 bg-indigo-50/30 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div class="grid gap-2">
                            <label for="nextName" class="text-xs font-bold text-indigo-900 uppercase">Next Step Name</label>
                            <input
                                id="nextName"
                                placeholder="e.g. Second Interview"
                                bind:value={nextStep.name}
                                class="flex h-9 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="grid gap-2">
                                <label for="nextDate" class="text-xs font-bold text-indigo-900 uppercase">Target Date</label>
                                <input
                                    type="date"
                                    id="nextDate"
                                    bind:value={nextStep.date}
                                    class="flex h-9 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div class="grid gap-2">
                                <label for="nextResp" class="text-xs font-bold text-indigo-900 uppercase">Responsible</label>
                                <select
                                    id="nextResp"
                                    bind:value={nextStep.responsibleEmployeeId}
                                    class="flex h-9 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="" disabled>Select...</option>
                                    {#each employees as emp}
                                        <option value={emp.id}>{emp.displayName}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={() => open = false}>Cancel</Button>
            <AsyncButton {loading} onclick={handleSave}>Save Entry</AsyncButton>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
