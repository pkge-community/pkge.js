# pkge-client

Unofficial NodeJS/TypeScript client for the pkge.net API.

## Installation

```bash
npm install pkge-client
```

## Usage

```typescript
import { PkgeClient } from 'pkge-client';

async function main() {
    const client = new PkgeClient();
    
    // 1. Fetch initial tracking payload
    const data = await client.getTrackingInitial("00340434694908615482");
    console.log(data);
    
    // 2. Trigger an update
    const updateRes = await client.requestUpdate("00340434694908615482");
    console.log(updateRes);
    
    // 3. Poll for status using the hash from the initial data
    if (data.hash) {
        const statusData = await client.getTrackingStatus("00340434694908615482", data.hash);
        console.log(statusData);
    }
}

main();
```
