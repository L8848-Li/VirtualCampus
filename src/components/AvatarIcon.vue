<script setup lang="ts">
import { profiles } from '../core/config.ts';
defineProps<{id:number}>();
</script>
<template><svg viewBox="0 0 40 48" aria-hidden="true"><ellipse cx="20" cy="45" rx="12" ry="3" fill="#263d3720"/><path d="M7 41V30Q7 23 20 23Q33 23 33 30V41Z" :fill="profiles[id].color"/><path d="M14 40V45M26 40V45" stroke="#354f48" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="15" r="11" fill="#f0d7b7"/><path d="M9 15Q7 2 20 3Q34 3 31 16L27 10Q19 13 13 9Z" :fill="id%3===0?'#5e4c43':id%3===1?'#374c48':'#7e6254'"/><path d="M16 16h.1M24 16h.1" stroke="#35443e" stroke-width="2.4" stroke-linecap="round"/><path d="M18 21q2 2 4 0" fill="none" stroke="#af7566" stroke-width="1"/></svg></template>
