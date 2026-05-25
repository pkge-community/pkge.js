export interface TrackingData {
    created_at: string;
    updated_at: string;
    started_tracking_at: string;
    track_number: string;
    status: number;
    checkpoints: any[];
    last_status: string;
    hash: string;
    [key: string]: any;
}
export interface Parcel {
    internalId: string;
    trackNumber: string;
}
export interface PkgeClientOptions {
    widgetKey?: string;
    aesKey?: Buffer;
    aesIv?: Buffer;
}
export declare class PkgeClient {
    private aesKey;
    private aesIv;
    private widgetKey;
    private cookies;
    constructor(options?: PkgeClientOptions);
    /**
     * Manually override the encryption keys and widget key for quick fixes.
     */
    setKeys(options: PkgeClientOptions): void;
    /**
     * Attempts to fetch fresh keys by scraping the latest parcel-view.js.
     * Note: Because the JS is obfuscated, this uses heuristic regex and may break if the obfuscation changes.
     */
    initKeys(): Promise<boolean>;
    private decryptPayload;
    private getCookieString;
    private extractCookies;
    private getCsrfToken;
    /**
     * Returns the registration URL for a user to subscribe their email.
     * The pkge.net platform requires an account to receive email notifications.
     */
    getSignupUrl(email: string): string;
    /**
     * Logs in to pkge.net and establishes a session.
     */
    login(email: string, password: string): Promise<boolean>;
    /**
     * Logs out of pkge.net.
     */
    logout(): Promise<void>;
    /**
     * Scrapes the user's dashboard and returns their saved parcels.
     * Must be logged in.
     */
    getMyParcels(): Promise<Parcel[]>;
    /**
     * Deletes a parcel from the user's account using its internal ID.
     * Must be logged in.
     */
    deleteParcel(internalId: string): Promise<boolean>;
    /**
     * Fetches the initial tracking data by scraping the pkge.net parcel page.
     * @param trackNumber The tracking number
     */
    getTrackingInitial(trackNumber: string): Promise<TrackingData>;
    /**
     * Triggers a background update of the tracking status on pkge.net's servers.
     * Returns the API response (either success or rate limited).
     * @param trackNumber The tracking number
     */
    requestUpdate(trackNumber: string): Promise<any>;
    /**
     * Fetches the latest tracking status from the API using the tracking number and hash.
     * The hash is returned by getTrackingInitial().
     * @param trackNumber The tracking number
     * @param hash The package hash
     */
    getTrackingStatus(trackNumber: string, hash: string): Promise<TrackingData | any>;
}
