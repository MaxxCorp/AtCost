<script lang="ts">
	import LoginForm from "#lib/components/login-form.svelte";
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
				<LoginForm />
			</div>
		</div>
	</div>
	<div class="bg-indigo-950 relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
		<div class="relative z-10 max-w-lg space-y-4 my-auto">
			<span class="inline-block rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 text-xs font-semibold text-indigo-200">
				Crowdfunding & Community Action
			</span>
			<h2 class="text-3xl font-black tracking-tight leading-tight">
				Mobilize supporters, unlock stretch goals, and track community milestones in real time.
			</h2>
			<p class="text-indigo-200/90 text-sm leading-relaxed">
				AC-Goals brings Kickstarter-style pledges, Change.org petitions, and interactive multi-threshold thermometers into one unified platform.
			</p>
		</div>
	</div>
</div>
