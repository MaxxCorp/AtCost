import type { Component } from "svelte";

export interface FilterOption {
    id: string;
    label: string;
    icon?: Component<any>;
    color?: string;
    badge?: string;
}

export interface FilterGroup {
    id: string;
    label: string;
    icon?: Component<any>;
    searchable?: boolean;
    options?: (FilterOption | { value: string; label: string; [key: string]: any })[];
    optionsRemote?: (
        params?: any,
    ) => any;
    listRemote?: (
        params?: any,
    ) => any;
    getOptionLabel?: (item: any) => string;
    getOptionId?: (item: any) => string;
    type?: "select" | "multiselect" | "boolean";
}

export interface BooleanFilter {
    id: string;
    label: string;
    checked: boolean;
    onchange: (checked: boolean) => void;
}

export type FilterDefinition = FilterGroup;
export type FilterAssociation = FilterGroup;

export interface FilterGroupState {
    include: string[];
    exclude: string[];
}

export type FilterStateMap = Record<string, FilterGroupState>;

export interface ListItemContext<T> {
    isSelected: boolean;
    toggleSelection: (id: string) => void;
    deleteItem: (item: T) => void;
    isAssociated: boolean;
    toggleAssociation: (item: T) => void;
    singleSelect: boolean;
    index: number;
    allItems: T[];
}
