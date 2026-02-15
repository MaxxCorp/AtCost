import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { magicLink } from "better-auth/plugins/magic-link";
import { admin } from "better-auth/plugins/admin";

// We need to pass the database instance and environment variables
export function createAuth(db: any, options: {
    secret: string;
    baseURL: string;
    google?: { clientId: string; clientSecret: string };
    microsoft?: { clientId: string; clientSecret: string; tenantId?: string };
    getRequestEvent?: () => any;
    emailAndPassword?: boolean;
}) {
    const plugins: any[] = [
        magicLink({
            sendMagicLink: async ({ email, token, url }) => {
                console.log(`Magic link for ${email}: ${url}`);
            }
        }),
        admin()
    ];

    if (options.getRequestEvent) {
        plugins.push(sveltekitCookies(options.getRequestEvent));
    }

    const authOptions: BetterAuthOptions = {
        database: drizzleAdapter(db, {
            provider: "pg",
        }),
        secret: options.secret,
        baseURL: options.baseURL,
        basePath: "/api/auth",
        session: {
            cookieCache: {
                enabled: true,
                maxAge: 30 * 60, // 30 minutes
            },
        },
        emailAndPassword: {
            enabled: options.emailAndPassword || false
        },
        user: {
            additionalFields: {
                roles: {
                    type: "json",
                    required: false,
                    input: false,
                },
                claims: {
                    type: "json",
                    required: false,
                    input: false,
                },
                banned: {
                    type: "boolean",
                    required: false,
                    defaultValue: false
                },
                banReason: {
                    type: "string",
                    required: false
                },
                banExpires: {
                    type: "date",
                    required: false
                }
            },
        },
        socialProviders: {
            ...(options.google ? {
                google: {
                    clientId: options.google.clientId,
                    clientSecret: options.google.clientSecret,
                    scope: [
                        "openid",
                        "email",
                        "profile",
                        "https://www.googleapis.com/auth/calendar"
                    ],
                    accessType: "offline",
                    prompt: "consent"
                }
            } : {}),
            ...(options.microsoft ? {
                microsoft: {
                    clientId: options.microsoft.clientId,
                    clientSecret: options.microsoft.clientSecret,
                    tenantId: options.microsoft.tenantId,
                    scope: ["Calendars.ReadWrite", "offline_access"],
                }
            } : {})
        },
        plugins
    };

    return betterAuth(authOptions);
}
