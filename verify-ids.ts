import { db } from './apps/multiposter/src/lib/server/db';
import { announcement } from './apps/multiposter/src/lib/server/db/schema';

async function main() {
    console.log('--- Current Announcements ---');
    const items = await db.select({ id: announcement.id, title: announcement.title }).from(announcement);
    console.log(JSON.stringify(items, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
h