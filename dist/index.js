"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PkgeClient = void 0;
const crypto = __importStar(require("crypto"));
class PkgeClient {
    aesKey;
    aesIv;
    widgetKey;
    cookies = {};
    constructor(options) {
        this.aesKey = options?.aesKey || Buffer.from('tsUlsDJ04cVBAK3D2HzegN48KrYHh2Wq', 'utf-8');
        this.aesIv = options?.aesIv ? options.aesIv.subarray(0, 16) : Buffer.from('xX64KRVu21jsnUw0z03C1PQJkMuxy9l2', 'utf-8').subarray(0, 16);
        this.widgetKey = options?.widgetKey || 'POox85sYUXoAQ6iHPJqyjwcWuZRBHNuF';
    }
    /**
     * Manually override the encryption keys and widget key for quick fixes.
     */
    setKeys(options) {
        if (options.widgetKey)
            this.widgetKey = options.widgetKey;
        if (options.aesKey)
            this.aesKey = options.aesKey;
        if (options.aesIv)
            this.aesIv = options.aesIv.subarray(0, 16);
    }
    /**
     * Attempts to fetch fresh keys by scraping the latest parcel-view.js.
     * Note: Because the JS is obfuscated, this uses heuristic regex and may break if the obfuscation changes.
     */
    async initKeys() {
        try {
            const jsUrl = "https://pkge.net/js/parcel-view.min.js";
            const resJs = await fetch(jsUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const js = await resJs.text();
            // 2. Extract Widget Key
            const widgetMatch = js.match(/["']([a-zA-Z0-9]{32})["']/);
            if (widgetMatch) {
                this.widgetKey = widgetMatch[1];
            }
            // 3. Extract AES Keys using regex heuristic
            const allStrings = Array.from(js.matchAll(/["'](.*?)["']/g)).map(m => m[1]);
            const parts = allStrings.filter(s => /^[a-z]\d[a-zA-Z0-9]{6,20}$/.test(s));
            if (parts.length > 0) {
                parts.sort();
                let aesKeyStr = "";
                let aesIvStr = "";
                // Currently known grouping prefixes based on obfuscation arrays
                const widgetPrefixes = ['a', 'b', 'n', 'p', 'x3'];
                const webPrefixes = ['h', 'k', 't', 'x2'];
                for (const p of parts) {
                    const skip = parseInt(p[1], 10);
                    const val = p.substring(skip);
                    if (widgetPrefixes.some(prefix => p.startsWith(prefix))) {
                        aesKeyStr += val;
                    }
                    else if (webPrefixes.some(prefix => p.startsWith(prefix))) {
                        aesIvStr += val;
                    }
                }
                if (aesKeyStr.length === 32) {
                    this.aesKey = Buffer.from(aesKeyStr, 'utf-8');
                }
                if (aesIvStr.length >= 16) {
                    this.aesIv = Buffer.from(aesIvStr, 'utf-8').subarray(0, 16);
                }
            }
            return true;
        }
        catch (e) {
            return false;
        }
    }
    decryptPayload(b64Ciphertext) {
        const ciphertext = Buffer.from(b64Ciphertext, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.aesKey, this.aesIv);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return JSON.parse(decrypted.toString('utf-8'));
    }
    getCookieString() {
        return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    extractCookies(res) {
        const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
        if (!setCookieHeaders)
            return;
        for (const str of setCookieHeaders) {
            const parts = str.split(';');
            if (parts.length > 0) {
                const [key, ...valParts] = parts[0].split('=');
                if (key && valParts) {
                    this.cookies[key.trim()] = valParts.join('=').trim();
                }
            }
        }
    }
    async getCsrfToken(url) {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Cookie': this.getCookieString()
            }
        });
        this.extractCookies(res);
        const html = await res.text();
        const match = html.match(/<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"/);
        if (match && match[1])
            return match[1];
        throw new Error(`CSRF token not found on ${url}`);
    }
    /**
     * Returns the registration URL for a user to subscribe their email.
     * The pkge.net platform requires an account to receive email notifications.
     */
    getSignupUrl(email) {
        return `https://pkge.net/users/sign-up?login=${encodeURIComponent(email)}`;
    }
    /**
     * Logs in to pkge.net and establishes a session.
     */
    async login(email, password) {
        const csrfToken = await this.getCsrfToken("https://pkge.net/");
        const params = new URLSearchParams();
        params.append("_csrf", csrfToken);
        params.append("login", email);
        params.append("password", password);
        const res = await fetch("https://pkge.net/users/sign-in", {
            method: 'POST',
            body: params,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://pkge.net/',
                'Origin': 'https://pkge.net',
                'Cookie': this.getCookieString()
            },
            redirect: 'manual'
        });
        this.extractCookies(res);
        // Verify login
        const verifyRes = await fetch("https://pkge.net/cabinet/parcels", {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Cookie': this.getCookieString()
            }
        });
        // In Yii2, a successful login sets the _identity cookie
        const hasIdentity = Object.keys(this.cookies).some(k => k.includes('identity'));
        return hasIdentity || (verifyRes.ok && verifyRes.url.includes('/cabinet/parcels'));
    }
    /**
     * Logs out of pkge.net.
     */
    async logout() {
        try {
            const csrfToken = await this.getCsrfToken("https://pkge.net/cabinet/parcels");
            const params = new URLSearchParams();
            params.append("_csrf", csrfToken);
            await fetch("https://pkge.net/users/logout", {
                method: 'POST',
                body: params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': this.getCookieString()
                }
            });
        }
        catch (e) {
            // Ignore
        }
        this.cookies = {};
    }
    /**
     * Scrapes the user's dashboard and returns their saved parcels.
     * Must be logged in.
     */
    async getMyParcels() {
        const res = await fetch("https://pkge.net/cabinet/parcels", {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Cookie': this.getCookieString()
            }
        });
        if (!res.ok)
            throw new Error(`Failed to fetch cabinet: ${res.statusText}`);
        const html = await res.text();
        const parcels = [];
        const rowRegex = /<a[^>]*href="[^"]*\/parcel\/[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?deleteTrackNumber\(['"](\d+)['"]\)/g;
        let match;
        while ((match = rowRegex.exec(html)) !== null) {
            const trackNumber = match[1].trim();
            const internalId = match[2];
            if (!parcels.some(p => p.internalId === internalId)) {
                parcels.push({ trackNumber, internalId });
            }
        }
        return parcels;
    }
    /**
     * Deletes a parcel from the user's account using its internal ID.
     * Must be logged in.
     */
    async deleteParcel(internalId) {
        const csrfToken = await this.getCsrfToken("https://pkge.net/cabinet/parcels");
        const params = new URLSearchParams();
        params.append("_csrf", csrfToken);
        const url = `https://pkge.net/cabinet/parcels/delete?id=${encodeURIComponent(internalId)}`;
        const res = await fetch(url, {
            method: 'POST',
            body: params,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://pkge.net/cabinet/parcels',
                'Origin': 'https://pkge.net',
                'Cookie': this.getCookieString()
            }
        });
        return res.ok;
    }
    /**
     * Fetches the initial tracking data by scraping the pkge.net parcel page.
     * @param trackNumber The tracking number
     */
    async getTrackingInitial(trackNumber) {
        const url = `https://pkge.net/parcel/${encodeURIComponent(trackNumber)}`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cookie': this.getCookieString()
            }
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch parcel page: ${res.statusText}`);
        }
        const html = await res.text();
        const match = html.match(/new\s+parcelView\(\s*["']([^"']+)["']\s*\)/);
        if (!match || !match[1]) {
            throw new Error('Could not find encrypted tracking payload on the page.');
        }
        return this.decryptPayload(match[1]);
    }
    /**
     * Triggers a background update of the tracking status on pkge.net's servers.
     * Returns the API response (either success or rate limited).
     * @param trackNumber The tracking number
     */
    async requestUpdate(trackNumber) {
        const url = `https://api.pkge.net/v1/packages/update?trackNumber=${encodeURIComponent(trackNumber)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'X-Api-Widget-Key': this.widgetKey,
                'Accept': 'application/json',
                'Origin': 'https://pkge.net',
                'Referer': 'https://pkge.net/',
                'Cookie': this.getCookieString()
            }
        });
        try {
            return await res.json();
        }
        catch {
            if (!res.ok)
                throw new Error(`Update request failed: ${res.statusText}`);
            return {};
        }
    }
    /**
     * Fetches the latest tracking status from the API using the tracking number and hash.
     * The hash is returned by getTrackingInitial().
     * @param trackNumber The tracking number
     * @param hash The package hash
     */
    async getTrackingStatus(trackNumber, hash) {
        const url = `https://api.pkge.net/v1/packages/status/${encodeURIComponent(trackNumber)}/${encodeURIComponent(hash)}`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'X-Api-Widget-Key': this.widgetKey,
                'Accept': 'application/json',
                'Origin': 'https://pkge.net',
                'Referer': 'https://pkge.net/',
                'Cookie': this.getCookieString()
            }
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch status API: ${res.statusText}`);
        }
        const data = await res.json();
        if (data && data.payload) {
            return this.decryptPayload(data.payload);
        }
        return data;
    }
}
exports.PkgeClient = PkgeClient;
