import type { CollaboratorColor } from './types';

export const COLLABORATOR_COLORS: CollaboratorColor[] = [
    { bg: '#3b82f6', text: '#ffffff', border: '#2563eb', ring: 'rgba(59, 130, 246, 0.4)', light: '#eff6ff' }, // Blue
    { bg: '#10b981', text: '#ffffff', border: '#059669', ring: 'rgba(16, 185, 129, 0.4)', light: '#ecfdf5' }, // Emerald
    { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed', ring: 'rgba(139, 92, 246, 0.4)', light: '#f5f3ff' }, // Violet
    { bg: '#f59e0b', text: '#ffffff', border: '#d97706', ring: 'rgba(245, 158, 11, 0.4)', light: '#fffbeb' }, // Amber
    { bg: '#ec4899', text: '#ffffff', border: '#db2777', ring: 'rgba(236, 72, 153, 0.4)', light: '#fdf2f8' }, // Pink
    { bg: '#06b6d4', text: '#ffffff', border: '#0891b2', ring: 'rgba(6, 182, 212, 0.4)', light: '#ecfeff' }, // Cyan
    { bg: '#f97316', text: '#ffffff', border: '#ea580c', ring: 'rgba(249, 115, 22, 0.4)', light: '#fff7ed' }, // Orange
    { bg: '#6366f1', text: '#ffffff', border: '#4f46e5', ring: 'rgba(99, 102, 241, 0.4)', light: '#eef2ff' }, // Indigo
    { bg: '#14b8a6', text: '#ffffff', border: '#0d9488', ring: 'rgba(20, 184, 166, 0.4)', light: '#f0fdfa' }, // Teal
    { bg: '#e11d48', text: '#ffffff', border: '#be123c', ring: 'rgba(225, 29, 72, 0.4)', light: '#fff1f2' }  // Rose
];

export function getCollaboratorColor(identifier: string): CollaboratorColor {
    if (!identifier) return COLLABORATOR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
        hash = (hash << 5) - hash + identifier.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % COLLABORATOR_COLORS.length;
    return COLLABORATOR_COLORS[index];
}
