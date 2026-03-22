import { readUser } from "./read.remote";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
    try {
        const userId = params.id;
        const user = await readUser(userId);
        return {
            user
        };
    } catch (e: any) {
        return {
            user: null,
            error: e.message
        };
    }
};
