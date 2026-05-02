export * from "./schema/index.js";
export * from "./db.js";
export * from "./reporting-line.js";

// Re-export Drizzle core
export * from "drizzle-orm";

// Re-export specific PostgreSQL components from pg-core to avoid ambiguity with core types
export {
    alias,
    boolean,
    char,
    check,
    date,
    decimal,
    doublePrecision,
    foreignKey,
    index,
    integer,
    interval,
    json,
    jsonb,
    numeric,
    pgEnum,
    pgMaterializedView,
    pgPolicy,
    pgRole,
    pgSchema,
    pgSequence,
    pgTable,
    pgView,
    primaryKey,
    real,
    serial,
    smallint,
    text,
    time,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

// Re-export the node-postgres driver entry point
export { drizzle } from "drizzle-orm/node-postgres";
