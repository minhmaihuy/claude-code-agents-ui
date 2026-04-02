<script setup lang="ts">
interface MenuItem {
  type: 'command' | 'skill'
  name: string
  description?: string
  slug: string
  directory?: string
}

const props = defineProps<{
  items: MenuItem[]
  selectedIndex: number
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'select', item: MenuItem): void
}>()

const menuRef = ref<HTMLElement | null>(null)
const selectedItemRef = ref<HTMLElement | null>(null)

// Scroll selected item into view
watch(() => props.selectedIndex, (newIdx) => {
  if (newIdx >= 0) {
    nextTick(() => {
      selectedItemRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
})
</script>

<template>
  <div
    v-if="isOpen && items.length > 0"
    ref="menuRef"
    class="absolute bottom-full left-0 mb-2 w-full max-w-[400px] max-h-[300px] overflow-y-auto rounded-xl border shadow-xl z-50 flex flex-col"
    style="background: var(--surface-raised); border-color: var(--border-subtle);"
  >
    <div class="p-1.5 space-y-0.5">
      <button
        v-for="(item, idx) in items"
        :key="`${item.type}-${item.slug}`"
        :ref="el => { if (idx === selectedIndex) selectedItemRef = (el as HTMLElement) }"
        class="w-full flex flex-col items-start px-3 py-2 rounded-lg transition-all text-left group"
        :class="idx === selectedIndex ? 'bg-[var(--accent-muted)]' : 'hover:bg-[var(--surface-hover)]'"
        @click="emit('select', item)"
      >
        <div class="flex items-center gap-2 w-full">
          <UIcon 
            :name="item.type === 'command' ? 'i-lucide-terminal' : 'i-lucide-sparkles'" 
            class="size-3.5 shrink-0" 
            :style="{ color: idx === selectedIndex ? 'var(--accent)' : 'var(--text-tertiary)' }" 
          />
          <span class="font-mono text-[13px] font-semibold truncate" :style="{ color: idx === selectedIndex ? 'var(--text-primary)' : 'var(--text-secondary)' }">
            /{{ item.name }}
          </span>
          <span v-if="item.type === 'skill'" class="text-[8px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-accent/10 text-accent ml-2">
            Skill
          </span>
          <span v-if="item.directory" class="text-[9px] font-mono px-1.5 py-px rounded-full badge-subtle opacity-60 ml-auto">
            {{ item.directory }}
          </span>
        </div>
        <p v-if="item.description" class="text-[11px] mt-0.5 line-clamp-1 opacity-70 pl-5 text-tertiary">
          {{ item.description }}
        </p>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for the menu */
div::-webkit-scrollbar {
  width: 4px;
}
div::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 10px;
}
</style>
