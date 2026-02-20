<script lang="ts">
  import { ICONS } from '../../lib/icons';
  import { goto } from '$app/navigation';
  const props = $props<{
    title?: string;
    description?: string;
    href?: string;
    buttonText?: string;
    visible?: boolean;
    gradientFrom?: string;
    gradientTo?: string;
    borderClass?: string;
    buttonClass?: string;
    icon?: keyof typeof ICONS;
    iconClass?: string;
    children?: any;
  }>();

  const visible = props.visible ?? true;
  const gradientFrom = props.gradientFrom ?? 'from-gray-50';
  const gradientTo = props.gradientTo ?? 'to-gray-100';
  const borderClass = props.borderClass ?? 'border-gray-200';
  const buttonClass = props.buttonClass ?? 'bg-gray-600 hover:bg-gray-700';
  const iconDef = props.icon ? ICONS[props.icon as keyof typeof ICONS] : null;
</script>

{#if visible}
  <div class={`bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-lg p-6 border ${borderClass}`}>
    {#if props.children}
      {@render props.children()}
    {:else}
      <div class="flex flex-col justify-between h-full">
        <div>
          {#if props.title}
            <div class="flex items-center gap-2 mb-3">
              {#if iconDef}
                <svg class={`w-6 h-6 ${props.iconClass || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={iconDef.strokeWidth || 2} d={iconDef.path} />
                </svg>
              {/if}
              <h3 class="font-semibold text-gray-900">{props.title}</h3>
            </div>
          {/if}
          {#if props.description}
            <p class="text-sm text-gray-600 mb-4">{props.description}</p>
          {/if}
        </div>
        {#if props.href && props.buttonText}
          <div>
            <button
              type="button"
              class={`inline-block px-4 py-2 text-white rounded-md transition-colors text-sm font-medium ${buttonClass}`}
              onclick={() => goto(props.href)}
            >
              {props.buttonText}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
