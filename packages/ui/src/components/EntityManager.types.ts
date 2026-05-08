export interface FilterDefinition {
    id: string;
    label: string;
    type: "select";
    optionsRemote: (
        params?: any,
    ) => Promise<any[] | { data: any[]; total: number }>;
    options?: { value: string; label: string }[];
}

export interface FilterAssociation {
    id: string;
    label: string;
    listRemote: (
        params?: any,
    ) => Promise<any[] | { data: any[]; total: number }>;
    getOptionLabel: (item: any) => string;
}

export interface ListItemContext<T> {
    isSelected: boolean;
    toggleSelection: (id: string) => void;
    deleteItem: (item: T) => void;
    isAssociated: boolean;
    toggleAssociation: (item: T) => void;
    singleSelect: boolean;
}
