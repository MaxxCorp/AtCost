<script lang="ts">
	import { authClient } from "#lib/auth.js";
	import { Button } from "@ac/ui/components/button";
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";
	import { goto } from "$app/navigation";
	import { switchDevPersona } from "../../routes/goals/list.remote.js";
	import UsersIcon from "@lucide/svelte/icons/users";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	let name = $state("");
	let email = $state("");
	let password = $state("");
	let signingUp = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleEmailSignUp(e: SubmitEvent) {
		e.preventDefault();
		if (!name || !email || !password) return;
		try {
			signingUp = true;
			errorMessage = null;
			const res = await authClient.signUp.email({
				name,
				email,
				password,
				callbackURL: "/goals",
			});
			if (res?.error) {
				errorMessage = res.error.message || "Registration failed";
				signingUp = false;
				return;
			}
			await goto("/goals");
		} catch (error: any) {
			errorMessage = error?.message || "Registration failed";
			signingUp = false;
		}
	}

	async function handleSocialSignUp(provider: "google" | "microsoft") {
		try {
			signingUp = true;
			errorMessage = null;
			await authClient.signIn.social({
				provider,
				callbackURL: "/goals",
			});
		} catch (error: any) {
			errorMessage = error?.message || "Social registration failed";
			signingUp = false;
		}
	}

	async function handleActivateCommunitySession() {
		try {
			signingUp = true;
			await switchDevPersona("community");
			await goto("/goals");
		} finally {
			signingUp = false;
		}
	}
</script>

<div
	class={cn("flex flex-col gap-6", className)}
	bind:this={ref}
	{...restProps}
>
	<div class="flex flex-col items-center gap-2 text-center">
		<h1 class="text-2xl font-bold">Register to Participate</h1>
		<p class="text-muted-foreground text-sm text-balance">
			Create a community account to pledge, sign petitions, and propose your own goal campaigns
		</p>
	</div>

	{#if errorMessage}
		<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
			{errorMessage}
		</div>
	{/if}

	<form onsubmit={handleEmailSignUp} class="flex flex-col gap-3">
		<div class="flex flex-col gap-1.5">
			<label for="signup-name" class="text-xs font-semibold text-gray-700">Full Name</label>
			<input
				id="signup-name"
				type="text"
				required
				placeholder="Alex Rivera"
				bind:value={name}
				class="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="signup-email" class="text-xs font-semibold text-gray-700">Email</label>
			<input
				id="signup-email"
				type="email"
				required
				placeholder="alex@example.com"
				bind:value={email}
				class="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="signup-password" class="text-xs font-semibold text-gray-700">Password</label>
			<input
				id="signup-password"
				type="password"
				required
				minlength={8}
				placeholder="At least 8 characters"
				bind:value={password}
				class="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
			/>
		</div>
		<Button type="submit" class="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={signingUp}>
			Create Community Account
		</Button>
	</form>

	<div class="relative text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-gray-200">
		<span class="relative z-10 bg-white px-2 text-gray-500">Or register with</span>
	</div>

	<div class="flex flex-col gap-3">
		<Button
			variant="outline"
			type="button"
			class="w-full flex items-center justify-center gap-3 h-10"
			onclick={() => handleSocialSignUp("google")}
			disabled={signingUp}
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24">
				<path
					fill="currentColor"
					d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				/>
				<path
					fill="currentColor"
					d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				/>
				<path
					fill="currentColor"
					d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				/>
				<path
					fill="currentColor"
					d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				/>
			</svg>
			Sign up with Google
		</Button>
		<Button
			variant="outline"
			type="button"
			class="w-full flex items-center justify-center gap-3 h-10"
			onclick={() => handleSocialSignUp("microsoft")}
			disabled={signingUp}
		>
			<svg class="w-4 h-4" viewBox="0 0 23 23">
				<rect width="11" height="11" fill="#F25022" />
				<rect x="12" width="11" height="11" fill="#7FBA00" />
				<rect y="12" width="11" height="11" fill="#00A4EF" />
				<rect x="12" y="12" width="11" height="11" fill="#FFB900" />
			</svg>
			Sign up with Microsoft
		</Button>
	</div>

	<div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
		<p class="text-xs font-semibold text-emerald-950">Instant Evaluator Registration</p>
		<Button
			type="button"
			variant="outline"
			class="w-full justify-center gap-2 border-emerald-300 bg-white text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
			onclick={handleActivateCommunitySession}
			disabled={signingUp}
		>
			<UsersIcon class="size-3.5 text-emerald-600" />
			Activate Registered Community Member Session
		</Button>
	</div>

	<div class="text-center text-sm text-muted-foreground">
		Already have an account?
		<a href="/login" class="underline underline-offset-4 hover:text-primary font-medium"
			>Sign in</a
		>
	</div>
</div>
