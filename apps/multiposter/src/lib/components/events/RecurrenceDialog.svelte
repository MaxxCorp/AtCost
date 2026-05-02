<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { RRule, Frequency } from "$lib/utils/rrule-compat";
    import * as m from "$lib/paraglide/messages";
    let { 
        open = $bindable(false), 
        value = $bindable<string | null>(null),
        onchange 
    } = $props<{
        open?: boolean;
        value?: string | null;
        onchange?: (value: string | null) => void;
    }>();

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
        { label: m.mon_short(), value: RRule.MO.weekday },
        { label: m.tue_short(), value: RRule.TU.weekday },
        { label: m.wed_short(), value: RRule.WE.weekday },
        { label: m.thu_short(), value: RRule.TH.weekday },
        { label: m.fri_short(), value: RRule.FR.weekday },
        { label: m.sat_short(), value: RRule.SA.weekday },
        { label: m.sun_short(), value: RRule.SU.weekday },
    ];

    const positions = [
        { label: m.position_first(), value: 1 },
        { label: m.position_second(), value: 2 },
        { label: m.position_third(), value: 3 },
        { label: m.position_fourth(), value: 4 },
        { label: m.position_last(), value: -1 },
    ];

    const relativeDays = [
        { label: m.monday(), value: 0 },
        { label: m.tuesday(), value: 1 },
        { label: m.wednesday(), value: 2 },
        { label: m.thursday(), value: 3 },
        { label: m.friday(), value: 4 },
        { label: m.saturday(), value: 5 },
        { label: m.sunday(), value: 6 },
        { label: m.day_relative(), value: 7 },
        { label: m.weekday_relative(), value: 8 },
        { label: m.weekend_day_relative(), value: 9 },
    ];

    const months = [
        { label: m.january(), value: 1 },
        { label: m.february(), value: 2 },
        { label: m.march(), value: 3 },
        { label: m.april(), value: 4 },
        { label: m.may(), value: 5 },
        { label: m.june(), value: 6 },
        { label: m.july(), value: 7 },
        { label: m.august(), value: 8 },
        { label: m.september(), value: 9 },
        { label: m.october(), value: 10 },
        { label: m.november(), value: 11 },
        { label: m.december(), value: 12 },
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
            onchange?.(value);
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
        onchange?.(null);
    }

    const frequencies = [
        { label: m.daily(), value: RRule.DAILY },
        { label: m.weekly(), value: RRule.WEEKLY },
        { label: m.monthly(), value: RRule.MONTHLY },
        { label: m.yearly(), value: RRule.YEARLY },
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
            <Dialog.Title>{m.recurrence_settings()}</Dialog.Title>
            <Dialog.Description>
                {m.recurrence_description()}
            </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-6 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
                <label
                    for="freq"
                    class="text-right text-sm font-medium leading-none"
                    >{m.repeat()}</label
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
                    >{m.every()}</label
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
                            ? m.days()
                            : freq === RRule.WEEKLY
                              ? m.weeks()
                              : freq === RRule.MONTHLY
                                ? m.months_plural()
                                : m.years_plural()}
                    </span>
                </div>
            </div>

            {#if freq === RRule.WEEKLY}
                <div class="grid grid-cols-4 items-start gap-4">
                    <span class="text-right text-sm font-medium leading-none mt-2">{m.on_days()}</span>
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
                    <span class="text-right text-sm font-medium leading-none mt-2">{m.mode()}</span>
                    <div class="col-span-3 space-y-4">
                        <div class="flex items-center gap-3">
                            <input type="radio" id="monthly-day" value="day" bind:group={monthlyType} class="h-4 w-4" />
                            <label for="monthly-day" class="text-sm">{m.day_relative()}</label>
                            <input 
                                type="number" 
                                min="1" max="31" 
                                bind:value={bymonthday} 
                                disabled={monthlyType !== 'day'}
                                class="h-8 w-14 rounded-md border text-sm px-2" 
                            />
                            <span class="text-sm text-muted-foreground">{m.of_the_month()}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <input type="radio" id="monthly-relative" value="relative" bind:group={monthlyType} class="h-4 w-4" />
                            <label for="monthly-relative" class="text-sm">{m.the_relative()}</label>
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
                    <span class="text-right text-sm font-medium leading-none mt-2">{m.in_month()}</span>
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
                            <label for="yearly-day" class="text-sm">{m.day_relative()}</label>
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
                            <label for="yearly-relative" class="text-sm">{m.the_relative()}</label>
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
                        >{m.end()}</span
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
                                >{m.never()}</label
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
                                >{m.after()}</label
                            >
                            <input
                                type="number"
                                min="1"
                                bind:value={count}
                                disabled={endType !== "count"}
                                class="h-8 w-16 rounded-md border bg-transparent px-3 py-1 text-sm disabled:opacity-50"
                            />
                            <span class="text-sm text-muted-foreground"
                                >{m.occurrences()}</span
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
                                >{m.on_date()}</label
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
            <Button variant="ghost" onclick={() => clear()}>{m.clear_recurrence()}</Button>
            <Button onclick={save}>{m.save_recurrence()}</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
