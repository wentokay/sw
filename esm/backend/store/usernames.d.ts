type UserData = {
    activeUser: User;
    users: Array<User>;
};
export type User = {
    username: string;
    uuid: string;
    jwt: string;
};
export declare function getActiveUser(): Promise<User>;
export declare function setActiveUser(activeUser: User): Promise<void>;
export declare function getUserData(): Promise<UserData>;
/**
 * Used to update users in storage. This is primarily used for updating the
 * cached JWT value, but may be used if usernames are made immutable in the
 * future.
 */
export declare function setUser(uuid: string, updateData: Partial<User>): Promise<User>;
export declare function setUserData(data: UserData): Promise<void>;
export {};
//# sourceMappingURL=usernames.d.ts.map