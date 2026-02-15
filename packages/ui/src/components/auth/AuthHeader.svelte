<script lang="ts">
    import { type Snippet } from "svelte";
    import LoginForm from "./SocialLoginForm.svelte";

    interface Props {
        authClient: any;
        appName?: string;
        user?: any;
        nav?: Snippet;
    }

    let { authClient, appName = "AtCost", user = null, nav }: Props = $props();

    let isMenuOpen = $state(false);
    let isLoginOpen = $state(false);

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    function toggleLogin() {
        console.log("toggleLogin called, current state:", isLoginOpen);
        isLoginOpen = !isLoginOpen;
    }

    async function handleSignOut() {
        await authClient.signOut();
        window.location.reload();
    }
</script>

<header class="bg-white border-b border-gray-200">
    <div class="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
            <div class="flex">
                <div class="flex items-center flex-shrink-0">
                    <a href="/" class="flex items-center gap-2 group">
                        {#if appName.startsWith("AC ")}
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-primary-foreground font-bold shadow-sm transition-transform group-hover:scale-110"
                            >
                                AC
                            </div>
                            <span
                                class="text-xl font-bold text-foreground tracking-tight"
                            >
                                {appName.slice(3)}
                            </span>
                        {:else}
                            <span
                                class="text-xl font-bold text-foreground tracking-tight"
                            >
                                {appName}
                            </span>
                        {/if}
                    </a>
                </div>
                <!-- Navigation Snippet -->
                <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
                    {@render nav?.()}
                </div>
            </div>
            <div class="flex items-center">
                {#if user}
                    <div class="relative ml-3">
                        <div>
                            <button
                                type="button"
                                class="flex text-sm bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                                id="user-menu-button"
                                aria-expanded={isMenuOpen}
                                aria-haspopup="true"
                                onclick={toggleMenu}
                            >
                                <span class="sr-only">Open user menu</span>
                                {#if user.image}
                                    <img
                                        class="w-8 h-8 rounded-full"
                                        src={user.image}
                                        alt={user.name}
                                    />
                                {:else}
                                    <div
                                        class="flex items-center justify-center w-8 h-8 bg-gray-200 rounded-full"
                                    >
                                        <span
                                            class="text-sm font-medium text-gray-600"
                                        >
                                            {user.name?.charAt(0) ||
                                                user.email?.charAt(0)}
                                        </span>
                                    </div>
                                {/if}
                            </button>
                        </div>

                        {#if isMenuOpen}
                            <div
                                class="absolute right-0 w-48 py-1 mt-2 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                                role="menu"
                                aria-orientation="vertical"
                                aria-labelledby="user-menu-button"
                                tabindex="-1"
                            >
                                <div
                                    class="px-4 py-2 text-sm text-gray-700 border-b border-gray-100"
                                >
                                    <p class="font-medium truncate">
                                        {user.name}
                                    </p>
                                    <p class="text-xs text-gray-500 truncate">
                                        {user.email}
                                    </p>
                                </div>
                                <button
                                    onclick={handleSignOut}
                                    class="block w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                                    role="menuitem"
                                    tabindex="-1"
                                    id="user-menu-item-2"
                                >
                                    Sign out
                                </button>
                            </div>
                        {/if}
                    </div>
                {:else}
                    <button
                        onclick={toggleLogin}
                        class="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 bg-blue-500 text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2"
                    >
                        Sign in
                    </button>
                {/if}
            </div>
        </div>
    </div>
</header>

<!-- Login Modal -->
{#if isLoginOpen}
    <div
        class="relative z-[100]"
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
    >
        <!-- Backdrop -->
        <div
            class="fixed inset-0 bg-gray-500/75 transition-opacity"
            aria-hidden="true"
            onclick={toggleLogin}
        ></div>

        <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div
                class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
            >
                <!-- Modal Panel -->
                <div
                    class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
                >
                    <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                        <div class="sm:flex sm:items-start">
                            <div
                                class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full"
                            >
                                <h3
                                    class="text-base font-semibold leading-6 text-gray-900"
                                    id="modal-title"
                                >
                                    Sign in to {appName}
                                </h3>
                                <div class="mt-4">
                                    <LoginForm {authClient} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="bg-gray-50 p-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            class="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:ml-3 sm:w-auto"
                            onclick={toggleLogin}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
