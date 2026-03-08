<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { RRule, Frequency } from "$lib/utils/rrule-compat";
    import { createEventDispatcher } from "svelte";

    let { open = $bindable(false), value = $bindable<string | null>(null) } =
        $props();

    const dispatch = createEventDispatcher();

    // Internal state
    let freq = $state(RRule.WEEKLY);
    let interval = $state(1);
    let endType = $state("never"); // never, count, until
    let count = $state(10);
    let untilDate = $state<string>("");

    // Advanced fields
    let byweekday = $state<number[]>([]); // Mon=0, Sun=6
    let monthlyType = $state("day"); // day, relative
    let bymonthday = $state(1);
    let bysetpos = $state(1); // 1st, 2nd, 3rd, 4th, last (-1)
    let relativeDay = $state(0); // 0=Mon, 6=Sun, 7=Day, 8=Weekday, 9=Weekend Day
    let yearlyType = $state("day"); // day, relative
    let bymonth = $state(1); // 1-12

    // Weekdays for checkboxes
    const weekdays = [
        { label: "Mon", value: RRule.MO.weekday },
        { label: "Tue", value: RRule.TU.weekday },
        { label: "Wed", value: RRule.WE.weekday },
        { label: "Thu", value: RRule.TH.weekday },
        { label: "Fri", value: RRule.FR.weekday },
        { label: "Sat", value: RRule.SA.weekday },
        { label: "Sun", value: RRule.SU.weekday },
    ];

    const positions = [
        { label: "First", value: 1 },
        { label: "Second", value: 2 },
        { label: "Third", value: 3 },
        { label: "Fourth", value: 4 },
        { label: "Last", value: -1 },
    ];

    const relativeDays = [
        { label: "Monday", value: 0 },
        { label: "Tuesday", value: 1 },
        { label: "Wednesday", value: 2 },
        { label: "Thursday", value: 3 },
        { label: "Friday", value: 4 },
        { label: "Saturday", value: 5 },
        { label: "Sunday", value: 6 },
        { label: "Day", value: 7 },
        { label: "Weekday", value: 8 },
        { label: "Weekend day", value: 9 },
    ];

    const months = [
        { label: "January", value: 1 },
        { label: "February", value: 2 },
        { label: "March", value: 3 },
        { label: "April", value: 4 },
        { label: "May", value: 5 },
        { label: "June", value: 6 },
        { label: "July", value: 7 },
        { label: "August", value: 8 },
        { label: "September", value: 9 },
        { label: "October", value: 10 },
        { label: "November", value: 11 },
        { label: "December", value: 12 },
    ];

    // Initialize state from existing value if present
    $effect(() => {
        if (open && value) {
            try {
                const rule = RRule.fromString(value);
                freq = rule.options.freq;
                interval = rule.options.interval;

                // End type
                if (rule.options.count) {
                    endType = "count";
                    count = rule.options.count;
                } else if (rule.options.until) {
                    endType = "until";
                    untilDate = rule.options.until.toISOString().split("T")[0];
                } else {
                    endType = "never";
                }

                // Advanced fields
                if (rule.options.byweekday) {
                    const days = Array.isArray(rule.options.byweekday)
                        ? rule.options.byweekday
                        : [rule.options.byweekday];
                    byweekday = days.map((d: any) =>
                        typeof d === "number" ? d : d.weekday
                    );
                } else {
                    byweekday = [];
                }

                if (rule.options.bymonthday) {
                    bymonthday = Array.isArray(rule.options.bymonthday)
                        ? rule.options.bymonthday[0]
                        : rule.options.bymonthday;
                    monthlyType = "day";
                    yearlyType = "day";
                }

                if (rule.options.bysetpos) {
                    bysetpos = Array.isArray(rule.options.bysetpos)
                        ? rule.options.bysetpos[0]
                        : rule.options.bysetpos;
                    monthlyType = "relative";
                    yearlyType = "relative";
                }

                if (rule.options.bymonth) {
                    bymonth = Array.isArray(rule.options.bymonth)
                        ? rule.options.bymonth[0]
                        : rule.options.bymonth;
                }

                // Map RRule BYDAY back to relative day
                if (rule.options.byweekday && (rule.options.bysetpos || freq === RRule.MONTHLY || freq === RRule.YEARLY)) {
                    const days = Array.isArray(rule.options.byweekday) ? rule.options.byweekday : [rule.options.byweekday];
                    const weekdayInstances = days.map((d: any) => typeof d === 'number' ? d : d.weekday);
                    
                    if (weekdayInstances.length === 1) {
                        relativeDay = weekdayInstances[0];
                    } else if (weekdayInstances.length === 7) {
                        relativeDay = 7; // Day
                    } else if (weekdayInstances.length === 5 && !weekdayInstances.includes(RRule.SA.weekday) && !weekdayInstances.includes(RRule.SU.weekday)) {
                        relativeDay = 8; // Weekday
                    } else if (weekdayInstances.length === 2 && weekdayInstances.includes(RRule.SA.weekday) && weekdayInstances.includes(RRule.SU.weekday)) {
                        relativeDay = 9; // Weekend day
                    }
                }

            } catch (e) {
                console.error("Failed to parse recurrence rule", e);
            }
        } else if (open && !value) {
            // Reset to defaults
            freq = RRule.WEEKLY;
            interval = 1;
            endType = "never";
            count = 10;
            untilDate = "";
            byweekday = [];
            monthlyType = "day";
            bymonthday = 1;
            bysetpos = 1;
            relativeDay = 0;
            yearlyType = "day";
            bymonth = 1;
        }
    });

    function save() {
        const options: any = {
            freq,
            interval,
        };

        if (endType === "count") {
            options.count = Number(count);
        } else if (endType === "until" && untilDate) {
            options.until = new Date(untilDate);
        }

        // Apply advanced fields
        if (freq === RRule.WEEKLY && byweekday.length > 0) {
            options.byweekday = byweekday;
        }

        if (freq === RRule.MONTHLY) {
            if (monthlyType === "day") {
                options.bymonthday = bymonthday;
            } else {
                options.bysetpos = bysetpos;
                options.byweekday = getRRuleWeekdays(relativeDay);
            }
        }

        if (freq === RRule.YEARLY) {
            options.bymonth = bymonth;
            if (yearlyType === "day") {
                options.bymonthday = bymonthday;
            } else {
                options.bysetpos = bysetpos;
                options.byweekday = getRRuleWeekdays(relativeDay);
            }
        }

        try {
            const rule = new RRule(options);
            value = rule.toString();
            open = false;
            dispatch("change", value);
        } catch (e) {
            console.error("Invalid RRule options", e);
        }
    }

    function getRRuleWeekdays(type: number): any[] {
        switch (type) {
            case 7: return [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];
            case 8: return [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
            case 9: return [RRule.SA, RRule.SU];
            default: return [type];
        }
    }

    function clear() {
        value = null;
        open = false;
        dispatch("change", null);
    }

    const frequencies = [
        { label: "Daily", value: RRule.DAILY },
        { label: "Weekly", value: RRule.WEEKLY },
        { label: "Monthly", value: RRule.MONTHLY },
        { label: "Yearly", value: RRule.YEARLY },
    ];

    function toggleWeekday(day: number) {
        if (byweekday.includes(day)) {
            byweekday = byweekday.filter(d => d !== day);
        } else {
            byweekday = [...byweekday, day];
        }
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title>Recurrence Settings</Dialog.Title>
            <Dialog.Description>
                Set the recurrence rules for this event.
            </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-6 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
                <label
                    for="freq"
                    class="text-right text-sm font-medium leading-none"
                    >Repeat</label
                >
                <div class="col-span-3">
                    <select
                        id="freq"
                        bind:value={freq}
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        {#each frequencies as f}
                            <option value={f.value}>{f.label}</option>
                        {/each}
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-4 items-center gap-4">
                <label
                    for="interval"
                    class="text-right text-sm font-medium leading-none"
                    >Every</label
                >
                <div class="col-span-3 flex items-center gap-2">
                    <input
                        id="interval"
                        type="number"
                        min="1"
                        bind:value={interval}
                        class="flex h-10 w-20 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <span class="text-sm text-gray-500">
                        {freq === RRule.DAILY
                            ? "days"
                            : freq === RRule.WEEKLY
                              ? "weeks"
                              : freq === RRule.MONTHLY
                                ? "months"
                                : "years"}
                    </span>
                </div>
            </div>

            {#if freq === RRule.WEEKLY}
                <div class="grid grid-cols-4 items-start gap-4">
                    <span class="text-right text-sm font-medium leading-none mt-2">On</span>
                    <div class="col-span-3 flex flex-wrap gap-2">
                        {#each weekdays as day}
                            <button
                                type="button"
                                class="h-8 w-10 text-xs rounded-md border transition-colors {byweekday.includes(day.value) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-input'}"
                                onclick={() => toggleWeekday(day.value)}
                            >
                                {day.label}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if freq === RRule.MONTHLY}
                <div class="grid grid-cols-4 items-start gap-4">
                    <span class="text-right text-sm font-medium leading-none mt-2">Mode</span>
                    <div class="col-span-3 space-y-4">
                        <div class="flex items-center gap-3">
                            <input type="radio" id="monthly-day" value="day" bind:group={monthlyType} class="h-4 w-4" />
                            <label for="monthly-day" class="text-sm">Day</label>
                            <input 
                                type="number" 
                                min="1" max="31" 
                                bind:value={bymonthday} 
                                disabled={monthlyType !== 'day'}
                                class="h-8 w-14 rounded-md border text-sm px-2" 
                            />
                            <span class="text-sm text-muted-foreground">of the month</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <input type="radio" id="monthly-relative" value="relative" bind:group={monthlyType} class="h-4 w-4" />
                            <label for="monthly-relative" class="text-sm">The</label>
                            <select 
                                bind:value={bysetpos} 
                                disabled={monthlyType !== 'relative'}
                                class="h-8 rounded-md border text-sm px-1"
                            >
                                {#each positions as pos}
                                    <option value={pos.value}>{pos.label}</option>
                                {/each}
                            </select>
                            <select 
                                bind:value={relativeDay} 
                                disabled={monthlyType !== 'relative'}
                                class="h-8 rounded-md border text-sm px-1"
                            >
                                {#each relativeDays as day}
                                    <option value={day.value}>{day.label}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                </div>
            {/if}

            {#if freq === RRule.YEARLY}
                <div class="grid grid-cols-4 items-start gap-4">
                    <span class="text-right text-sm font-medium leading-none mt-2">In</span>
                    <div class="col-span-3 space-y-4">
                        <div class="flex items-center gap-3">
                            <select bind:value={bymonth} class="h-8 rounded-md border text-sm px-1 w-32">
                                {#each months as month}
                                    <option value={month.value}>{month.label}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="flex items-center gap-3">
                            <input type="radio" id="yearly-day" value="day" bind:group={yearlyType} class="h-4 w-4" />
                            <label for="yearly-day" class="text-sm">Day</label>
                            <input 
                                type="number" 
                                min="1" max="31" 
                                bind:value={bymonthday} 
                                disabled={yearlyType !== 'day'}
                                class="h-8 w-14 rounded-md border text-sm px-2" 
                            />
                        </div>
                        <div class="flex items-center gap-3">
                            <input type="radio" id="yearly-relative" value="relative" bind:group={yearlyType} class="h-4 w-4" />
                            <label for="yearly-relative" class="text-sm">The</label>
                            <select 
                                bind:value={bysetpos} 
                                disabled={yearlyType !== 'relative'}
                                class="h-8 rounded-md border text-sm px-1"
                            >
                                {#each positions as pos}
                                    <option value={pos.value}>{pos.label}</option>
                                {/each}
                            </select>
                            <select 
                                bind:value={relativeDay} 
                                disabled={yearlyType !== 'relative'}
                                class="h-8 rounded-md border text-sm px-1"
                            >
                                {#each relativeDays as day}
                                    <option value={day.value}>{day.label}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                </div>
            {/if}

            <div class="border-t pt-4">
                <div class="grid grid-cols-4 gap-4">
                    <span
                        class="text-right mt-2 text-sm font-medium leading-none"
                        >End</span
                    >
                    <div class="col-span-3 space-y-3">
                        <div class="flex items-center space-x-2">
                            <input
                                type="radio"
                                id="end-never"
                                value="never"
                                name="recurrence-end"
                                bind:group={endType}
                                class="h-4 w-4"
                            />
                            <label
                                for="end-never"
                                class="text-sm"
                                >Never</label
                            >
                        </div>

                        <div class="flex items-center space-x-2">
                            <input
                                type="radio"
                                id="end-count"
                                value="count"
                                name="recurrence-end"
                                bind:group={endType}
                                class="h-4 w-4"
                            />
                            <label
                                for="end-count"
                                class="text-sm"
                                >After</label
                            >
                            <input
                                type="number"
                                min="1"
                                bind:value={count}
                                disabled={endType !== "count"}
                                class="h-8 w-16 rounded-md border bg-transparent px-3 py-1 text-sm disabled:opacity-50"
                            />
                            <span class="text-sm text-muted-foreground"
                                >occurrences</span
                            >
                        </div>

                        <div class="flex items-center space-x-2">
                            <input
                                type="radio"
                                id="end-until"
                                value="until"
                                name="recurrence-end"
                                bind:group={endType}
                                class="h-4 w-4"
                            />
                            <label
                                for="end-until"
                                class="text-sm"
                                >On date</label
                            >
                            <input
                                type="date"
                                bind:value={untilDate}
                                disabled={endType !== "until"}
                                class="h-8 w-[140px] rounded-md border bg-transparent px-3 py-1 text-sm disabled:opacity-50"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <Dialog.Footer>
            <Button variant="ghost" onclick={() => clear()}>Clear</Button>
            <Button onclick={save}>Save Recurrence</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
