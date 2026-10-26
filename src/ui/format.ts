import { slots } from '../core/config.ts';
import type { EventType, Relation, CampusEvent, EventFilter } from '../core/types.ts';
export const clock=(tick:number)=>`第 ${Math.min(7,Math.floor(tick/4)+1)} 天 · ${slots[tick%4]}`;
export const labels:Record<EventType,string>={friendship:'新默契',crush:'心动',misunderstanding:'误解',repair:'澄清',rivalry:'竞争',invitation:'邀约',accepted:'接受',declined:'婉拒',missed:'擦肩',action:'日常',intervention:'环境',summary:'手记',system:'开始'};
export const relationLabel=(r:Relation)=>r.crush>0?'悄悄在意':r.aff<-6?'有些紧张':r.aff>=25?'越来越亲近':r.aff>0?'渐渐熟悉':'尚待相识';
export function filterEvents(events:CampusEvent[],filter:EventFilter,selected:number,watched:number[]){return events.filter(e=>filter==='all'||filter==='important'&&e.importance>=3||filter==='selected'&&e.people.includes(selected)||filter==='watched'&&e.people.some(id=>watched.includes(id))||filter==='stories'&&['friendship','crush','misunderstanding','repair','rivalry','invitation','accepted','declined','missed'].includes(e.type)).slice().reverse();}
