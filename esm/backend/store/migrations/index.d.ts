/**
 * Entrypoint to migrations. This function itself is idempotent. However,
 * we make no guarantee that the migration itself succeeds. If it does not,
 * we will detect it and throw an error, in which case it's expected for the
 * user to reonboard.
 *
 * Steps to add a new migration:
 *
 *   - update the LATEST_MIGRATION_BUILD number
 *   - append a new `runMigration` function in the block of code below,
 *     with the migration build number dependent on the previous one.
 */
export declare function runMigrationsIfNeeded(userInfo: {
    uuid: string;
    password: string;
}): Promise<void>;
//# sourceMappingURL=index.d.ts.map