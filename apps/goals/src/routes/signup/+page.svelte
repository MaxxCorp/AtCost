<script lang="ts">
	import SignupForm from "#lib/components/signup-form.svelte";
</script>

<div class="grid min-h-svh lg:grid-cols-2">
	<div class="flex flex-col gap-4 p-6 md:p-10">
		<div class="flex justify-center gap-2 md:justify-start">
			<a href="/" class="flex items-center gap-2 font-medium">
				<div
					class="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center"
				>
					<span class="text-white font-bold text-sm">AC</span>
				</div>
				<span class="text-xl font-semibold text-gray-900">AC-Goals</span>
			</a>
		</div>
		<div class="flex flex-1 items-center justify-center">
			<div class="w-full max-w-sm">
				<SignupForm />
			</div>
		</div>
	</div>
	<div class="bg-indigo-950 relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
		<div class="relative z-10 max-w-lg space-y-4 my-auto">
			<span class="inline-block rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-200">
				Join the Community
			</span>
			<h2 class="text-3xl font-black tracking-tight leading-tight">
				Register to back campaigns, sign petitions, and propose new community goals.
			</h2>
			<p class="text-indigo-200/90 text-sm leading-relaxed">
				Registered community members can contribute directly to active goals and submit their own multi-stage campaigns for operator showcase approval.
			</p>
		</div>
	</div>
</div>
