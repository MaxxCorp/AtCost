<script lang="ts">
    import * as m from "#lib/paraglide/messages.js";
    import { getLocale } from "#lib/paraglide/runtime.js";
    import {
        PRICE_MENU_PAPER,
        PRICE_MENU_TEXT_SCALE,
        formatEuro,
        formatPortion,
        getItemPrice,
        groupItemsBySection,
        type PriceMenuList,
        type PriceMenuSettings,
    } from "#lib/utils/price-menu.js";

    interface MenuEventLocation {
        name?: string | null;
        street?: string | null;
        houseNumber?: string | null;
        zip?: string | null;
        city?: string | null;
    }

    interface MenuEvent {
        summary: string;
        description?: string | null;
        startDateTime?: string | null;
        endDateTime?: string | null;
        isAllDay?: boolean | null;
        locations?: MenuEventLocation[] | null;
    }

    let {
        event,
        lists,
        settings,
    }: {
        event: MenuEvent;
        /** Already filtered: only the price lists that should appear on the sheet */
        lists: PriceMenuList[];
        settings: PriceMenuSettings;
    } = $props();

    const paper = $derived(PRICE_MENU_PAPER[settings.paperSize]);
    const fontScale = $derived(paper.fontScale * PRICE_MENU_TEXT_SCALE[settings.textScale]);

    const headline = $derived(settings.title.trim() || event.summary);

    const whenText = $derived.by(() => {
        if (!event.startDateTime) return "";
        const start = new Date(event.startDateTime);
        const locale = getLocale();
        const dateOpts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
        const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
        const date = start.toLocaleDateString(locale, dateOpts);
        if (event.isAllDay) return date;

        const end = event.endDateTime ? new Date(event.endDateTime) : null;
        const startTime = start.toLocaleTimeString(locale, timeOpts);
        if (!end) return `${date}, ${startTime}`;
        if (end.toDateString() !== start.toDateString()) {
            return `${date}, ${startTime} – ${end.toLocaleDateString(locale, dateOpts)}, ${end.toLocaleTimeString(locale, timeOpts)}`;
        }
        return `${date}, ${startTime} – ${end.toLocaleTimeString(locale, timeOpts)}`;
    });

    const locationText = $derived(
        (event.locations ?? [])
            .map((loc) =>
                [
                    loc.name,
                    [loc.street, loc.houseNumber].filter(Boolean).join(" "),
                    [loc.zip, loc.city].filter(Boolean).join(" "),
                ]
                    .filter(Boolean)
                    .join(", "),
            )
            .filter(Boolean)
            .join(" · "),
    );

    const sponsors = $derived(settings.sponsors.filter((s) => s.logoUrl || s.name.trim()));
    const showSponsors = $derived(settings.showSponsors && sponsors.length > 0);

    const ageGroups = $derived([m.price_menu_age_under_14(), m.price_menu_age_14_54(), m.price_menu_age_55_plus()]);
    const genders = $derived([m.price_menu_gender_female(), m.price_menu_gender_male(), m.price_menu_gender_diverse()]);
</script>

