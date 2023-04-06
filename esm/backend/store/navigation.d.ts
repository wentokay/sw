/**
 * Persistent model for extension navigation urls.
 */
export type Nav = {
    activeTab: string;
    data: {
        [navId: string]: NavData;
    };
};
export type NavData = {
    id: string;
    urls: Array<any>;
};
export declare function getNav(): Promise<Nav | undefined>;
export declare function setNav(nav: Nav): Promise<void>;
//# sourceMappingURL=navigation.d.ts.map