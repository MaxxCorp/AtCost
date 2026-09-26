export interface CollaboratorColor {
    bg: string;
    text: string;
    border: string;
    ring: string;
    light: string;
}

export interface CollaboratorPresenceData {
    userId: string;
    name: string;
    email?: string;
    avatar?: string;
    color: CollaboratorColor;
    focusedField?: string | null;
    activeAt: number;
}

export interface Collaborator extends CollaboratorPresenceData {
    clientId: string;
    connectionId: string;
}

export interface EntityChangeMessage {
    entityType: string;
    id: string;
    action: 'create' | 'update' | 'delete';
    updatedBy?: {
        id: string;
        name?: string;
        email?: string;
    };
    timestamp: number;
    fields?: Record<string, any>;
}