{#snippet sponsorBlock()}
    <section class="sponsors">
        <p class="sponsors-title">{settings.sponsorTitle.trim() || m.price_menu_sponsor_default()}</p>
        <div class="sponsor-logos">
            {#each sponsors as sponsor (sponsor.id)}
                {#if sponsor.logoUrl}
                    <img src={sponsor.logoUrl} alt={sponsor.name} />
                {:else}
                    <span class="sponsor-name">{sponsor.name}</span>
                {/if}
            {/each}
        </div>
    </section>
{/snippet}

<article
    class="sheet"
    style="--sheet-w: {paper.width}mm; --sheet-h: {paper.height}mm; --sheet-pad: {paper.margin}mm; --font-scale: {fontScale}; --cols: {settings.columns}; --accent: {settings.accent};"
>
    {#if showSponsors && settings.sponsorPosition === "header"}
        {@render sponsorBlock()}
    {/if}

    <header class="head">
        <h1>{headline}</h1>
        {#if settings.subtitle.trim()}
            <p class="subtitle">{settings.subtitle}</p>
        {/if}

        {#if settings.showEventIntro}
            {#if settings.showDateTime && whenText}
                <p class="intro-line intro-when">{whenText}</p>
            {/if}
            {#if settings.showLocation && locationText}
                <p class="intro-line">{locationText}</p>
            {/if}
            {#if settings.showDescription && event.description}
                <div class="intro-desc">{@html event.description}</div>
            {/if}
        {/if}
    </header>

    <div class="lists">
        {#each lists as list (list.id ?? list.name)}
            {@const sections = groupItemsBySection(list.items, m.other_items(), settings.groupBySection)}
            <section class="list">
                {#if lists.length > 1}
                    <h2 class="list-title">{list.name}</h2>
                    {#if list.description}
                        <p class="list-desc">{list.description}</p>
                    {/if}
                {/if}

                {#if settings.showSaleTallies}
                    <div class="col-head" aria-hidden="true">
                        <span class="col-head-price">{m.price_menu_price_header()}</span>
                        <span class="col-head-tally">{m.price_menu_tally_header()}</span>
                    </div>
                {/if}

                {#each sections as section (section.id)}
                    <div class="section">
                        {#if section.name}
                            <h3 class="section-title">{section.name}</h3>
                        {/if}
                        <ul>
                            {#each section.items as item, i (item.id ?? i)}
                                {@const portion = settings.showPortions ? formatPortion(item) : null}
                                <li class="row">
                                    <div class="row-main">
                                        <span class="name">{item.name}</span>
                                        {#if portion}
                                            <span class="portion">{portion}</span>
                                        {/if}
                                        <span class="leader"></span>
                                        <span class="price">{formatEuro(getItemPrice(item))}</span>
                                        {#if settings.showSaleTallies}
                                            <span class="tally"></span>
                                        {/if}
                                    </div>
                                    {#if settings.showItemDescriptions && item.description}
                                        <p class="desc">{item.description}</p>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            </section>
        {/each}
    </div>

    {#if settings.showVatNote && settings.vatNote.trim()}
        <p class="note">{settings.vatNote}</p>
    {/if}
    {#if settings.footerNote.trim()}
        <p class="note note-extra">{settings.footerNote}</p>
    {/if}

    {#if settings.showStatistics}
        <section class="stats">
            <h2>{m.price_menu_stats_title()}</h2>
            <p class="stats-hint">{m.price_menu_stats_hint()}</p>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        {#each ageGroups as age (age)}
                            <th>{age}</th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each genders as gender (gender)}
                        <tr>
                            <th scope="row">{gender}</th>
                            {#each ageGroups as age (age)}
                                <td></td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </section>
    {/if}

    {#if showSponsors && settings.sponsorPosition === "footer"}
        {@render sponsorBlock()}
    {/if}
</article>

<style>
    .sheet {
        box-sizing: border-box;
        width: var(--sheet-w);
        min-height: var(--sheet-h);
        padding: var(--sheet-pad);
        background: #fff;
        color: #111827;
        font-size: calc(10.5pt * var(--font-scale));
        line-height: 1.35;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .head {
        margin-bottom: 1.1em;
        padding-bottom: 0.7em;
        border-bottom: 0.7mm solid var(--accent);
    }

    h1 {
        margin: 0;
        font-size: 2.3em;
        font-weight: 800;
        line-height: 1.1;
        letter-spacing: -0.01em;
        color: var(--accent);
    }

    .subtitle {
        margin: 0.3em 0 0;
        font-size: 1.1em;
        color: #4b5563;
    }

    .intro-line {
        margin: 0.35em 0 0;
        color: #374151;
    }

    .intro-when {
        font-weight: 600;
    }

    .intro-desc {
        margin-top: 0.5em;
        font-size: 0.92em;
        color: #4b5563;
        white-space: pre-line;
    }

    .lists {
        column-count: var(--cols);
        column-gap: 10mm;
    }

    .list + .list {
        margin-top: 1.4em;
    }

    .list-title {
        margin: 0 0 0.2em;
        font-size: 1.35em;
        font-weight: 800;
        color: var(--accent);
        break-after: avoid;
    }

    .list-desc {
        margin: 0 0 0.4em;
        font-size: 0.9em;
        color: #6b7280;
    }

    .section + .section {
        margin-top: 0.9em;
    }

    .section-title {
        margin: 0 0 0.25em;
        padding-bottom: 0.15em;
        border-bottom: 0.3mm solid #d1d5db;
        font-size: 0.78em;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #6b7280;
        break-after: avoid;
    }

    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .row {
        padding: 0.28em 0;
        break-inside: avoid;
    }

    .row-main {
        display: flex;
        align-items: baseline;
        gap: 0.5em;
    }

    .name {
        font-weight: 600;
    }

    .portion {
        font-size: 0.85em;
        color: #6b7280;
        white-space: nowrap;
    }

    .leader {
        flex: 1;
        min-width: 1em;
        border-bottom: 0.3mm dotted #9ca3af;
    }

    .price {
        min-width: 4.5em;
        text-align: right;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .desc {
        margin: 0.05em 0 0;
        font-size: 0.85em;
        color: #6b7280;
    }

    .tally {
        align-self: center;
        flex: none;
        box-sizing: border-box;
        width: 26mm;
        height: 1.9em;
        margin-left: 2mm;
        border: 0.3mm solid #9ca3af;
        border-radius: 1mm;
    }

    .col-head {
        display: flex;
        justify-content: flex-end;
        gap: 0.5em;
        margin-bottom: 0.15em;
        font-size: 0.7em;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #9ca3af;
    }

    .col-head-price {
        min-width: 6.4em;
        text-align: right;
    }

    .col-head-tally {
        width: 26mm;
        margin-left: 2mm;
        text-align: center;
    }

    .note {
        margin: 1.4em 0 0;
        text-align: center;
        font-size: 0.8em;
        color: #6b7280;
    }

    .note-extra {
        margin-top: 0.4em;
        white-space: pre-line;
    }

    .stats {
        margin-top: 1.6em;
        break-inside: avoid;
    }

    .stats h2 {
        margin: 0;
        font-size: 1.1em;
        font-weight: 800;
        color: var(--accent);
    }

    .stats-hint {
        margin: 0.1em 0 0.5em;
        font-size: 0.8em;
        color: #6b7280;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }

    th {
        padding: 0.3em;
        font-size: 0.8em;
        font-weight: 700;
        color: #374151;
    }

    thead th {
        border-bottom: 0.3mm solid #9ca3af;
    }

    tbody th {
        width: 22%;
        text-align: left;
    }

    td {
        height: 14mm;
        border: 0.3mm solid #9ca3af;
    }

    .sponsors {
        margin: 1.4em 0;
        text-align: center;
        break-inside: avoid;
    }

    .sponsors-title {
        margin: 0 0 0.5em;
        font-size: 0.72em;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #6b7280;
    }

    .sponsor-logos {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 1em 2em;
    }

    .sponsor-logos img {
        max-width: 38mm;
        max-height: 14mm;
        object-fit: contain;
    }

    .sponsor-name {
        font-weight: 700;
        color: #374151;
    }

    @media print {
        .sheet {
            width: auto;
            min-height: 0;
            padding: 0;
        }
    }
</style>
