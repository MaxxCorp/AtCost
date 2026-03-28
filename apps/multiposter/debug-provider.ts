bgimport { BerlinDeMhCalendarProvider } from './src/lib/server/sync/providers/berlin-de-mh-calendar';

async function verify() {
    console.log("Instantiating provider...");
    const config = {
        id: "ace7f218-8cdf-46ed-b917-cb620ef41801",
        name: "berlin.de test",
        providerType: "berlin-de-mh-calendar",
        userId: "test",
        credentials: {
            username: "SchlossB",
            password: "ballev"
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    // Cast as any because SyncConfig type has extra properties we don't need for raw login test
    const provider = new BerlinDeMhCalendarProvider(config as any);

    console.log("Calling login...");
    // @ts-ignore
    await provider.login();
    console.log("Login succeeded! Cookie jar is:");
    // @ts-ignore
    console.log(provider.sessionCookie);
}

verify().catch(e => {
    console.error("Test failed: ");
    console.error(e);
});
