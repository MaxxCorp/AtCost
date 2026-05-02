<script lang="ts">
  export let event: {
    summary: string;
    description?: string;
    startDate?: string;
    startDateTime?: Date;
    endDate?: string;
    endDateTime?: Date;
    locations?: { name: string; street?: string | null }[];
    recurrence?: string[];
  };

  export let contactInfo: {
    name: string;
    email: string;
    phone?: string;
  };

  function formatDate(dateStr?: string, dateTime?: Date): string {
    if (dateTime) {
      return dateTime.toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    if (dateStr) {
      return new Date(dateStr).toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return 'Nicht angegeben';
  }

  $: startDate = formatDate(event.startDate, event.startDateTime);
  $: endDate = formatDate(event.endDate, event.endDateTime);
</script>

<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neue Veranstaltung: {event.summary}</title>

</head>
<body>
    <div class="header">
        <h1>Neue Veranstaltung</h1>
        <div class="event-title">{event.summary}</div>
    </div>

    <div class="event-details">
        <div class="detail-row">
            <span class="detail-label">Titel:</span> {event.summary}
        </div>

        {#if event.description}
        <div class="detail-row">
            <span class="detail-label">Beschreibung:</span><br>
            {@html event.description.replace(/\n/g, '<br>')}
        </div>
        {/if}

        <div class="detail-row">
            <span class="detail-label">Beginn:</span> {startDate}
        </div>

        {#if endDate !== 'Nicht angegeben'}
        <div class="detail-row">
            <span class="detail-label">Ende:</span> {endDate}
        </div>
        {/if}

        {#if event.locations && event.locations.length > 0}
        <div class="detail-row">
            <span class="detail-label">Ort:</span> {event.locations[0].name}{event.locations[0].street ? `, ${event.locations[0].street}` : ''}
        </div>
        {/if}

        {#if event.recurrence && event.recurrence.length > 0}
        <div class="detail-row">
            <span class="detail-label">Wiederholung:</span> {event.recurrence.join(', ')}
        </div>
        {/if}
    </div>

    <div class="contact-info">
        <h3>Kontaktinformationen</h3>
        <div class="detail-row">
            <span class="detail-label">Name:</span> {contactInfo.name}
        </div>
        <div class="detail-row">
            <span class="detail-label">E-Mail:</span> <a href="mailto:{contactInfo.email}">{contactInfo.email}</a>
        </div>
        {#if contactInfo.phone}
        <div class="detail-row">
            <span class="detail-label">Telefon:</span> <a href="tel:{contactInfo.phone}">{contactInfo.phone}</a>
        </div>
        {/if}
    </div>

    <div class="qr-code">
        <p><strong>QR-Code für schnellen Zugriff:</strong></p>
        <img src="cid:event-qr-code" alt="Event QR Code" style="max-width: 200px;">
    </div>

    <div class="footer">
        <p>Diese E-Mail wurde automatisch von AC-Multiposter generiert.</p>
        <p>Anhänge: iCal-Datei (.ics) für Kalender-Import und vCard (.vcf) für Kontaktdaten.</p>
    </div>
</body>
</html>
