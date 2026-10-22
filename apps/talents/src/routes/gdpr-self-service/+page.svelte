<script lang="ts">
    import { GdprSelfServiceForm } from '@ac/ui';
    import { gdprSelfServiceSchema } from '@ac/validations';
    import { submitGdprRequest } from './gdpr-self-service.remote.js';
</script>

<svelte:head>
    <title>DSGVO Selbstauskunft & Anonymisierung · AC Talents</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-white py-12">
    <div class="max-w-4xl mx-auto px-4 sm:px-6">
        <GdprSelfServiceForm
            remoteForm={submitGdprRequest}
            validationSchema={gdprSelfServiceSchema}
        />
    </div>
</div>
