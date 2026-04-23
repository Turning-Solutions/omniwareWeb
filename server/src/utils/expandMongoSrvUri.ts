/**
 * Expand `mongodb+srv://` into a `mongodb://` seed list using Node's `dns` module.
 * Avoids the driver's built-in `querySrv` path, which fails on some Windows/DNS setups.
 *
 * Optional: set `MONGODB_DNS_SERVERS` to a comma-separated list (e.g. `8.8.8.8,1.1.1.1`)
 * before SRV resolution when the system resolver refuses SRV queries.
 */
import dns from 'node:dns';

type ParsedSrv = {
    host: string;
    username: string;
    password: string;
    pathname: string;
    search: string;
};

/** Parse mongodb+srv when `new URL` rejects (e.g. unescaped characters in password). */
function parseMongoSrvUriLoose(uri: string): ParsedSrv {
    const withoutScheme = uri.replace(/^mongodb\+srv:\/\//i, '');
    const atPos = withoutScheme.indexOf('@');
    if (atPos < 0) {
        throw new Error('Invalid mongodb+srv URI: missing @');
    }
    const userinfo = withoutScheme.slice(0, atPos);
    const afterAt = withoutScheme.slice(atPos + 1);
    const pathMatch = afterAt.match(/^([^/?#]+)(\/[^?#]*)?(\?[^#]*)?/);
    if (!pathMatch) {
        throw new Error('Invalid mongodb+srv URI: host');
    }
    const host = pathMatch[1];
    const pathname = pathMatch[2] || '/';
    const search = pathMatch[3] || '';
    const colonIdx = userinfo.indexOf(':');
    const username = colonIdx >= 0 ? userinfo.slice(0, colonIdx) : userinfo;
    const password = colonIdx >= 0 ? userinfo.slice(colonIdx + 1) : '';
    return { host, username, password, pathname, search };
}

function applyDnsServersPreference(): void {
    const custom = process.env.MONGODB_DNS_SERVERS?.trim();
    if (custom) {
        dns.setServers(
            custom
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
        );
        return;
    }
    const serversBefore = dns.getServers();
    if (serversBefore.length > 0 && serversBefore.every((server) => server === '127.0.0.1' || server === '::1')) {
        dns.setServers(['1.1.1.1', '8.8.8.8']);
    }
}

async function resolveSrvRecords(srvHost: string): Promise<dns.SrvRecord[]> {
    applyDnsServersPreference();

    const once = () =>
        new Promise<dns.SrvRecord[]>((resolve, reject) => {
            dns.resolveSrv(srvHost, (err, records) => {
                if (err) reject(err);
                else resolve(records);
            });
        });

    try {
        return await once();
    } catch (first) {
        const code = (first as NodeJS.ErrnoException).code;
        const retryable = code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ESERVFAIL';
        if (!retryable || process.env.MONGODB_DNS_SERVERS?.trim()) {
            throw first;
        }
        // Runtime evidence: system resolver refused SRV; retry with public DNS (same machine, Atlas).
        // eslint-disable-next-line no-console
        console.warn('[expandMongoSrvUri] SRV lookup failed (%s); retrying with 1.1.1.1 / 8.8.8.8.', code);
        dns.setServers(['1.1.1.1', '8.8.8.8']);
        return await once();
    }
}

export async function expandMongoSrvUri(uri: string): Promise<string> {
    let parsed: URL;
    try {
        parsed = new URL(uri);
    } catch {
        const loose = parseMongoSrvUriLoose(uri);
        parsed = new URL(
            `mongodb+srv://${encodeURIComponent(loose.username)}:${encodeURIComponent(loose.password)}@${loose.host}${loose.pathname}${loose.search}`
        );
    }
    const srvHost = `_mongodb._tcp.${parsed.host}`;

    const srvRecords = await resolveSrvRecords(srvHost);
    const txtRecords = await new Promise<string[][]>((resolve, reject) => {
        dns.resolveTxt(parsed.host, (err, records) => {
            if (err && (err as NodeJS.ErrnoException).code !== 'ENODATA' && (err as NodeJS.ErrnoException).code !== 'ENOTFOUND') {
                reject(err);
                return;
            }
            resolve(records ?? []);
        });
    }).catch((err) => {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
            dns.setServers(['1.1.1.1', '8.8.8.8']);
            return new Promise<string[][]>((resolve, reject) => {
                dns.resolveTxt(parsed.host, (err2, records) => {
                    if (err2 && (err2 as NodeJS.ErrnoException).code !== 'ENODATA' && (err2 as NodeJS.ErrnoException).code !== 'ENOTFOUND') {
                        reject(err2);
                        return;
                    }
                    resolve(records ?? []);
                });
            });
        }
        throw err;
    });
    const params = new URLSearchParams(parsed.search);
    for (const chunk of txtRecords) {
        for (const part of chunk.join('').split('&')) {
            const [key, value] = part.split('=');
            if (key && value && !params.has(key)) params.set(key, value);
        }
    }
    if (!params.has('tls')) params.set('tls', 'true');
    const dbName = (parsed.pathname || '/').replace(/^\//, '');
    const seedList = srvRecords.map((record) => `${record.name}:${record.port}`).join(',');
    return `mongodb://${encodeURIComponent(parsed.username)}:${encodeURIComponent(parsed.password)}@${seedList}/${dbName}?${params.toString()}`;
}
